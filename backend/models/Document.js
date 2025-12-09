// backend/models/Document.js
const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    // User reference
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // File information
    originalName: { 
      type: String, 
      required: true 
    },
    filename: { 
      type: String 
    },
    mimetype: { 
      type: String, 
      required: true 
    },
    size: { 
      type: Number, 
      required: true 
    },

    // Local storage (temporary - for processing)
    filepath: { 
      type: String 
    },

    // S3 Storage (permanent - for long-term storage)
    s3Key: { 
      type: String,
      index: true 
    },
    s3Url: { 
      type: String 
    },
    s3Region: { 
      type: String,
      default: process.env.AWS_REGION 
    },

    // Document content
    textContent: { 
      type: String, 
      default: '' 
    },

    // Vector database references (Pinecone)
    vectorIds: [{ 
      type: String 
    }],

    // Processing status
    uploadedAt: { 
      type: Date, 
      default: Date.now,
      index: true 
    },
    processedAt: { 
      type: Date 
    },
    
    // Document metadata
    metadata: {
      pageCount: Number,
      wordCount: Number,
      language: String,
      author: String,
      title: String,
      createdDate: Date,
    },

    // Tags and categorization
    tags: [{ 
      type: String 
    }],
    autoTags: [{ 
      type: String 
    }],
    category: { 
      type: String, 
      enum: ['receipt', 'contract', 'report', 'invoice', 'letter', 'other'],
      default: 'other'
    },

    // Sharing and collaboration
    isShared: { 
      type: Boolean, 
      default: false 
    },
    sharedWith: [{ 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User' 
    }],

    // Analytics
    viewCount: { 
      type: Number, 
      default: 0 
    },
    queryCount: { 
      type: Number, 
      default: 0 
    },
    lastAccessedAt: { 
      type: Date 
    },

    // Status flags
    isDeleted: { 
      type: Boolean, 
      default: false 
    },
    deletedAt: { 
      type: Date 
    },
  },
  { 
    timestamps: true // Automatically adds createdAt and updatedAt
  }
);

// ===================================================================
// INDEXES FOR PERFORMANCE
// ===================================================================

// Compound indexes for common queries
documentSchema.index({ userId: 1, uploadedAt: -1 });
documentSchema.index({ userId: 1, category: 1 });
documentSchema.index({ userId: 1, tags: 1 });
documentSchema.index({ userId: 1, isDeleted: 1 });

// Text index for search functionality
documentSchema.index({ 
  originalName: 'text', 
  textContent: 'text',
  tags: 'text' 
});

// ===================================================================
// VIRTUAL FIELDS
// ===================================================================

// Check if document is indexed in vector store
documentSchema.virtual('isIndexed').get(function() {
  return this.vectorIds && this.vectorIds.length > 0;
});

// Check if document has text content
documentSchema.virtual('hasText').get(function() {
  return this.textContent && this.textContent.trim().length > 0;
});

// Get storage location (local or S3)
documentSchema.virtual('storageLocation').get(function() {
  if (this.s3Key) return 's3';
  if (this.filepath) return 'local';
  return 'none';
});

// Calculate word count if not stored
documentSchema.virtual('calculatedWordCount').get(function() {
  if (this.metadata && this.metadata.wordCount) {
    return this.metadata.wordCount;
  }
  if (this.textContent) {
    return this.textContent.trim().split(/\s+/).length;
  }
  return 0;
});

// Format file size
documentSchema.virtual('formattedSize').get(function() {
  if (!this.size) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(this.size) / Math.log(k));
  return `${Math.round(this.size / Math.pow(k, i) * 100) / 100} ${sizes[i]}`;
});

// ===================================================================
// INSTANCE METHODS
// ===================================================================

// Mark document as accessed (for analytics)
documentSchema.methods.markAccessed = async function() {
  this.viewCount += 1;
  this.lastAccessedAt = new Date();
  return this.save();
};

// Increment query count
documentSchema.methods.incrementQueryCount = async function() {
  this.queryCount += 1;
  return this.save();
};

// Soft delete (mark as deleted instead of removing)
documentSchema.methods.softDelete = async function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

