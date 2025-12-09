// backend/routes/upload.js - FIXED VERSION FOR RAG
// Add this section to your existing documents.js upload route

// ===================================================================
// CRITICAL FIX: Ensure document is indexed IMMEDIATELY after creation
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

    // 1. Extract text content
    console.log('📝 Extracting text from:', req.file.originalname);
    let textContent = await extractTextFromFile(req.file.path, req.file.mimetype);
    
    // 1.5. Try OCR if needed
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

    // 3. Create document record
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

    // 4. ✅ CRITICAL: Index in vector store IMMEDIATELY
    let indexingSuccess = false;
    let indexingError = null;

    if (textContent && textContent.trim().length > 50) { // Need at least 50 chars
      try {
        console.log('🔄 Starting vector indexing...');
        console.log('📌 Document ID:', document._id.toString());
        console.log('📏 Text length:', textContent.length);
        
        // ✅ Pass document ID as STRING (critical!)
        const vectorIds = await ragService.indexDocument(
          document._id.toString(), 
          textContent
        );
        
        if (vectorIds && vectorIds.length > 0) {
          document.vectorIds = vectorIds;
          document.processedAt = new Date();
          await document.save();
          
          indexingSuccess = true;
          console.log('✅ Document indexed successfully:', vectorIds.length, 'vectors');
          
          // ✅ VERIFY: Test if we can query it immediately
          console.log('🔍 Verifying indexing...');
          const testQuery = await ragService.queryDocuments(
            'test query', 
            document._id.toString(), 
            1
          );
          console.log('✅ Verification:', testQuery.length > 0 ? 'SUCCESS' : 'PENDING');
          
        } else {
          throw new Error('No vectors created');
        }
        
      } catch (indexError) {
        console.error('❌ Vector indexing failed:', indexError);
        indexingError = indexError.message;
        // Don't fail the entire upload, just flag it
      }
    } else {
      console.warn('⚠️ Text too short for indexing (< 50 chars)');
      indexingError = 'Text too short for indexing';
    }

    // 5. Return response with indexing status
    res.status(201).json({
      success: true,
      message: indexingSuccess 
        ? 'Document uploaded and indexed successfully' 
        : 'Document uploaded (indexing pending)',
      document: {
        id: document._id,
        originalName: document.originalName,
        size: document.size,
        uploadedAt: document.uploadedAt,
        hasText: textContent.length > 0,
        textLength: textContent.length,
        isIndexed: indexingSuccess,
        vectorCount: document.vectorIds?.length || 0,
        s3Url: document.s3Url,
        indexingError: indexingError
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