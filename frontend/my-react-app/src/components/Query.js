// src/components/Query.js - WITH SETTINGS SUPPORT ✅
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../utils/api';
import './Query.css';

const Query = () => {
  const { user, logout } = useAuth();
  const { showError } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [question, setQuestion] = useState('');
  const [conversation, setConversation] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentConversationId, setCurrentConversationId] = useState(null);

  // ✅ NEW: Load settings from localStorage
  const [settings, setSettings] = useState({
    aiModel: localStorage.getItem('aiModel') || 'llama-3.3-70b-versatile',
    temperature: parseFloat(localStorage.getItem('temperature') || '0.7'),
    maxTokens: parseInt(localStorage.getItem('maxTokens') || '2000'),
    topK: parseInt(localStorage.getItem('topK') || '3'),
    chunkSize: parseInt(localStorage.getItem('chunkSize') || '1000')
  });

  // ✅ NEW: Listen for settings changes from Settings page
  useEffect(() => {
    const handleSettingsChange = (event) => {
      console.log('⚙️ Settings changed:', event.detail);
      setSettings({
        aiModel: localStorage.getItem('aiModel') || 'llama-3.3-70b-versatile',
        temperature: parseFloat(localStorage.getItem('temperature') || '0.7'),
        maxTokens: parseInt(localStorage.getItem('maxTokens') || '2000'),
        topK: parseInt(localStorage.getItem('topK') || '3'),
        chunkSize: parseInt(localStorage.getItem('chunkSize') || '1000')
      });
    };

    window.addEventListener('settingsChanged', handleSettingsChange);
    return () => window.removeEventListener('settingsChanged', handleSettingsChange);
  }, []);

  const fetchDocuments = useCallback(async () => {
    try {
      const response = await api.get('/documents');
      setDocuments(response.data.documents || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      showError('Failed to load documents');
    }
  }, [showError]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    const docId = searchParams.get('doc');
    if (docId && documents.length > 0) {
      const doc = documents.find(d => d._id === docId);
      if (doc) {
        setSelectedDoc(doc);
      }
    }
  }, [searchParams, documents]);

  const saveConversation = async (userQuestion, aiAnswer) => {
    try {
      const token = localStorage.getItem('token');
      
      if (currentConversationId) {
        // Add to existing conversation
        const response = await fetch(`http://localhost:5001/api/conversations/${currentConversationId}/messages`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ 
            question: userQuestion, 
            answer: aiAnswer 
          })
        });

        const data = await response.json();
        if (data.success) {
          console.log('✅ Added to existing conversation');
        }
      } else {
        // Create new conversation
        const response = await fetch('http://localhost:5001/api/conversations', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            userId: user.id,
            documentId: selectedDoc._id,
            question: userQuestion,
            answer: aiAnswer
          })
        });

        const data = await response.json();
        if (data.success) {
          setCurrentConversationId(data.conversation._id);
          console.log('✅ Created new conversation:', data.conversation._id);
        }
      }
    } catch (error) {
      console.error('Error saving conversation:', error);
      // Don't show error to user - conversation saving is background task
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!question.trim()) {
      setError('Please enter a question');
      return;
    }

    if (!selectedDoc) {
      setError('Please select a document first');
      return;
    }

    const userMessage = {
      role: 'user',
      content: question,
      timestamp: new Date().toISOString()
    };
    setConversation(prev => [...prev, userMessage]);
    
    const currentQuestion = question.trim();
    setQuestion('');
    setLoading(true);
    setError('');

    try {
      console.log('🔍 Asking question with settings:', settings);

      // ✅ UPDATED: Send settings to backend
      const response = await api.post('/query', {
        question: currentQuestion,
        documentId: selectedDoc._id,
        settings: settings  // ✅ Include user settings
      });

      console.log('✅ Response received');
      console.log('📊 Settings used by backend:', response.data.settingsUsed);

      const aiMessage = {
        role: 'assistant',
        content: response.data.answer,
        sources: response.data.sources || [],
        method: response.data.method,  // 'vector' or 'direct'
        timestamp: new Date().toISOString()
      };
      setConversation(prev => [...prev, aiMessage]);

      // Save to conversation history in background
      saveConversation(currentQuestion, response.data.answer);

    } catch (error) {
      console.error('Query error:', error);
      setError(error.response?.data?.message || 'Failed to get answer');
      setConversation(prev => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = () => {
    if (window.confirm('Clear conversation history?')) {
      setConversation([]);
      setCurrentConversationId(null);
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // ✅ NEW: Helper to get model display name
  const getModelDisplayName = (model) => {
    if (model === 'llama-3.3-70b-versatile') return 'Llama 3.3 70B';
    if (model === 'llama-3.1-8b-instant') return 'Llama 3.1 8B';
    return model;
  };

  return (
    <div className="query-container">
      <header className="query-header">
        <div className="header-content">
          <div className="header-left">
            <button onClick={() => navigate('/')} className="back-btn">
              ← Dashboard
            </button>
            <h1>🤖 AI Query</h1>
          </div>
          <div className="header-right">
            {/* ✅ NEW: Settings indicator */}
            <div className="settings-indicator">
              <span className="setting-badge" title="AI Model">
                🤖 {getModelDisplayName(settings.aiModel)}
              </span>
              <span className="setting-badge" title="Temperature">
                🌡️ {settings.temperature}
              </span>
              <span className="setting-badge" title="Top K Results">
                📊 K:{settings.topK}
              </span>
              <button 
                onClick={() => navigate('/settings')} 
                className="settings-link-btn"
                title="Change Settings"
              >
                ⚙️
              </button>
            </div>
            <span className="user-name">{user?.name}</span>
            <button onClick={logout} className="logout-btn">
              🚪 Logout
            </button>
          </div>
        </div>
      </header>

      <div className="query-content">
        <div className="document-selector">
          <label htmlFor="doc-select">📄 Select Document:</label>
          <select
            id="doc-select"
            value={selectedDoc?._id || ''}
            onChange={(e) => {
              const doc = documents.find(d => d._id === e.target.value);
              setSelectedDoc(doc);
              setConversation([]);
              setCurrentConversationId(null);
            }}
            className="doc-select"
          >
            <option value="">Choose a document...</option>
            {documents.map(doc => (
              <option key={doc._id} value={doc._id}>
                {doc.originalName}
              </option>
            ))}
          </select>
          
          {selectedDoc && (
            <div className="selected-doc-info">
              <span>✅ Selected: {selectedDoc.originalName}</span>
            </div>
          )}
        </div>

        <div className="conversation-wrapper">
          <div className="conversation-header">
            <h2>💬 Conversation</h2>
            {conversation.length > 0 && (
              <button onClick={clearHistory} className="clear-btn">
                🗑️ Clear History
              </button>
            )}
          </div>

          <div className="conversation-area">
            {conversation.length === 0 ? (
              <div className="empty-conversation">
                <span className="empty-icon">💭</span>
                <h3>Ask Questions About Your Documents</h3>
                <p>Get instant AI-powered answers from your uploaded documents</p>
                {!selectedDoc && (
                  <p className="hint">👆 Start by selecting a document above</p>
                )}
              </div>
            ) : (
              <div className="messages">
                {conversation.map((msg, idx) => (
                  <div key={idx} className={`message ${msg.role}`}>
                    <div className="message-header">
                      <span className="message-sender">
                        {msg.role === 'user' ? '👤 You' : '🤖 AI Assistant'}
                      </span>
                      <span className="message-time">
                        {formatTime(msg.timestamp)}
                      </span>
                      {/* ✅ NEW: Show search method used */}
                      {msg.method && (
                        <span className="message-method" title={msg.method === 'vector' ? 'Used RAG vector search' : 'Used direct text search'}>
                          {msg.method === 'vector' ? '🎯 Vector' : '📄 Direct'}
                        </span>
                      )}
                    </div>
                    <div className="message-content">
                      {msg.content}
                    </div>
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="message-sources">
                        <span className="sources-label">📚 Sources:</span>
                        <div className="sources-list">
                          {msg.sources.map((source, i) => (
                            <span key={i} className="source-badge">
                              Section {i + 1}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                
                {loading && (
                  <div className="message assistant">
                    <div className="message-header">
                      <span className="message-sender">🤖 AI Assistant</span>
                    </div>
                    <div className="message-content typing">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="query-form">
            {error && (
              <div className="error-banner">
                ⚠️ {error}
              </div>
            )}
            
            <div className="input-wrapper">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={selectedDoc ? "Ask a question about this document..." : "Select a document first..."}
                disabled={loading || !selectedDoc}
                className="query-input"
              />
              <button
                type="submit"
                disabled={loading || !selectedDoc || !question.trim()}
                className="submit-btn"
              >
                {loading ? '⏳' : '🚀'} Ask
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Query;