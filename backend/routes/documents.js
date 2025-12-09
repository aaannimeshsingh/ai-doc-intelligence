// backend/routes/documents.js - COMPLETE VERSION
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { protect } = require('../middleware/auth');
const Document = require('../models/Document');
const fs = require('fs').promises;
const pdfParse = require('pdf-parse');
const ragService = require('../services/ragService');
const ocrService = require('../services/ocrService'); // ✅ OCR Support
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const Groq = require('groq-sdk');

// Initialize Groq for suggestions
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Configure S3
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = './uploads';
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|txt|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || 
                     file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only PDF, TXT, and DOCX files are allowed'));
    }
  }
});

// Helper function to extract text from files
async function extractTextFromFile(filePath, mimetype) {
  try {
    const buffer = await fs.readFile(filePath);
    
    if (mimetype === 'application/pdf') {
      const data = await pdfParse(buffer);
      return data.text || '';
    } else if (mimetype === 'text/plain') {
      return buffer.toString('utf8');
    } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return '[DOCX processing not yet implemented]';
    }
    
    return '';
  } catch (error) {
    console.error('Text extraction error:', error);
    return '';
  }
}

// ===================================================================
// @route   POST /api/documents/upload
// @desc    Upload a document to local storage AND S3 with OCR support
// @access  Private
// ===================================================================
router.post('/upload', protect, upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    console.log('📤 File uploaded:', req.file.originalname);
    console.log('👤 User:', req.user.email);

    // 1. Extract text content from the file
    console.log('📝 Extracting text from:', req.file.originalname);
    let textContent = await extractTextFromFile(req.file.path, req.file.mimetype);
    
    // 1.5. ✅ Try OCR if text is empty or too short (scanned document)
    if (req.file.mimetype === 'application/pdf' && (!textContent || textContent.trim().length < 50)) {
      console.log('🔍 Text extraction yielded little content, trying OCR...');
      textContent = await ocrService.smartExtractText(req.file.path, req.file.mimetype, textContent);
    }
    
    console.log('✅ Text extracted:', textContent.length, 'characters');

    // 2. Upload to S3
    console.log('☁️ Uploading to S3...');
    const fileBuffer = await fs.readFile(req.file.path);
    const s3Key = `documents/${req.user._id}/${Date.now()}-${uuidv4()}-${req.file.originalname}`;
    
    const s3Params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: req.file.mimetype,
      ACL: 'private'
    };

    const s3Result = await s3.upload(s3Params).promise();
    console.log('✅ Uploaded to S3:', s3Result.Location);

    // 3. Create document record with BOTH local and S3 info
    const document = await Document.create({
      originalName: req.file.originalname,
      filename: req.file.filename,
      filepath: req.file.path,
      s3Key: s3Key,
      s3Url: s3Result.Location,
      mimetype: req.file.mimetype,
      size: req.file.size,
      userId: req.user._id,
      textContent: textContent,
      uploadedAt: new Date()
    });

    console.log('✅ Document saved to DB:', document._id);

    // 4. Index in vector store
    if (textContent && textContent.trim().length > 0) {
      try {
        console.log('🔄 Indexing document in vector store...');
        const vectorIds = await ragService.indexDocument(
          document._id.toString(), 
          textContent
        );
        
        document.vectorIds = vectorIds;
        document.processedAt = new Date();
        await document.save();
        
        console.log('✅ Document indexed with', vectorIds.length, 'vectors');
      } catch (indexError) {
        console.error('❌ Vector indexing failed:', indexError);
      }
    } else {
      console.warn('⚠️ No text content to index');
    }

    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      document: {
        id: document._id,
        originalName: document.originalName,
        size: document.size,
        uploadedAt: document.uploadedAt,
        hasText: textContent.length > 0,
        isIndexed: document.vectorIds && document.vectorIds.length > 0,
        s3Url: document.s3Url
      }
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    
    // Clean up file if upload failed
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('Failed to delete file:', unlinkError);
      }
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to upload document'
    });
  }
});

