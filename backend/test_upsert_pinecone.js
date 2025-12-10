// backend/test_upsert_pinecone.js
require('dotenv').config();
const { Pinecone } = require('@pinecone-database/pinecone');

async function main() {
  try {
    const apiKey = process.env.PINECONE_API_KEY;
    const indexName = process.env.PINECONE_INDEX_NAME;

    if (!apiKey || !indexName) {
      throw new Error('Missing PINECONE_API_KEY or PINECONE_INDEX_NAME in env');
    }

    const pinecone = new Pinecone({ apiKey });
    const index = pinecone.index(indexName);

    console.log('📦 Pinecone index object created:', indexName);

    // Describe stats before
    const before = await index.describeIndexStats();
    console.log('📊 stats before upsert:', JSON.stringify(before, null, 2));

    // Dummy vector (dimension 384 expected). We'll create a 384-length vector of small floats.
    const dim = 384;
    const values = new Array(dim).fill(0).map((_,i) => Math.sin(i)*0.001); // deterministic tiny numbers

    const id = 'test_dummy_vector_' + Date.now();

    const upsertRes = await index.upsert({
      vectors: [{
        id,
        values,
        metadata: { test: true, note: 'dummy upsert from test script' }
      }]
    });

    console.log('📌 upsert response:', JSON.stringify(upsertRes, null, 2));

    // Give Pinecone a moment, then get stats again
    const after = await index.describeIndexStats();
    console.log('📊 stats after upsert:', JSON.stringify(after, null, 2));

    // Optionally query the vector back
    const queryRes = await index.query({
      vector: values,
      topK: 1,
      includeMetadata: true
    });
    console.log('🔎 query res:', JSON.stringify(queryRes, null, 2));

    console.log('✅ Test upsert finished. Look for record id:', id);
  } catch (err) {
    console.error('❌ Test upsert failed:', err);
    process.exit(1);
  }
}

main();
