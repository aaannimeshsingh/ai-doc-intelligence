// backend/routes/analytics.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Document = require('../models/Document');
const Conversation = require('../models/Conversation');

// GET /api/analytics - Get analytics data for a user
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID required' 
      });
    }

    console.log('📊 Fetching analytics for user:', userId);

    // Get total documents
    const totalDocuments = await Document.countDocuments({ userId });

    // Get total conversations
    const totalConversations = await Conversation.countDocuments({ userId });

    // Get total queries (sum of all messages in conversations)
    const conversations = await Conversation.find({ userId });
    const totalQueries = conversations.reduce((sum, conv) => {
      return sum + (conv.messages?.length || 0);
    }, 0);

    // Get total storage used
    const documents = await Document.find({ userId });
    const totalStorage = documents.reduce((sum, doc) => {
      return sum + (doc.size || 0); // ✅ FIXED: Changed from fileSize to size
    }, 0);

    // Group documents by type
    const documentsByType = {};
    documents.forEach(doc => {
      const ext = doc.filename?.split('.').pop()?.toLowerCase() || 'unknown';
      if (!documentsByType[ext]) {
        documentsByType[ext] = { count: 0, totalSize: 0 };
      }
      documentsByType[ext].count++;
      documentsByType[ext].totalSize += doc.size || 0; // ✅ FIXED: Changed from fileSize to size
    });

    // Get most active documents (by query count)
    let mostActiveDocuments = [];
    try {
      const activeDocsData = await Conversation.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        { 
          $group: { 
            _id: '$documentId', 
            queryCount: { $sum: { $size: '$messages' } } 
          } 
        },
        { $sort: { queryCount: -1 } },
        { $limit: 5 }
      ]);

      mostActiveDocuments = await Promise.all(
        activeDocsData.map(async (item) => {
          const doc = await Document.findById(item._id);
          if (!doc) return null;
          
          return { 
            _id: doc._id,
            filename: doc.originalName,
            fileSize: doc.size, // ✅ Return as fileSize for frontend compatibility
            uploadDate: doc.uploadedAt,
            queryCount: item.queryCount 
          };
        })
      );
      mostActiveDocuments = mostActiveDocuments.filter(Boolean);
    } catch (err) {
      console.error('Error getting active documents:', err);
    }

    // Get recent activity (uploads and conversations)
    const recentUploads = documents
      .sort((a, b) => new Date(b.uploadedAt || b.createdAt) - new Date(a.uploadedAt || a.createdAt))
      .slice(0, 3)
      .map(doc => ({
        type: 'upload',
        documentId: {
          _id: doc._id,
          filename: doc.originalName
        },
        timestamp: doc.uploadedAt || doc.createdAt
      }));

    const recentConversations = await Conversation.find({ userId })
      .sort({ updatedAt: -1 })
      .limit(3)
      .populate('documentId');

    const recentActivity = [
      ...recentUploads,
      ...recentConversations.map(conv => ({
        type: 'conversation',
        title: conv.title,
        documentId: conv.documentId,
        messages: conv.messages,
        timestamp: conv.updatedAt
      }))
    ]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 5);

    // Upload timeline (last 7 days)
    const uploadTimeline = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const count = await Document.countDocuments({
        userId,
        uploadedAt: { $gte: date, $lt: nextDate } // ✅ FIXED: Changed from uploadDate to uploadedAt
      });

      uploadTimeline.push({
        date: date.toISOString().split('T')[0],
        count
      });
    }

    console.log('✅ Analytics generated successfully');

    res.json({
      success: true,
      analytics: {
        totalDocuments,
        totalConversations,
        totalQueries,
        totalStorage,
        documentsByType,
        mostActiveDocuments,
        recentActivity,
        uploadTimeline
      }
    });

  } catch (error) {
    console.error('❌ Analytics error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch analytics',
      error: error.message 
    });
  }
});

// GET /api/analytics/summary - Get quick summary stats
router.get('/summary', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID required' 
      });
    }

    const totalDocuments = await Document.countDocuments({ userId });
    const totalConversations = await Conversation.countDocuments({ userId });

    res.json({
      success: true,
      summary: {
        totalDocuments,
        totalConversations
      }
    });

  } catch (error) {
    console.error('❌ Analytics summary error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch summary',
      error: error.message 
    });
  }
});

module.exports = router;