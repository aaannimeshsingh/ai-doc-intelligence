// scripts/reindexAll.js
require('dotenv').config();
const mongoose = require('mongoose');
const Document = require('./backend/models/Document'); // adjust path if needed
const ragService = require('./backend/services/ragService'); // your service

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const docs = await Document.find({ textContent: { $exists: true, $ne: '' } });
  console.log('Found', docs.length, 'documents to index');

  for (const doc of docs) {
    try {
      const vectorIds = await ragService.indexDocument(doc._id.toString(), doc.textContent);
      console.log(`Indexed doc ${doc._id} -> ${vectorIds.length} vectors`);
    } catch (e) {
      console.error('Index error for', doc._id, e.message);
    }
  }
  process.exit(0);
})();
