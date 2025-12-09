// src/components/QueryInterface.js
import React, { useState, useEffect } from 'react';
import { queryDocuments, getDocuments } from '../services/api';
import './QueryInterface.css';

function QueryInterface() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [documents, setDocuments] = useState([]);
  const [selectedDoc, setSelectedDoc] = useState('all');
  const [conversationHistory, setConversationHistory] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, []);

  useEffect(() => {
    // Load suggestions when document changes
    if (selectedDoc && selectedDoc !== 'all') {
      loadSuggestions(selectedDoc);
    } else {
      setSuggestions([]);
    }
  }, [selectedDoc]);

  const loadDocuments = async () => {
    try {
      const docs = await getDocuments();
      setDocuments(docs);
      
      // Auto-select the most recent document
      if (docs.length > 0) {
        setSelectedDoc(docs[0]._id);
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
    }
  };

  const loadSuggestions = async (docId) => {
    try {
      setLoadingSuggestions(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5001/api/documents/${docId}/suggestions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success && data.suggestions) {
        setSuggestions(data.suggestions);
      }
    } catch (err) {
      console.error('Failed to load suggestions:', err);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!question.trim()) {
      setError('Please enter a question');
      return;
    }

    if (selectedDoc !== 'all' && !documents.find(d => d._id === selectedDoc)) {
      setError('Please select a valid document');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const documentId = selectedDoc === 'all' ? null : selectedDoc;
      
      console.log('🔍 Querying with:', {
        question,
        documentId,
        selectedDoc
      });

      const result = await queryDocuments(question, documentId);

      // Add to conversation history
      const newEntry = {
        question,
        answer: result.answer,
        sources: result.sources || [],
        timestamp: new Date(),
        documentName: selectedDoc === 'all' 
          ? 'All Documents' 
          : documents.find(d => d._id === selectedDoc)?.originalName
      };

      setConversationHistory(prev => [newEntry, ...prev]);
      setQuestion(''); // Clear input
      
    } catch (err) {
      console.error('Query error:', err);
      setError(err.response?.data?.message || 'Failed to get answer');
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = () => {
    setConversationHistory([]);
    setError('');
  };

  const exportAsPDF = async () => {
    try {
      // Check if there's conversation history
      if (conversationHistory.length === 0) {
        setError('No conversation to export. Ask a question first!');
        return;
      }

      const token = localStorage.getItem('token');
      const docName = selectedDoc === 'all' 
        ? 'All Documents' 
        : documents.find(d => d._id === selectedDoc)?.originalName || 'Unknown Document';

      const response = await fetch('http://localhost:5001/api/export/conversation/pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          conversation: conversationHistory,
          documentName: docName
        })
      });

      // Check if response is OK before creating blob
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Export failed' }));
        throw new Error(errorData.message || `Export failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversation-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      console.log('✅ PDF exported successfully');
    } catch (err) {
      console.error('Export failed:', err);
      setError(`Failed to export: ${err.message}`);
    }
  };

  const exportAsTXT = async () => {
    try {
      // Check if there's conversation history
      if (conversationHistory.length === 0) {
        setError('No conversation to export. Ask a question first!');
        return;
      }

      const token = localStorage.getItem('token');
      const docName = selectedDoc === 'all' 
        ? 'All Documents' 
        : documents.find(d => d._id === selectedDoc)?.originalName || 'Unknown Document';

      const response = await fetch('http://localhost:5001/api/export/conversation/txt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          conversation: conversationHistory,
          documentName: docName
        })
      });

      // Check if response is OK before creating blob
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Export failed' }));
        throw new Error(errorData.message || `Export failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversation-${Date.now()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      console.log('✅ TXT exported successfully');
    } catch (err) {
      console.error('Export failed:', err);
      setError(`Failed to export: ${err.message}`);
    }
  };

  const getDocIcon = (name) => {
    if (!name) return '📄';
    if (name.endsWith('.pdf')) return '📕';
    if (name.endsWith('.docx') || name.endsWith('.doc')) return '📘';
    if (name.endsWith('.txt')) return '📝';
    return '📄';
  };

  return (
    <div className="query-container">
      <div className="query-header">
        <div>
          <h2 className="query-title">Ask Questions About Your Documents</h2>
          <p className="query-description">
            Get instant AI-powered answers from your uploaded documents
          </p>
        </div>
        {conversationHistory.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={exportAsPDF} className="export-btn" title="Export as PDF">
              📄 PDF
            </button>
            <button onClick={exportAsTXT} className="export-btn" title="Export as TXT">
              📝 TXT
            </button>
            <button onClick={clearHistory} className="clear-history-btn">
              🗑️ Clear
            </button>
          </div>
        )}
      </div>

      {/* Document Selector */}
      <div className="document-selector">
        <label htmlFor="doc-select">
          <span className="selector-icon">📄</span>
          <span>Select Document:</span>
        </label>
        <select 
          id="doc-select"
          value={selectedDoc} 
          onChange={(e) => setSelectedDoc(e.target.value)}
          className="doc-select"
        >
          <option value="all">🌐 Search All Documents</option>
          {documents.map(doc => (
            <option key={doc._id} value={doc._id}>
              {getDocIcon(doc.originalName)} {doc.originalName}
              {doc.isIndexed ? ' ✓' : ' ⏳'}
            </option>
          ))}
        </select>
      </div>

      {/* Query Form */}
      <form onSubmit={handleSubmit} className="query-form">
        <div className="input-container">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Type your question here... (Press Enter to send)"
            className="query-input"
            rows="3"
            disabled={loading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <button 
            type="submit" 
            disabled={loading || !question.trim()}
            className="submit-btn"
          >
            {loading ? (
              <>
                <span className="spinner-small"></span>
                <span>Thinking...</span>
              </>
            ) : (
              <>
                <span>🚀</span>
                <span>Ask</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Error Message */}
      {error && (
        <div className="error-banner">
          <span className="error-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Conversation History */}
      {conversationHistory.length > 0 && (
        <div className="conversation-section">
          <h3 className="conversation-header">
            <span>💬</span>
            <span>Conversation</span>
          </h3>
          
          <div className="conversation-list">
            {conversationHistory.map((entry, idx) => (
              <div key={idx} className="conversation-item">
                <div className="question-bubble">
                  <div className="bubble-header">
                    <span className="bubble-icon">👤</span>
                    <span className="bubble-label">You</span>
                    <span className="bubble-time">
                      {entry.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="bubble-text">{entry.question}</p>
                  {entry.documentName && (
                    <div className="bubble-doc">
                      📄 {entry.documentName}
                    </div>
                  )}
                </div>

                <div className="answer-bubble">
                  <div className="bubble-header">
                    <span className="bubble-icon">🤖</span>
                    <span className="bubble-label">AI Assistant</span>
                  </div>
                  <div className="bubble-text">{entry.answer}</div>
                  
                  {entry.sources && entry.sources.length > 0 && (
                    <div className="sources-section">
                      <div className="sources-header">
                        📚 <strong>{entry.sources.length} relevant sections found</strong>
                      </div>
                      {entry.sources.slice(0, 3).map((source, sidx) => (
                        <div key={sidx} className="source-item">
                          <div className="source-score">
                            {(source.score * 100).toFixed(0)}% match
                          </div>
                          <div className="source-text">{source.text}</div>
                          {source.documentName && (
                            <div className="source-doc">
                              From: {source.documentName}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {conversationHistory.length === 0 && !loading && (
        <div className="empty-state">
          <div className="empty-icon">💭</div>
          <h3>No questions yet</h3>
          <p>Ask a question about your documents to get started!</p>
          
          {/* ✅ Suggested Questions */}
          {suggestions.length > 0 && (
            <div className="example-questions">
              <p className="examples-title">💡 Suggested Questions:</p>
              {suggestions.map((suggestion, idx) => (
                <button 
                  key={idx}
                  className="example-btn"
                  onClick={() => setQuestion(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
          
          {loadingSuggestions && (
            <div className="loading-suggestions">
              <span className="spinner-small"></span>
              <span>Generating smart questions...</span>
            </div>
          )}
          
          {!loadingSuggestions && suggestions.length === 0 && selectedDoc !== 'all' && (
            <div className="example-questions">
              <p className="examples-title">Try asking:</p>
              <button 
                className="example-btn"
                onClick={() => setQuestion('What is this document about?')}
              >
                "What is this document about?"
              </button>
              <button 
                className="example-btn"
                onClick={() => setQuestion('Summarize the key points')}
              >
                "Summarize the key points"
              </button>
              <button 
                className="example-btn"
                onClick={() => setQuestion('What are the main findings?')}
              >
                "What are the main findings?"
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default QueryInterface;