// backend/services/embeddingService.js
// Local embeddings (no HuggingFace API / credits needed).
// Same model family as before: all-MiniLM-L6-v2 -> 384 dimensions,
// so it stays compatible with the existing Pinecone index.

let extractorPromise = null;

async function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      // @xenova/transformers is ESM, so it must be loaded with dynamic import() from CommonJS
      const { pipeline, env } = await import('@xenova/transformers');
      env.cacheDir = '/tmp/transformers-cache';
      console.log('⏳ Loading local embedding model (first time only)...');
      const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      console.log('✅ Local embedding model loaded');
      return extractor;
    })().catch((err) => {
      extractorPromise = null; // allow retry on next call
      throw err;
    });
  }
  return extractorPromise;
}

// Same interface the rest of the code expects (embedQuery / embedDocuments)
const localEmbeddings = {
  async embedQuery(text) {
    const extractor = await getExtractor();
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  },

  async embedDocuments(texts) {
    const results = [];
    for (const t of texts) {
      results.push(await this.embedQuery(t));
    }
    return results;
  }
};

class EmbeddingService {
  constructor() {
    this.embeddings = localEmbeddings;
  }

  /**
   * Generate embeddings for a single text
   * @param {string} text - Text to generate embedding for
   * @returns {Promise<number[]>} - Embedding vector
   */
  async embedText(text) {
    try {
      if (!text || text.trim().length === 0) {
        throw new Error('Text cannot be empty');
      }

      console.log(`🔄 Generating embedding for text (${text.length} chars)...`);
      const embedding = await this.embeddings.embedQuery(text);
      console.log(`✅ Embedding generated (${embedding.length} dimensions)`);

      return embedding;
    } catch (error) {
      console.error('❌ Error generating embedding:', error);
      throw new Error(`Failed to generate embedding: ${error.message}`);
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   * @param {string[]} texts - Array of texts to generate embeddings for
   * @returns {Promise<number[][]>} - Array of embedding vectors
   */
  async embedBatch(texts) {
    try {
      if (!texts || texts.length === 0) {
        throw new Error('Texts array cannot be empty');
      }

      console.log(`🔄 Generating embeddings for ${texts.length} texts...`);
      const embeddings = await this.embeddings.embedDocuments(texts);
      console.log(`✅ Generated ${embeddings.length} embeddings`);

      return embeddings;
    } catch (error) {
      console.error('❌ Error generating batch embeddings:', error);
      throw new Error(`Failed to generate batch embeddings: ${error.message}`);
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   * @param {number[]} vecA - First vector
   * @param {number[]} vecB - Second vector
   * @returns {number} - Similarity score between -1 and 1
   */
  cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    return similarity;
  }

  /**
   * Find most similar texts to a query
   * @param {string} query - Query text
   * @param {Array<{text: string, embedding: number[]}>} documents - Documents with embeddings
   * @param {number} topK - Number of top results to return
   * @returns {Promise<Array<{text: string, score: number}>>} - Top K similar documents
   */
  async findSimilar(query, documents, topK = 5) {
    try {
      // Generate embedding for query
      const queryEmbedding = await this.embedText(query);

      // Calculate similarity for each document
      const results = documents.map(doc => ({
        text: doc.text,
        score: this.cosineSimilarity(queryEmbedding, doc.embedding)
      }));

      // Sort by similarity score (descending)
      results.sort((a, b) => b.score - a.score);

      // Return top K results
      return results.slice(0, topK);
    } catch (error) {
      console.error('❌ Error finding similar documents:', error);
      throw new Error(`Failed to find similar documents: ${error.message}`);
    }
  }

  /**
   * Health check for embedding service
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    try {
      console.log('🔍 Running embedding service health check...');
      const testEmbedding = await this.embedText("test");

      if (!testEmbedding || testEmbedding.length === 0) {
        throw new Error('Generated embedding is empty');
      }

      console.log(`✅ Embedding service healthy (dimension: ${testEmbedding.length})`);
      return true;
    } catch (error) {
      console.error('❌ Embedding service health check failed:', error);
      return false;
    }
  }
}

// Export singleton instance
module.exports = new EmbeddingService();