// ===================================================================
// @route   GET /api/documents
// @desc    Get all user documents
// @access  Private
// ===================================================================
router.get('/', protect, async (req, res) => {
  try {
    console.log('📚 Fetching documents for user:', req.user.email);

    const documents = await Document.find({ userId: req.user._id })
      .sort({ uploadedAt: -1 })
      .select('originalName filename size mimetype uploadedAt processedAt textContent vectorIds s3Key s3Url');

    console.log(`✅ Found ${documents.length} documents`);

    const docsWithStatus = documents.map(doc => ({
      _id: doc._id,
      originalName: doc.originalName,
      filename: doc.filename,
      size: doc.size,
      mimetype: doc.mimetype,
      uploadedAt: doc.uploadedAt,
      processedAt: doc.processedAt,
      hasText: doc.textContent && doc.textContent.length > 0,
      textLength: doc.textContent ? doc.textContent.length : 0,
      isIndexed: doc.vectorIds && doc.vectorIds.length > 0,
      vectorCount: doc.vectorIds ? doc.vectorIds.length : 0,
      s3Url: doc.s3Url,
      isInS3: !!doc.s3Key
    }));

    res.json({
      success: true,
      count: documents.length,
      documents: docsWithStatus
    });

  } catch (error) {
    console.error('❌ Fetch documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch documents'
    });
  }
});

// ===================================================================
// @route   GET /api/documents/:id
// @desc    Get single document
// @access  Private
// ===================================================================
router.get('/:id', protect, async (req, res) => {
  try {
    const document = await Document.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    res.json({
      success: true,
      document
    });

  } catch (error) {
    console.error('❌ Get document error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get document'
    });
  }
});

