// backend/routes/query.js - Updated with Settings Support
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Document = require('../models/Document');
const Groq = require('groq-sdk');
const ragService = require('../services/ragService');
const Conversation = require('../models/Conversation');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// @route   POST /api/query
// @desc    Query documents with AI - WITH CUSTOM SETTINGS SUPPORT! ✅
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const { question, documentId, settings } = req.body;

    // Extract settings with defaults ✅
const {
  aiModel: requestedModel = 'llama-3.3-70b-versatile',
  temperature = 0.7,
  maxTokens = 2000,
  topK = 3,
  chunkSize = 1000
} = settings || {};

// ✅ Map deprecated/invalid model names to currently supported Groq models
const MODEL_MAP = {
  'llama-3.1-8b-instant': 'openai/gpt-oss-20b',
  'llama-3.3-70b-versatile': 'openai/gpt-oss-120b'
};
const VALID_MODELS = new Set(['openai/gpt-oss-20b', 'openai/gpt-oss-120b', 'qwen/qwen3.6-27b']);

const aiModel = VALID_MODELS.has(requestedModel)
  ? requestedModel
  : (MODEL_MAP[requestedModel] || 'openai/gpt-oss-20b');

    if (!question || !question.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Question is required'
      });
    }

    console.log('🔍 Query from user:', req.user.email);
    console.log('📄 Document ID:', documentId || 'ALL');
    console.log('❓ Question:', question);
    console.log('🔧 Settings:', { aiModel, temperature, maxTokens, topK, chunkSize });

    // Build query filter
    const query = { userId: req.user._id };
    if (documentId && documentId !== 'all') {
      query._id = documentId;
      console.log('🎯 Filtering by specific document');
    }

    // Get documents
    const documents = await Document.find(query)
      .select('originalName textContent vectorIds')
      .sort({ uploadedAt: -1 });

    console.log(`✅ Found ${documents.length} document(s)`);

    if (documents.length === 0) {
      return res.json({
        success: false,
        message: 'No documents found. Please upload documents first.',
        answer: '📚 No documents found in your library.'
      });
    }

    // Check if documents have text content
    const docsWithText = documents.filter(d => d.textContent && d.textContent.trim().length > 0);
    
    if (docsWithText.length === 0) {
      return res.json({
        success: false,
        message: 'Documents are still being processed. Please wait a moment.',
        answer: '⏳ Your documents are being processed. Please try again in a few seconds.'
      });
    }

    console.log(`📝 ${docsWithText.length} document(s) have text content`);

    // Try RAG search first (vector-based)
    let context = '';
    let sources = [];
    let usedRAG = false;

    try {
      if (documentId && documentId !== 'all') {
        console.log('🔍 Trying RAG search for specific document...');
        const chunks = await ragService.queryDocuments(question, documentId, topK);
        
        if (chunks && chunks.length > 0) {
          console.log(`✅ Found ${chunks.length} relevant chunks via RAG`);
          
          const topChunks = chunks.slice(0, topK);
          context = topChunks.map(chunk => chunk.text).join('\n\n---\n\n');
          
          const maxContextLength = chunkSize * topK;
          if (context.length > maxContextLength) {
            console.log(`⚠️ Context too long (${context.length} chars), truncating to ${maxContextLength}`);
            context = context.substring(0, maxContextLength);
          }
          
          sources = topChunks.map(chunk => ({
            text: chunk.text.substring(0, 300) + '...',
            score: chunk.score,
            documentName: documents[0]?.originalName
          }));
          
          usedRAG = true;
        }
      }
    } catch (ragError) {
      console.warn('⚠️ RAG search failed, falling back to direct text search:', ragError.message);
    }

    // Fallback: Use direct text content
    if (!usedRAG || !context) {
      console.log('📝 Using direct text content (no RAG)');
      
      if (documentId && documentId !== 'all') {
        const doc = docsWithText[0];
        const maxLength = chunkSize * topK;
        context = doc.textContent.substring(0, maxLength);
        console.log(`📄 Using text from: ${doc.originalName} (${context.length} chars)`);
      } else {
        context = docsWithText
          .map(d => `[${d.originalName}]\n${d.textContent}`)
          .join('\n\n---\n\n')
          .substring(0, chunkSize * topK);
        console.log(`📚 Combined text from ${docsWithText.length} documents (${context.length} chars)`);
      }
    }

    console.log('🤖 Generating answer with Groq...');
    console.log(`🤖 Model: ${aiModel}, Temperature: ${temperature}, Max Tokens: ${maxTokens}`);

    // Generate answer with custom settings
    const completion = await groq.chat.completions.create({
      model: aiModel,
      messages: [
        {
          role: "system",
          content: `You are a helpful AI assistant. Answer questions based ONLY on the provided document content. 
If the answer is not in the document, clearly state that you cannot find that information.
Be concise and accurate. Do not make up information.`
        },
        {
          role: "user",
          content: `Document Content:\n\n${context}\n\n---\n\nQuestion: ${question}\n\nAnswer:`
        }
      ],
      max_tokens: maxTokens,
      temperature: temperature
    });

    const answer = completion.choices[0].message.content.trim();

    console.log('✅ Answer generated successfully');
    console.log(`📊 Method: ${usedRAG ? 'RAG (vector search)' : 'Direct text search'}`);

    // Increment document query count
    if (documentId && documentId !== 'all') {
      await Document.findByIdAndUpdate(documentId, {
        $inc: { queryCount: 1 }
      });
    }

    // 🔥 Auto-save conversation and RETURN THE ID
    let conversationId = null;
    try {
      if (documentId && documentId !== 'all') {
        const conversationTitle = question.length > 60 
          ? question.substring(0, 60) + '...' 
          : question;

        const newConversation = await Conversation.create({
          userId: req.user._id,
          documentId: documents[0]._id,
          title: conversationTitle,
          messages: [
            { role: 'user', content: question },
            { role: 'assistant', content: answer }
          ]
        });

        conversationId = newConversation._id; // 🔥 Store the ID
        console.log('✅ Created new conversation:', conversationId);
      }
    } catch (convError) {
      console.error('⚠️ Failed to save conversation:', convError.message);
    }

    res.json({
      success: true,
      answer,
      sources,
      conversationId, // 🔥 RETURN THE CONVERSATION ID
      method: usedRAG ? 'vector' : 'direct',
      documentsSearched: docsWithText.length,
      documentNames: docsWithText.map(d => d.originalName),
      settingsUsed: { aiModel, temperature, maxTokens, topK, chunkSize }
    });

  } catch (error) {
    console.error('❌ Query error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to process query',
      answer: '❌ Sorry, an error occurred while processing your question.'
    });
  }
});

module.exports = router;
