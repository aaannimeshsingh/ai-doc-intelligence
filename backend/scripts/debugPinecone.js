// backend/scripts/debugPinecone.js
require('dotenv').config();
const { Pinecone } = require('@pinecone-database/pinecone');

async function debugPinecone() {
  try {
    console.log('\n🔍 Debugging Pinecone Index...\n');
    
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY
    });
    
    const indexName = process.env.PINECONE_INDEX_NAME;
    console.log('📌 Index:', indexName);
    
    const index = pinecone.index(indexName);
    
    // Get stats
    const stats = await index.describeIndexStats();
    console.log('\n📊 Index Statistics:');
    console.log('   Total Records:', stats.totalRecordCount || 0);
    console.log('   Dimension:', stats.dimension);
    console.log('   Namespaces:', JSON.stringify(stats.namespaces || {}, null, 2));
    
    if ((stats.totalRecordCount || 0) === 0) {
      console.log('\n⚠️  WARNING: Index is empty!');
      console.log('   This means no documents have been successfully indexed.');
      console.log('\n💡 Solutions:');
      console.log('   1. Re-upload your documents');
      console.log('   2. Check upload logs for errors');
      console.log('   3. Verify PINECONE_API_KEY and INDEX_NAME in .env');
    } else {
      console.log('\n✅ Index has records');
      
      // Try a test query
      console.log('\n🧪 Running test query...');
      const { HuggingFaceInferenceEmbeddings } = require('@langchain/community/embeddings/hf');
      const embeddings = new HuggingFaceInferenceEmbeddings({
        apiKey: process.env.HUGGINGFACE_API_KEY,
        model: 'sentence-transformers/all-MiniLM-L6-v2'
      });
      
      const testEmbedding = await embeddings.embedQuery('test query');
      const queryResult = await index.query({
        vector: testEmbedding,
        topK: 5,
        includeMetadata: true
      });
      
      console.log('   Matches found:', queryResult.matches?.length || 0);
      
      if (queryResult.matches && queryResult.matches.length > 0) {
        console.log('\n📄 Sample matches:');
        queryResult.matches.slice(0, 3).forEach((match, i) => {
          console.log(`\n   ${i + 1}. ID: ${match.id}`);
          console.log(`      Score: ${match.score.toFixed(4)}`);
          console.log(`      Text: ${match.metadata?.text?.substring(0, 100)}...`);
        });
      }
    }
    
    console.log('\n✅ Debug complete\n');
    
  } catch (error) {
    console.error('\n❌ Debug failed:', error.message);
    console.error('\nCheck:');
    console.error('1. PINECONE_API_KEY is correct');
    console.error('2. PINECONE_INDEX_NAME exists');
    console.error('3. Index dimension is 384');
  }
  
  process.exit(0);
}

debugPinecone();