// Add tags
documentSchema.methods.addTags = async function(newTags) {
  if (!Array.isArray(newTags)) newTags = [newTags];
  this.tags = [...new Set([...this.tags, ...newTags])];
  return this.save();
};

// Remove tags
documentSchema.methods.removeTags = async function(tagsToRemove) {
  if (!Array.isArray(tagsToRemove)) tagsToRemove = [tagsToRemove];
  this.tags = this.tags.filter(tag => !tagsToRemove.includes(tag));
  return this.save();
};

// Update metadata
documentSchema.methods.updateMetadata = async function(metadata) {
  this.metadata = { ...this.metadata, ...metadata };
  return this.save();
};

// ===================================================================
// STATIC METHODS
// ===================================================================

// Find documents by user
documentSchema.statics.findByUser = function(userId) {
  return this.find({ userId, isDeleted: false }).sort({ uploadedAt: -1 });
};

// Find documents by category
documentSchema.statics.findByCategory = function(userId, category) {
  return this.find({ userId, category, isDeleted: false }).sort({ uploadedAt: -1 });
};

// Find documents by tags
documentSchema.statics.findByTags = function(userId, tags) {
  if (!Array.isArray(tags)) tags = [tags];
  return this.find({ 
    userId, 
    tags: { $in: tags },
    isDeleted: false 
  }).sort({ uploadedAt: -1 });
};

// Search documents
documentSchema.statics.search = function(userId, searchQuery) {
  return this.find({
    userId,
    isDeleted: false,
    $text: { $search: searchQuery }
  }, {
    score: { $meta: 'textScore' }
  }).sort({ score: { $meta: 'textScore' } });
};

// Get user statistics
documentSchema.statics.getUserStats = async function(userId) {
  const stats = await this.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), isDeleted: false } },
    {
      $group: {
        _id: null,
        totalDocuments: { $sum: 1 },
        totalSize: { $sum: '$size' },
        totalQueries: { $sum: '$queryCount' },
        totalViews: { $sum: '$viewCount' },
        avgSize: { $avg: '$size' },
      }
    }
  ]);

  return stats[0] || {
    totalDocuments: 0,
    totalSize: 0,
    totalQueries: 0,
    totalViews: 0,
    avgSize: 0
  };
};

// Get popular documents
documentSchema.statics.getMostQueried = function(userId, limit = 5) {
  return this.find({ userId, isDeleted: false })
    .sort({ queryCount: -1 })
    .limit(limit);
};

// Get recently accessed documents
documentSchema.statics.getRecentlyAccessed = function(userId, limit = 5) {
  return this.find({ 
    userId, 
    isDeleted: false,
    lastAccessedAt: { $exists: true } 
  })
    .sort({ lastAccessedAt: -1 })
    .limit(limit);
};

// Find documents needing processing (no vectorIds)
documentSchema.statics.findUnprocessed = function(userId) {
  return this.find({
    userId,
    isDeleted: false,
    textContent: { $exists: true, $ne: '' },
    $or: [
      { vectorIds: { $exists: false } },
      { vectorIds: { $size: 0 } }
    ]
  });
};

// ===================================================================
// MIDDLEWARE (HOOKS)
// ===================================================================

// Pre-save hook - calculate word count if text content exists
documentSchema.pre('save', function() {
  if (this.isModified('textContent') && this.textContent) {
    const wordCount = this.textContent.trim().split(/\s+/).length;
    if (!this.metadata) this.metadata = {};
    this.metadata.wordCount = wordCount;
  }
});

// Pre-find hook - exclude soft-deleted documents by default
documentSchema.pre(/^find/, function() {
  // Only apply if isDeleted is not explicitly set in the query
  const query = this.getQuery();
  if (query.isDeleted === undefined) {
    this.where({ isDeleted: { $ne: true } });
  }
});

// ===================================================================
// VIRTUAL POPULATION (Enable virtuals in JSON/Object conversion)
// ===================================================================

documentSchema.set('toJSON', { virtuals: true });
documentSchema.set('toObject', { virtuals: true });

// ===================================================================
// MODEL EXPORT
// ===================================================================

const Document = mongoose.model('Document', documentSchema);

module.exports = Document;