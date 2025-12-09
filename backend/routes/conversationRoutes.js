// backend/routes/conversationRoutes.js
const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');
const Document = require('../models/Document');

/**
 * @route   POST /api/conversations
 * @desc    Create a new conversation
 * @access  Public (add auth middleware later)
 */
router.post('/', async (req, res) => {
  try {
    const { userId, documentId, question, answer } = req.body;

    if (!userId || !documentId || !question || !answer) {
      return res.status(400).json({ 
        error: 'userId, documentId, question, and answer are required' 
      });
    }

    // Get document name for conversation title
    const document = await Document.findById(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Create title from first question (truncate if too long)
    const title = question.length > 60 
      ? question.substring(0, 60) + '...' 
      : question;

    const conversation = new Conversation({
      userId,
      documentId,
      title,
      messages: [
        { role: 'user', content: question },
        { role: 'assistant', content: answer }
      ]
    });

    await conversation.save();
    
    console.log('✅ Conversation created:', conversation._id);

    res.status(201).json({
      success: true,
      conversation
    });

  } catch (error) {
    console.error('❌ Error creating conversation:', error);
    res.status(500).json({
      error: 'Failed to create conversation',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/conversations
 * @desc    Get all conversations for a user
 * @access  Public
 */
router.get('/', async (req, res) => {
  try {
    const { userId, documentId, starred } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Build query
    const query = { userId };
    if (documentId) query.documentId = documentId;
    if (starred === 'true') query.isStarred = true;

    const conversations = await Conversation.find(query)
      .populate('documentId', 'filename')
      .sort({ updatedAt: -1 })
      .lean();

    console.log(`📚 Found ${conversations.length} conversations for user ${userId}`);

    res.json({
      success: true,
      conversations,
      count: conversations.length
    });

  } catch (error) {
    console.error('❌ Error fetching conversations:', error);
    res.status(500).json({
      error: 'Failed to fetch conversations',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/conversations/:id
 * @desc    Get a single conversation by ID
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id)
      .populate('documentId', 'filename');

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({
      success: true,
      conversation
    });

  } catch (error) {
    console.error('❌ Error fetching conversation:', error);
    res.status(500).json({
      error: 'Failed to fetch conversation',
      message: error.message
    });
  }
});

/**
 * @route   PUT /api/conversations/:id/messages
 * @desc    Add a message to an existing conversation
 * @access  Public
 */
router.put('/:id/messages', async (req, res) => {
  try {
    const { question, answer } = req.body;

    if (!question || !answer) {
      return res.status(400).json({ 
        error: 'question and answer are required' 
      });
    }

    const conversation = await Conversation.findById(req.params.id);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Add messages
    conversation.messages.push({ role: 'user', content: question });
    conversation.messages.push({ role: 'assistant', content: answer });
    conversation.updatedAt = Date.now();

    await conversation.save();

    console.log('✅ Messages added to conversation:', conversation._id);

    res.json({
      success: true,
      conversation
    });

  } catch (error) {
    console.error('❌ Error adding messages:', error);
    res.status(500).json({
      error: 'Failed to add messages',
      message: error.message
    });
  }
});

/**
 * @route   PUT /api/conversations/:id/star
 * @desc    Toggle star status of a conversation
 * @access  Public
 */
router.put('/:id/star', async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    conversation.isStarred = !conversation.isStarred;
    await conversation.save();

    console.log(`⭐ Conversation ${conversation._id} starred: ${conversation.isStarred}`);

    res.json({
      success: true,
      conversation,
      isStarred: conversation.isStarred
    });

  } catch (error) {
    console.error('❌ Error toggling star:', error);
    res.status(500).json({
      error: 'Failed to toggle star',
      message: error.message
    });
  }
});

/**
 * @route   PUT /api/conversations/:id
 * @desc    Update conversation title
 * @access  Public
 */
router.put('/:id', async (req, res) => {
  try {
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'title is required' });
    }

    const conversation = await Conversation.findByIdAndUpdate(
      req.params.id,
      { title, updatedAt: Date.now() },
      { new: true }
    );

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    console.log('✅ Conversation title updated:', conversation._id);

    res.json({
      success: true,
      conversation
    });

  } catch (error) {
    console.error('❌ Error updating conversation:', error);
    res.status(500).json({
      error: 'Failed to update conversation',
      message: error.message
    });
  }
});

/**
 * @route   DELETE /api/conversations/:id
 * @desc    Delete a conversation
 * @access  Public
 */
router.delete('/:id', async (req, res) => {
  try {
    const conversation = await Conversation.findByIdAndDelete(req.params.id);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    console.log('🗑️ Conversation deleted:', req.params.id);

    res.json({
      success: true,
      message: 'Conversation deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting conversation:', error);
    res.status(500).json({
      error: 'Failed to delete conversation',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/conversations/search
 * @desc    Search conversations
 * @access  Public
 */
router.post('/search', async (req, res) => {
  try {
    const { userId, searchTerm } = req.body;

    if (!userId || !searchTerm) {
      return res.status(400).json({ 
        error: 'userId and searchTerm are required' 
      });
    }

    const conversations = await Conversation.find({
      userId,
      $or: [
        { title: { $regex: searchTerm, $options: 'i' } },
        { 'messages.content': { $regex: searchTerm, $options: 'i' } }
      ]
    })
      .populate('documentId', 'filename')
      .sort({ updatedAt: -1 })
      .limit(20);

    console.log(`🔍 Search found ${conversations.length} conversations`);

    res.json({
      success: true,
      conversations,
      count: conversations.length
    });

  } catch (error) {
    console.error('❌ Error searching conversations:', error);
    res.status(500).json({
      error: 'Failed to search conversations',
      message: error.message
    });
  }
});

module.exports = router;