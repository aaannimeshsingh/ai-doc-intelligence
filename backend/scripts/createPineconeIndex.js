// scripts/createPineconeIndex.js
const { PineconeClient } = require('@pinecone-database/pinecone');
require('dotenv').config();

(async () => {
  const client = new PineconeClient();
  await client.init({
    apiKey: process.env.PINECONE_API_KEY,
    environment: process.env.PINECONE_ENV || process.env.PINECONE_ENVIRONMENT
  });

  const indexName = process.env.PINECONE_INDEX_NAME || 'your-index-name';

  // delete if exists (optional)
  try { await client.deleteIndex({ indexName }); console.log('Deleted existing index'); } catch(e){}

  await client.createIndex({
    createRequest: {
      name: indexName,
      dimension: 384,
      metric: 'cosine'
    }
  });

  console.log(`Index ${indexName} created with dimension 384`);
  process.exit(0);
})();
