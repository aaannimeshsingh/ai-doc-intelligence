// backend/routes/export.js - UPDATED TO ACCEPT BOTH conversationId AND conversation array
const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');
const { protect } = require('../middleware/auth');

// ✅ UPDATED: Support BOTH conversationId AND conversation array
// POST /api/export/conversation/txt or /api/export/conversation/pdf
router.post('/conversation/:format', protect, async (req, res) => {
  try {
    const { format } = req.params;
    const { conversationId, conversation, documentName } = req.body;

    console.log('📤 Export request:', { 
      format, 
      conversationId, 
      hasConversationArray: !!conversation,
      documentName 
    });

    let conversationData;
    let docName = documentName || 'Document';
    let createdAt = new Date();

    // Option 1: Fetch from database using conversationId
    if (conversationId) {
      console.log('📥 Fetching conversation from database...');
      const conv = await Conversation.findById(conversationId)
        .populate('documentId');

      if (!conv) {
        return res.status(404).json({ 
          success: false, 
          message: 'Conversation not found' 
        });
      }

      conversationData = conv.messages;
      docName = conv.documentId?.originalName || docName;
      createdAt = conv.createdAt;
    } 
    // Option 2: Use conversation array directly from request
    else if (conversation && Array.isArray(conversation) && conversation.length > 0) {
      console.log('📦 Using conversation array from request...');
      // Transform frontend conversation format to backend format
      conversationData = conversation.flatMap(item => [
        { 
          role: 'user', 
          content: item.question, 
          timestamp: item.timestamp || new Date() 
        },
        { 
          role: 'assistant', 
          content: item.answer, 
          timestamp: item.timestamp || new Date() 
        }
      ]);
    } 
    // Option 3: No data provided
    else {
      return res.status(400).json({ 
        success: false, 
        message: 'Either conversationId or conversation array is required' 
      });
    }

    let content;
    let contentType;
    let filename;

    switch (format) {
      case 'json':
        content = JSON.stringify({
          document: docName,
          exportedAt: new Date(),
          messages: conversationData
        }, null, 2);
        contentType = 'application/json';
        filename = `conversation-${Date.now()}.json`;
        break;

      case 'txt':
        content = `Conversation Export\n`;
        content += `Document: ${docName}\n`;
        content += `Date: ${createdAt.toLocaleString()}\n`;
        content += `Exported: ${new Date().toLocaleString()}\n\n`;
        content += '='.repeat(60) + '\n\n';
        
        if (conversationData && conversationData.length > 0) {
          conversationData.forEach((msg, idx) => {
            content += `${msg.role === 'user' ? '👤 User' : '🤖 AI Assistant'}:\n`;
            content += `${msg.content}\n`;
            if (msg.timestamp) {
              content += `Time: ${new Date(msg.timestamp).toLocaleString()}\n`;
            }
            content += '\n';
            if (idx < conversationData.length - 1) {
              content += '-'.repeat(60) + '\n\n';
            }
          });
        } else {
          content += 'No messages found.\n';
        }
        
        content += '\n' + '='.repeat(60) + '\n';
        content += `Total messages: ${conversationData.length}\n`;
        
        contentType = 'text/plain; charset=utf-8';
        filename = `conversation-${Date.now()}.txt`;
        break;

      case 'csv':
        content = 'Role,Content,Timestamp\n';
        if (conversationData && conversationData.length > 0) {
          conversationData.forEach(msg => {
            const csvContent = (msg.content || '').replace(/"/g, '""').replace(/\n/g, ' ');
            const timestamp = msg.timestamp ? new Date(msg.timestamp).toISOString() : '';
            content += `"${msg.role}","${csvContent}","${timestamp}"\n`;
          });
        }
        
        contentType = 'text/csv';
        filename = `conversation-${Date.now()}.csv`;
        break;

      case 'pdf':
        // Simple PDF implementation using text format
        // For a real PDF, you'd want to use pdfkit or puppeteer
        content = `Conversation Export\n`;
        content += `Document: ${docName}\n`;
        content += `Date: ${createdAt.toLocaleString()}\n\n`;
        content += '='.repeat(60) + '\n\n';
        
        if (conversationData && conversationData.length > 0) {
          conversationData.forEach((msg) => {
            content += `${msg.role === 'user' ? 'User' : 'AI'}:\n${msg.content}\n\n`;
          });
        }
        
        // For now, return as plain text (you can add PDF library later)
        contentType = 'text/plain; charset=utf-8';
        filename = `conversation-${Date.now()}.pdf.txt`;
        
        console.log('⚠️ PDF format requested, returning as text. Install pdfkit for proper PDF support.');
        break;

      default:
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid format. Use txt, json, csv, or pdf' 
        });
    }

    console.log(`✅ Exporting conversation as ${format} (${conversationData.length} messages)`);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);

  } catch (error) {
    console.error('❌ Export error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to export conversation',
      error: error.message 
    });
  }
});

// POST /api/export/all-conversations - Export all conversations for a user
router.post('/all-conversations', protect, async (req, res) => {
  try {
    const { format = 'txt' } = req.body;
    const userId = req.user._id;

    console.log('📤 Exporting all conversations for user:', userId);

    const conversations = await Conversation.find({ userId })
      .populate('documentId')
      .sort({ createdAt: -1 });

    if (conversations.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'No conversations found' 
      });
    }

    let content;
    let contentType;
    let filename;

    switch (format) {
      case 'json':
        content = JSON.stringify(conversations, null, 2);
        contentType = 'application/json';
        filename = `all-conversations-${Date.now()}.json`;
        break;

      case 'txt':
        content = `All Conversations Export\n`;
        content += `Total: ${conversations.length}\n`;
        content += `Exported: ${new Date().toLocaleString()}\n\n`;
        content += '='.repeat(80) + '\n\n';
        
        conversations.forEach((conv, idx) => {
          content += `Conversation ${idx + 1}: ${conv.title}\n`;
          content += `Document: ${conv.documentId?.originalName || 'Unknown'}\n`;
          content += `Date: ${new Date(conv.createdAt).toLocaleString()}\n`;
          content += '-'.repeat(80) + '\n';
          
          if (conv.messages && conv.messages.length > 0) {
            conv.messages.forEach(msg => {
              content += `${msg.role === 'user' ? '👤 User' : '🤖 AI'}: ${msg.content}\n`;
              if (msg.timestamp) {
                content += `Time: ${new Date(msg.timestamp).toLocaleTimeString()}\n`;
              }
              content += '\n';
            });
          }
          
          content += '='.repeat(80) + '\n\n';
        });
        
        contentType = 'text/plain; charset=utf-8';
        filename = `all-conversations-${Date.now()}.txt`;
        break;

      default:
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid format. Use json or txt' 
        });
    }

    console.log(`✅ Exported ${conversations.length} conversations as ${format}`);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);

  } catch (error) {
    console.error('❌ Export all error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to export conversations',
      error: error.message 
    });
  }
});

module.exports = router;