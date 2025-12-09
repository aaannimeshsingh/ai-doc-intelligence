// scripts/reindex.js (place in backend/)
require('dotenv').config();
const mongoose = require('mongoose');
const Document = require('./models/Document');
const ragService = require('./services/ragService');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const docs = await Document.find({ textContent: { $exists: true, $ne: '' } });
  console.log('Found', docs.length, 'docs to index');
  for (const d of docs) {
    console.log('--- indexing', d._id);
    try {
      const ids = await ragService.indexDocument(d._id.toString(), d.textContent);
      console.log('indexed ->', ids.length, 'vectors for', d._id);
      d.vectorIds = ids;
      d.processedAt = new Date();
      await d.save();
    } catch (e) {
      console.error('index error for', d._id, e);
    }
  }
  process.exit(0);
})();
