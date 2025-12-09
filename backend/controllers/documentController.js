// backend/controllers/documentController.js
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const pdfParse = require('pdf-parse');
const { v4: uuidv4 } = require('uuid');
const Document = require('../models/Document');
const ragService = require('../services/ragService');

// AWS S3 Configuration
const AWS = require('aws-sdk');
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

// --- Helper: extract text for small immediate processing (PDF/TXT) ---
async function extractTextFromFile(filePath, mimetype) {
  const buffer = await fsPromises.readFile(filePath);
  if (mimetype === 'application/pdf') {
    const pdf = await pdfParse(buffer);
    return pdf.text || '';
  }
  // plain text
  return buffer.toString('utf8') || '';
}

// -------------------- PRESIGN: return a signed PUT url or form info --------------------
exports.getPresignUrl = async (req, res) => {
  try {
    const { filename, contentType, size } = req.body;
    if (!filename) return res.status(400).json({ error: 'filename required' });

    const key = `documents/${req.user ? req.user._id : 'public'}/${Date.now()}-${uuidv4()}-${filename}`;

    // Create presigned PUT url (short-lived)
    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      ContentType: contentType || 'application/octet-stream',
      ACL: 'private',
      Expires: 300 // seconds
    };

    const putUrl = s3.getSignedUrl('putObject', params);

    return res.json({
      presign: {
        putUrl,
        key,
        s3Url: `https://${process.env.AWS_BUCKET_NAME}.s3.amazonaws.com/${key}`
      }
    });
  } catch (err) {
    console.error('Presign error:', err);
    return res.status(500).json({ error: 'Presign generation failed', details: err.message || err });
  }
};

// -------------------- FINALIZE: called after client uploaded to S3 --------------------
exports.finalizeDocument = async (req, res) => {
  try {
    const { s3Key, s3Url, originalName, size, mimetype } = req.body;
    if (!s3Key || !s3Url) {
      return res.status(400).json({ success: false, message: 's3Key and s3Url are required' });
    }

    const userId = req.user ? req.user._id : null;

    // Create DB record
    const document = new Document({
      userId,
      filename: path.basename(s3Key),
      originalName: originalName || path.basename(s3Key),
      filepath: null,
      s3Key,
      s3Url,
      mimetype: mimetype || 'application/octet-stream',
      size: size || 0,
      uploadedAt: new Date()
    });

    await document.save();
    console.log('✅ Finalized document saved:', document._id);

    // Launch async processing (extract text + embeddings) in background
    (async () => {
      try {
        const localTemp = `/tmp/${uuidv4()}-${document._id}-${document.originalName}`;
        const params = { Bucket: process.env.AWS_BUCKET_NAME, Key: s3Key };
        const s3obj = await s3.getObject(params).promise();
        await fsPromises.writeFile(localTemp, s3obj.Body);

        const textContent = await extractTextFromFile(localTemp, document.mimetype);
        document.textContent = textContent || '';
        
        const vectorIds = await ragService.indexDocument(document._id.toString(), document.textContent || '');
        document.vectorIds = vectorIds;
        document.processedAt = new Date();
        await document.save();
        
        await fsPromises.unlink(localTemp).catch(() => {});
        console.log('✅ Background processing finished for', document._id);
      } catch (bgErr) {
        console.error('Background processing error:', bgErr);
      }
    })();

    return res.status(201).json({ 
      success: true, 
      document: { 
        id: document._id, 
        originalName: document.originalName 
      } 
    });
  } catch (err) {
    console.error('Finalize error:', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to finalize document', 
      error: err.message || err 
    });
  }
};

// -------------------- Direct multipart upload handler --------------------
exports.uploadDocumentMultipart = async (req, res) => {
  try {
    console.log('📤 Multipart upload started');
    const userId = req.user ? req.user._id : null;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const file = req.file;
    const filePath = file.path;
    console.log('File saved to disk at:', filePath);

    // Extract text
    let textContent = '';
    try {
      textContent = await extractTextFromFile(filePath, file.mimetype);
    } catch (extractErr) {
      console.warn('Text extraction failed:', extractErr.message);
    }

    // Upload to S3
    const buffer = await fsPromises.readFile(filePath);
    const s3Key = `documents/${userId || 'public'}/${Date.now()}-${uuidv4()}-${file.originalname}`;
    const s3Params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: s3Key,
      Body: buffer,
      ContentType: file.mimetype || 'application/octet-stream',
      ACL: 'private'
    };
    const s3Result = await s3.upload(s3Params).promise();
    console.log('✅ Uploaded to S3:', s3Result.Location);

    // Save document in DB
    const document = new Document({
      userId,
      filename: file.filename,
      originalName: file.originalname,
      filepath: file.path,
      s3Key,
      s3Url: s3Result.Location,
      mimetype: file.mimetype,
      size: file.size,
      textContent: textContent || ''
    });

    await document.save();

    // Index in RAG
    let vectorIds = [];
    try {
      vectorIds = await ragService.indexDocument(document._id.toString(), document.textContent || '');
      document.vectorIds = vectorIds;
      document.processedAt = new Date();
      await document.save();
    } catch (indexErr) {
      console.warn('Indexing failed:', indexErr);
    }

    // Cleanup local file
    try { 
      await fsPromises.unlink(file.path); 
    } catch (e) {
      console.warn('Failed to delete temp file:', e.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      document: {
        id: document._id,
        originalName: document.originalName,
        size: document.size
      }
    });
  } catch (err) {
    console.error('Multipart upload error:', err);
    // Cleanup on error
    if (req.file && req.file.path) {
      await fsPromises.unlink(req.file.path).catch(() => {});
    }
    return res.status(500).json({ 
      success: false, 
      message: 'Upload failed', 
      error: err.message || err 
    });
  }
};

// -------------------- Get documents --------------------
exports.getDocuments = async (req, res) => {
  try {
    const query = req.user ? { userId: req.user._id } : {};
    const documents = await Document.find(query)
      .select('filename originalName uploadedAt size processedAt vectorIds userId s3Url')
      .sort({ uploadedAt: -1 });
    return res.json({ success: true, count: documents.length, documents });
  } catch (err) {
    console.error('Get documents error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch documents' });
  }
};

// -------------------- Get single document --------------------
exports.getDocument = async (req, res) => {
  try {
    const query = { _id: req.params.id };
    if (req.user) query.userId = req.user._id;
    const document = await Document.findOne(query);
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }
    return res.json({ success: true, document });
  } catch (err) {
    console.error('Get document error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch document' });
  }
};

// -------------------- Delete document --------------------
exports.deleteDocument = async (req, res) => {
  try {
    const query = { _id: req.params.id };
    if (req.user) query.userId = req.user._id;
    const document = await Document.findOne(query);
    
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // Delete from S3
    try {
      if (document.s3Key) {
        await s3.deleteObject({ 
          Bucket: process.env.AWS_BUCKET_NAME, 
          Key: document.s3Key 
        }).promise();
      }
    } catch (s3err) {
      console.warn('S3 deletion warning:', s3err);
    }

    // Remove DB record
    await Document.deleteOne({ _id: document._id });

    return res.json({ success: true, message: 'Document deleted successfully' });
  } catch (err) {
    console.error('Delete document error:', err);
    return res.status(500).json({ success: false, message: 'Failed to delete document' });
  }
};