// ===================================================================
// @route   GET /api/documents/:id/suggestions
// @desc    Generate 5 smart questions based on document content
// @access  Private
// ===================================================================
router.get('/:id/suggestions', protect, async (req, res) => {
  try {
    console.log('🤔 Generating suggestions for document:', req.params.id);

    const document = await Document.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!document) {
      return res.status(404).json({ 
        success: false, 
        message: 'Document not found' 
      });
    }

    if (!document.textContent || document.textContent.trim().length === 0) {
      return res.json({
        success: true,
        suggestions: [
          "What is this document about?",
          "Can you summarize this document?",
          "What are the main topics discussed?",
          "What information does this contain?",
          "Tell me about this document"
        ]
      });
    }

    // Use first 2000 characters for context
    const context = document.textContent.substring(0, 2000);
    
    console.log('🤖 Asking Groq to generate questions...');

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant that generates relevant questions about documents. 
Generate exactly 5 useful, specific questions someone might ask about this document.
Return ONLY a JSON array of strings, nothing else. No markdown, no explanations.
Example format: ["Question 1?", "Question 2?", "Question 3?", "Question 4?", "Question 5?"]`
        },
        {
          role: "user",
          content: `Document type: ${document.originalName}\nContent:\n${context}\n\nGenerate 5 questions:`
        }
      ],
      max_tokens: 300,
      temperature: 0.7
    });

    let suggestionsText = completion.choices[0].message.content.trim();
    
    // Clean up response - remove markdown code blocks if present
    suggestionsText = suggestionsText.replace(/```json\n?|\n?```/g, '');
    
    console.log('📝 Raw suggestions:', suggestionsText);

    try {
      const suggestions = JSON.parse(suggestionsText);
      
      if (!Array.isArray(suggestions) || suggestions.length === 0) {
        throw new Error('Invalid suggestions format');
      }

      console.log('✅ Generated', suggestions.length, 'suggestions');

      res.json({ 
        success: true, 
        suggestions: suggestions.slice(0, 5)
      });

    } catch (parseError) {
      console.error('❌ Failed to parse suggestions:', parseError);
      
      // Fallback: generic questions
      res.json({
        success: true,
        suggestions: [
          `What is the main purpose of ${document.originalName}?`,
          "Can you summarize the key points?",
          "What important information does this contain?",
          "What dates or numbers are mentioned?",
          "What action items are in this document?"
        ]
      });
    }

  } catch (error) {
    console.error('❌ Suggestion generation error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to generate suggestions',
      suggestions: [
        "What is this document about?",
        "Can you summarize this?",
        "What are the key points?"
      ]
    });
  }
});

// ===================================================================
// @route   DELETE /api/documents/:id
// @desc    Delete a document from local storage, S3, and vector store
// @access  Private
// ===================================================================
router.delete('/:id', protect, async (req, res) => {
  try {
    console.log('🗑️ Deleting document:', req.params.id);

    const document = await Document.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // 1. Delete physical file from local storage
    try {
      await fs.unlink(document.filepath);
      console.log('✅ Local file deleted:', document.filepath);
    } catch (fileError) {
      console.error('⚠️ Could not delete local file:', fileError.message);
    }

    // 2. Delete from S3
    if (document.s3Key) {
      try {
        await s3.deleteObject({
          Bucket: process.env.AWS_BUCKET_NAME,
          Key: document.s3Key
        }).promise();
        console.log('✅ S3 file deleted:', document.s3Key);
      } catch (s3Error) {
        console.error('⚠️ Could not delete from S3:', s3Error.message);
      }
    }

    // 3. Delete vectors from Pinecone
    if (document.vectorIds && document.vectorIds.length > 0) {
      try {
        await ragService.deleteDocument(document.vectorIds);
        console.log('✅ Vectors deleted from Pinecone');
      } catch (vectorError) {
        console.error('⚠️ Could not delete vectors:', vectorError.message);
      }
    }

    // 4. Delete from database
    await Document.deleteOne({ _id: document._id });
    console.log('✅ Document deleted from DB');

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete document'
    });
  }
});

// ===================================================================
// @route   PUT /api/documents/:id/rename
// @desc    Rename a document
// @access  Private
// ===================================================================
router.put('/:id/rename', protect, async (req, res) => {
  try {
    const { filename } = req.body;

    if (!filename) {
      return res.status(400).json({ error: 'filename is required' });
    }

    const document = await Document.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { originalName: filename.trim() },
      { new: true }
    );

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    console.log('✅ Document renamed:', document.originalName);

    res.json({
      success: true,
      document
    });

  } catch (error) {
    console.error('❌ Error renaming document:', error);
    res.status(500).json({
      error: 'Failed to rename document',
      message: error.message
    });
  }
});

// ===================================================================
// @route   POST /api/documents/bulk-delete
// @desc    Delete multiple documents
// @access  Private
// ===================================================================
router.post('/bulk-delete', protect, async (req, res) => {
  try {
    const { documentIds } = req.body;

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({ error: 'documentIds array is required' });
    }

    const result = await Document.deleteMany({ 
      _id: { $in: documentIds },
      userId: req.user._id 
    });

    console.log(`🗑️ Bulk deleted ${result.deletedCount} documents`);

    res.json({
      success: true,
      deletedCount: result.deletedCount,
      message: `${result.deletedCount} document(s) deleted successfully`
    });

  } catch (error) {
    console.error('❌ Error bulk deleting documents:', error);
    res.status(500).json({
      error: 'Failed to delete documents',
      message: error.message
    });
  }
});

// ===================================================================
// @route   GET /api/documents/search
// @desc    Search documents by name or content
// @access  Private
// ===================================================================
router.get('/search', protect, async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Search query (q) is required' });
    }

    const query = {
      userId: req.user._id,
      $or: [
        { originalName: { $regex: q, $options: 'i' } },
        { textContent: { $regex: q, $options: 'i' } }
      ]
    };

    const documents = await Document.find(query)
      .sort({ uploadedAt: -1 })
      .limit(20);

    console.log(`🔍 Search found ${documents.length} documents`);

    res.json({
      success: true,
      documents,
      count: documents.length
    });

  } catch (error) {
    console.error('❌ Error searching documents:', error);
    res.status(500).json({
      error: 'Failed to search documents',
      message: error.message
    });
  }
});

module.exports = router;