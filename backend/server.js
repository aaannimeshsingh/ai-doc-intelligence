// backend/server.js - PRODUCTION READY VERSION
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Groq = require('groq-sdk');
require('dotenv').config();

const app = express();

// ===================================================================
// MIDDLEWARE
// ===================================================================

// Dynamic CORS Configuration for Production & Development
const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? [process.env.FRONTEND_URL] 
  : ['http://localhost:3000', 'http://localhost:3001'];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Trust proxy (for Render/Railway deployment)
app.set('trust proxy', 1);

// ===================================================================
// ROUTES
// ===================================================================

const documentRoutes = require('./routes/documents');
const queryRoutes = require('./routes/query');
const authRoutes = require('./routes/auth');
const analyticsRoutes = require('./routes/analytics');
const exportRoutes = require('./routes/export');
const conversationRoutes = require('./routes/conversationRoutes');

// Register routes
app.use('/api/documents', documentRoutes);
app.use('/api/query', queryRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/conversations', conversationRoutes);

// ===================================================================
// HEALTH CHECK ENDPOINT
// ===================================================================

app.get('/api/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    services: {
      mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      groq: 'unknown',
      pinecone: 'unknown'
    }
  };

  // Test Groq
  if (process.env.GROQ_API_KEY) {
    try {
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      await Promise.race([
        groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: "test" }],
          max_tokens: 5
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
      ]);
      health.services.groq = 'connected';
    } catch (error) {
      health.services.groq = `error: ${error.message}`;
    }
  } else {
    health.services.groq = 'not_configured';
  }

  // Test Pinecone
  try {
    const ragService = require('./services/ragService');
    const pineconeHealthy = await ragService.healthCheck();
    health.services.pinecone = pineconeHealthy ? 'connected' : 'error';
  } catch (error) {
    health.services.pinecone = `error: ${error.message}`;
  }

  res.json(health);
});

// ===================================================================
// ERROR HANDLERS
// ===================================================================

// General error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(err.status || 500).json({ 
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    success: false 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not found',
    success: false,
    path: req.path 
  });
});

// ===================================================================
// START SERVER
// ===================================================================

async function startServer() {
  const PORT = process.env.PORT || 5001;
  const ENV = process.env.NODE_ENV || 'development';
  
  console.log('\n' + '='.repeat(60));
  console.log('🚀 AI Document Intelligence Server');
  console.log('='.repeat(60));
  console.log(`📌 Environment: ${ENV}`);
  console.log(`📌 Port: ${PORT}`);
  
  try {
    // Connect to MongoDB
    console.log('\n🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ MongoDB Connected:', mongoose.connection.name);
    
  } catch (error) {
    console.error('❌ MongoDB failed:', error.message);
    process.exit(1);
  }

  // Start Express server
  app.listen(PORT, () => {
    console.log(`\n📡 Server running on port ${PORT}`);
    console.log(`📊 Health: /api/health`);
    console.log('='.repeat(60) + '\n');
  });
}

// MongoDB error handlers
mongoose.connection.on('error', (err) => {
  console.error('❌ MongoDB error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ MongoDB reconnected');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⚠️  Shutting down gracefully...');
  await mongoose.connection.close();
  console.log('✅ MongoDB connection closed');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⚠️  SIGTERM received, shutting down...');
  await mongoose.connection.close();
  console.log('✅ MongoDB connection closed');
  process.exit(0);
});

// Start the server
startServer().catch(error => {
  console.error('❌ Failed to start:', error);
  process.exit(1);
});