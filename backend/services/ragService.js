// backend/services/ragService.js - Updated with dynamic topK
const { Pinecone } = require('@pinecone-database/pinecone');
const { HuggingFaceInferenceEmbeddings } = require('@langchain/community/embeddings/hf');
const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters');

const BATCH_SIZE = 50;

class RAGService {
  constructor() {
    try {
      this.pinecone = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY
      });
      this.indexName = process.env.PINECONE_INDEX_NAME;
      this.index = this.pinecone.index(this.indexName);

      this.embeddings = new HuggingFaceInferenceEmbeddings({
        apiKey: process.env.HUGGINGFACE_API_KEY,
        model: 'sentence-transformers/all-MiniLM-L6-v2'
      });

      console.log('✅ RAG Service initialized');
      console.log('📌 Index:', this.indexName);
    } catch (error) {
      console.error('❌ RAG Service init error:', error);
      throw error;
    }
  }

  async splitDocument(text) {
    try {
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 500,  // Smaller chunks for better matching
        chunkOverlap: 100
      });
      const chunks = await splitter.splitText(text);
      console.log(`📄 Split into ${chunks.length} chunks`);
      return chunks;
    } catch (error) {
      console.error('❌ Split error:', error);
      throw error;
    }
  }

  async _batchUpsert(vectors) {
    for (let i = 0; i < vectors.length; i += BATCH_SIZE) {
      const batch = vectors.slice(i, i + BATCH_SIZE);
      console.log(`🔼 Upserting batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} vectors)`);
      
      try {
        await this.index.upsert(batch);
        console.log('✅ Batch upserted');
        
        // Wait a bit for Pinecone to index
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (upsertError) {
        console.error('❌ Upsert error:', upsertError);
        throw upsertError;
      }
    }
  }

  async indexDocument(documentId, text) {
    try {
      console.log(`🔄 Indexing document: ${documentId}`);
      
      if (!text || text.trim().length === 0) {
        throw new Error('Empty document text');
      }

      // Split text
      const chunks = await this.splitDocument(text);
      if (!chunks || chunks.length === 0) {
        throw new Error('No chunks created');
      }

      // Generate embeddings
      console.log('🔄 Generating embeddings...');
      const vectors = [];
      
      for (let i = 0; i < chunks.length; i++) {
        try {
          const chunk = chunks[i];
          if (!chunk || chunk.trim().length === 0) {
            console.warn(`⚠️ Skipping empty chunk ${i}`);
            continue;
          }
          
          const embedding = await this.embeddings.embedQuery(chunk);

          if (!Array.isArray(embedding) || embedding.length === 0) {
            throw new Error(`Invalid embedding for chunk ${i}`);
          }

          console.log(`✅ Chunk ${i + 1}/${chunks.length}: dim=${embedding.length}`);

          vectors.push({
            id: `${documentId}_chunk_${i}`,
            values: embedding,
            metadata: {
              documentId: documentId,
              chunkIndex: i,
              text: chunk // Store full chunk text
            }
          });
        } catch (chunkErr) {
          console.error(`❌ Chunk ${i} error:`, chunkErr.message);
          throw chunkErr;
        }
      }

      if (vectors.length === 0) {
        throw new Error('No vectors created');
      }

      // Verify format
      console.log('🔍 Verifying vectors...');
      console.log('Total vectors:', vectors.length);
      console.log('Sample:', {
        id: vectors[0].id,
        dim: vectors[0].values.length,
        metadataKeys: Object.keys(vectors[0].metadata)
      });

      // Check index dimension
      try {
        const stats = await this.index.describeIndexStats();
        console.log('📊 Index dimension:', stats.dimension);
        
        const expectedDim = stats.dimension || 384;
        const actualDim = vectors[0].values.length;
        
        if (actualDim !== expectedDim) {
          throw new Error(`Dimension mismatch: expected ${expectedDim}, got ${actualDim}`);
        }
      } catch (descError) {
        console.warn('⚠️ Could not verify dimension:', descError.message);
      }

      // Upsert
      console.log(`🔼 Upserting ${vectors.length} vectors...`);
      await this._batchUpsert(vectors);

      // Wait for indexing to complete
      console.log('⏳ Waiting for Pinecone to index...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Verify upload
      try {
        const finalStats = await this.index.describeIndexStats();
        console.log('📊 Total records in index:', finalStats.totalRecordCount || 0);
        
        // Try to query one of the vectors we just uploaded
        const testQuery = await this.index.query({
          id: vectors[0].id,
          topK: 1,
          includeMetadata: true
        });
        
        if (testQuery.matches && testQuery.matches.length > 0) {
          console.log('✅ Verification: Vector found in index');
        } else {
          console.warn('⚠️ Verification: Vector not yet available');
        }
      } catch (verifyErr) {
        console.warn('⚠️ Could not verify upload:', verifyErr.message);
      }

      console.log(`✅ Indexed ${vectors.length} chunks`);
      return vectors.map(v => v.id);
      
    } catch (error) {
      console.error('❌ Indexing error:', error);
      throw error;
    }
  }

  // ✅ Updated to accept topK parameter
  async queryDocuments(question, documentId = null, topK = 3) {
    try {
      console.log(`🔍 Querying: "${question}"`);
      console.log(`🔧 Using topK: ${topK}`);
      
      if (!question || question.trim().length === 0) {
        return [];
      }

      // Generate query embedding
      const queryEmbedding = await this.embeddings.embedQuery(question);
      console.log('✅ Query embedding generated, dim:', queryEmbedding.length);

      // Prepare query options with dynamic topK ✅
      const queryOptions = {
        vector: queryEmbedding,
        topK: Math.max(topK, 10),  // Get at least 10, but respect user's topK if higher
        includeMetadata: true
      };

      if (documentId) {
        queryOptions.filter = { documentId: documentId };
        console.log('🔍 Filtering by documentId:', documentId);
      }

      console.log('🔍 Querying Pinecone...');
      const results = await this.index.query(queryOptions);
      
      console.log('📥 Query complete');
      console.log('📊 Matches returned:', results.matches?.length || 0);

      if (!results || !results.matches || results.matches.length === 0) {
        console.log('⚠️ No matches found');
        
        // Debug: Check if index has any records
        try {
          const stats = await this.index.describeIndexStats();
          console.log('📊 Index stats:', {
            totalRecords: stats.totalRecordCount || 0,
            dimension: stats.dimension
          });
          
          if ((stats.totalRecordCount || 0) === 0) {
            console.log('⚠️ Index is empty! Documents may not be indexed yet.');
          }
        } catch (statsErr) {
          console.warn('⚠️ Could not get stats:', statsErr.message);
        }
        
        return [];
      }

      const texts = results.matches
        .filter(m => m.metadata && m.metadata.text)
        .map(m => ({ 
          id: m.id, 
          score: m.score, 
          text: m.metadata.text,
          metadata: m.metadata
        }));

      console.log(`✅ Found ${texts.length} relevant chunks`);
      
      if (texts.length > 0) {
        console.log('📊 Top scores:', texts.slice(0, Math.min(topK, 3)).map(t => t.score.toFixed(4)).join(', '));
      }

      // Return only topK results ✅
      return texts.slice(0, topK);
      
    } catch (error) {
      console.error('❌ Query error:', error);
      throw error;
    }
  }

  async deleteDocument(vectorIds) {
    try {
      if (!vectorIds || vectorIds.length === 0) {
        console.log('⚠️ No vectors to delete');
        return;
      }
      
      console.log(`🗑️ Deleting ${vectorIds.length} vectors...`);
      await this.index.deleteMany(vectorIds);
      console.log(`✅ Deleted ${vectorIds.length} vectors`);
      
    } catch (error) {
      console.error('❌ Delete error:', error);
      throw error;
    }
  }

  async healthCheck() {
    try {
      console.log('🔍 Health check...');
      
      // Test embedding
      const testEmbed = await this.embeddings.embedQuery('test');
      console.log('✅ Embeddings working, dim:', testEmbed.length);
      
      // Test Pinecone
      const stats = await this.index.describeIndexStats();
      console.log('✅ Pinecone working');
      console.log('📊 Records:', stats.totalRecordCount || 0);
      console.log('📊 Dimension:', stats.dimension);
      
      return true;
    } catch (error) {
      console.error('❌ Health check failed:', error);
      return false;
    }
  }
}

module.exports = new RAGService();