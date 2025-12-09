// Add this to your server.js or create a new health.js route

const { HfInference } = require('@huggingface/inference');

// Health check endpoint with AI service validation
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      huggingface: 'unknown',
      pinecone: 'unknown'
    },
    config: {
      aiGenerationEnabled: !!process.env.HUGGINGFACE_API_KEY,
      hasHuggingFaceKey: !!process.env.HUGGINGFACE_API_KEY,
      hasPineconeKey: !!process.env.PINECONE_API_KEY,
    }
  };

  // Test Hugging Face
  if (process.env.HUGGINGFACE_API_KEY) {
    try {
      const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);
      await Promise.race([
        hf.textGeneration({
          model: 'mistralai/Mistral-7B-Instruct-v0.2',
          inputs: 'test',
          parameters: { max_new_tokens: 5 }
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
      ]);
      health.services.huggingface = 'connected';
    } catch (error) {
      health.services.huggingface = `error: ${error.message}`;
      health.warnings = health.warnings || [];
      health.warnings.push('Hugging Face API is not responding correctly');
    }
  } else {
    health.services.huggingface = 'not_configured';
    health.warnings = health.warnings || [];
    health.warnings.push('HUGGINGFACE_API_KEY not set in environment');
  }

  // Test Pinecone
  try {
    const ragService = require('./services/ragService');
    await ragService.healthCheck();
    health.services.pinecone = 'connected';
  } catch (error) {
    health.services.pinecone = `error: ${error.message}`;
  }

  res.json(health);
});

// Debug endpoint to test AI generation directly
app.post('/api/test-ai', async (req, res) => {
  try {
    const { question, context } = req.body;
    
    if (!process.env.HUGGINGFACE_API_KEY) {
      return res.status(400).json({
        error: 'Hugging Face API key not configured',
        message: 'Please set HUGGINGFACE_API_KEY in your .env file'
      });
    }

    const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);
    
    const prompt = `Context: ${context || 'This is a test document about AI.'}

Question: ${question || 'What is this about?'}

Answer:`;

    console.log('🧪 Testing AI generation...');
    const startTime = Date.now();
    
    const response = await hf.textGeneration({
      model: 'mistralai/Mistral-7B-Instruct-v0.2',
      inputs: prompt,
      parameters: {
        max_new_tokens: 100,
        temperature: 0.7,
        return_full_text: false
      }
    });

    const duration = Date.now() - startTime;
    
    console.log('✅ AI test successful');
    
    res.json({
      success: true,
      answer: response.generated_text,
      duration_ms: duration,
      model: 'mistralai/Mistral-7B-Instruct-v0.2'
    });
    
  } catch (error) {
    console.error('❌ AI test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});