// aiController.js - Groq Version (FREE and FAST!)
const ragService = require('../services/ragService');
const Document = require('../models/Document');
const Groq = require('groq-sdk');

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

exports.queryDocuments = async (req, res) => {
  try {
    const { question, documentId } = req.body;
    
    console.log('=== QUERY DEBUG START ===');
    console.log('Question:', question);
    
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const docCount = await Document.countDocuments();
    if (docCount === 0) {
      return res.json({
        question,
        answer: '📚 No documents found. Please upload documents first.',
        sources: [],
        chunksFound: 0
      });
    }

    const processedDocs = await Document.countDocuments({ 
      vectorIds: { $exists: true, $ne: [] } 
    });

    if (processedDocs === 0) {
      return res.json({
        question,
        answer: '⚠️ Documents are being processed. Try again in a moment.',
        sources: [],
        chunksFound: 0
      });
    }

    // Query vectors
    console.log('🔍 Searching...');
    const relevantChunks = await ragService.queryDocuments(question, documentId);
    console.log('✅ Found', relevantChunks.length, 'chunks');

    if (!relevantChunks || relevantChunks.length === 0) {
      return res.json({
        question,
        answer: '❌ No relevant information found.',
        sources: [],
        chunksFound: 0
      });
    }

    // Get documents
    const chunksByDocument = new Map();
    for (const chunk of relevantChunks) {
      const docId = chunk.metadata?.documentId || 'unknown';
      if (!chunksByDocument.has(docId)) {
        chunksByDocument.set(docId, []);
      }
      chunksByDocument.get(docId).push(chunk);
    }

    const documentIds = Array.from(chunksByDocument.keys()).filter(id => id !== 'unknown');
    const documents = await Document.find({ _id: { $in: documentIds } });
    const docMap = new Map(documents.map(d => [d._id.toString(), d]));

    // Get top chunks
    const threshold = 0.1;
    let highConfidenceChunks = relevantChunks.filter(chunk => chunk.score >= threshold);
    if (highConfidenceChunks.length === 0) {
      highConfidenceChunks = relevantChunks.slice(0, 3);
    }
    const topChunks = highConfidenceChunks.slice(0, 5);
    
    // Build context
    const contextParts = topChunks.map((chunk) => {
      const doc = docMap.get(chunk.metadata?.documentId);
      return `[${doc?.originalName || 'Document'}]\n${chunk.text}`;
    });
    const context = contextParts.join('\n\n---\n\n');

    console.log('🤖 Generating answer with Groq...');
    
    // Generate with Groq
    let answer;
    try {
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile", // Updated to newer model
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant. Answer questions using ONLY the provided context. Be concise and natural."
          },
          {
            role: "user",
            content: `Context:\n${context}\n\nQuestion: ${question}\n\nAnswer:`
          }
        ],
        max_tokens: 400,
        temperature: 0.6
      });

      answer = completion.choices[0].message.content.trim();
      console.log('✅ Answer generated');
      
    } catch (aiError) {
      console.error('❌ AI error:', aiError.message);
      answer = `Based on your documents:\n\n`;
      topChunks.slice(0, 3).forEach((chunk, idx) => {
        answer += `${idx + 1}. ${chunk.text.substring(0, 200)}...\n\n`;
      });
    }

    const documentsSearched = Array.from(chunksByDocument.entries())
      .filter(([docId]) => docId !== 'unknown')
      .map(([docId, chunks]) => {
        const doc = docMap.get(docId);
        return {
          id: docId,
          name: doc?.originalName || 'Unknown',
          chunksFound: chunks.length
        };
      });

    res.json({
      question,
      answer,
      sources: topChunks.map(c => {
        const doc = docMap.get(c.metadata?.documentId);
        return {
          text: c.text.substring(0, 300) + '...',
          score: c.score,
          documentName: doc?.originalName || 'Unknown'
        };
      }),
      chunksFound: relevantChunks.length,
      documentsSearched
    });

  } catch (error) {
    console.error('=== ERROR ===', error);
    res.status(500).json({ 
      error: 'Query failed',
      message: error.message
    });
  }
};