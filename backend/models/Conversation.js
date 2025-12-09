// backend/models/Conversation.js
const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['user', 'assistant'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

const conversationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  messages: [messageSchema],
  isStarred: {
    type: Boolean,
    default: false
  },
  tags: [{
    type: String,
    trim: true
  }]
}, {
  timestamps: true  // This automatically handles createdAt and updatedAt
});

// Compound index for efficient queries
conversationSchema.index({ userId: 1, documentId: 1, createdAt: -1 });
conversationSchema.index({ userId: 1, isStarred: 1 });

// Virtual for message count
conversationSchema.virtual('messageCount').get(function() {
  return this.messages.length;
});

// Method to add a message
conversationSchema.methods.addMessage = function(role, content) {
  this.messages.push({ role, content, timestamp: new Date() });
  // No need to manually set updatedAt - timestamps: true handles it
  return this.save();
};

module.exports = mongoose.model('Conversation', conversationSchema);