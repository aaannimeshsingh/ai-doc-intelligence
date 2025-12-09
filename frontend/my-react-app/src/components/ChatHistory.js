// frontend/src/components/ChatHistory.js
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import './ChatHistory.css';

const ChatHistory = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStarred, setFilterStarred] = useState(false);
  const { user } = useAuth();
  const { showSuccess, showError } = useToast();

  const fetchConversations = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const params = new URLSearchParams({ userId: user.id });
      if (filterStarred) params.append('starred', 'true');

      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5001/api/conversations?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await response.json();

      if (data.success) {
        setConversations(data.conversations || []);
      } else {
        setConversations([]);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      showError('Failed to load conversation history');
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [user, filterStarred, showError]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      fetchConversations();
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5001/api/conversations/search', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId: user.id, searchTerm })
      });

      const data = await response.json();
      if (data.success) {
        setConversations(data.conversations || []);
        showSuccess(`Found ${data.count} conversation(s)`);
      }
    } catch (error) {
      console.error('Error searching:', error);
      showError('Search failed');
    }
  };

  const toggleStar = async (conversationId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5001/api/conversations/${conversationId}/star`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success) {
        setConversations(prev =>
          prev.map(conv =>
            conv._id === conversationId ? { ...conv, isStarred: data.isStarred } : conv
          )
        );
        showSuccess(data.isStarred ? 'Starred conversation' : 'Unstarred conversation');
      }
    } catch (error) {
      console.error('Error toggling star:', error);
      showError('Failed to update star status');
    }
  };

  const deleteConversation = async (conversationId) => {
    if (!window.confirm('Are you sure you want to delete this conversation?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5001/api/conversations/${conversationId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success) {
        setConversations(prev => prev.filter(conv => conv._id !== conversationId));
        if (selectedConversation?._id === conversationId) {
          setSelectedConversation(null);
        }
        showSuccess('Conversation deleted');
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
      showError('Failed to delete conversation');
    }
  };

  const viewConversation = async (conversationId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5001/api/conversations/${conversationId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();

      if (data.success) {
        setSelectedConversation(data.conversation);
      }
    } catch (error) {
      console.error('Error loading conversation:', error);
      showError('Failed to load conversation');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  if (loading) {
    return (
      <div className="chat-history-loading">
        <div className="loading-spinner"></div>
        <p>Loading conversation history...</p>
      </div>
    );
  }

  return (
    <div className="chat-history-container">
      {/* Sidebar */}
      <div className="chat-sidebar">
        <div className="sidebar-header">
          <h2>💬 Chat History</h2>
          <button 
            onClick={() => setFilterStarred(!filterStarred)} 
            className={`star-filter-btn ${filterStarred ? 'active' : ''}`}
          >
            ⭐
          </button>
        </div>

        <div className="search-section">
          <input 
            type="text" 
            placeholder="Search conversations..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()} 
            className="search-input"
          />
          <button onClick={handleSearch} className="search-btn">🔍</button>
        </div>

        <div className="conversations-list">
          {conversations.length === 0 ? (
            <div className="empty-conversations">
              <span className="empty-icon">💭</span>
              <p>No conversations yet</p>
              <small>Start asking questions!</small>
            </div>
          ) : (
            conversations.map(conv => (
              <div 
                key={conv._id} 
                onClick={() => viewConversation(conv._id)} 
                className={`conversation-item ${selectedConversation?._id === conv._id ? 'active' : ''}`}
              >
                <div className="conversation-header">
                  <h4 className="conversation-title">{conv.title}</h4>
                  <button 
                    onClick={(e) => { e.stopPropagation(); toggleStar(conv._id); }} 
                    className="star-btn"
                  >
                    {conv.isStarred ? '⭐' : '☆'}
                  </button>
                </div>
                <div className="conversation-meta">
                  <span className="doc-name">📄 {conv.documentId?.filename || 'Unknown'}</span>
                  <span className="date">{formatDate(conv.updatedAt)}</span>
                </div>
                <div className="conversation-footer">
                  <span>{conv.messages?.length || 0} messages</span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); deleteConversation(conv._id); }} 
                    className="delete-btn"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main View */}
      <div className="chat-main">
        {selectedConversation ? (
          <>
            <div className="conversation-detail-header">
              <h3>{selectedConversation.title}</h3>
              <p>📄 {selectedConversation.documentId?.filename} • {new Date(selectedConversation.createdAt).toLocaleDateString()}</p>
            </div>

            <div className="messages-container">
              {selectedConversation.messages?.map((msg, idx) => (
                <div key={idx} className={`message ${msg.role}`}>
                  <div className="message-avatar">
                    {msg.role === 'user' ? '👤' : '🤖'}
                  </div>
                  <div className="message-content-wrapper">
                    <div className="message-bubble">{msg.content}</div>
                    <div className="message-time">{new Date(msg.timestamp).toLocaleTimeString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="empty-main">
            <span className="empty-icon">💬</span>
            <h3>Select a conversation</h3>
            <p>Choose a conversation from the sidebar to view its history</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatHistory;