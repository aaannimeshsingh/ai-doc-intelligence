import React from 'react';
import { deleteDocument } from '../services/api';
import './DocumentList.css';

function DocumentList({ documents, loading, onRefresh }) {
  const getFileIcon = (fileName) => {
    if (!fileName) return '📄';
    const ext = fileName.split('.').pop().toLowerCase();
    const iconMap = {
      'pdf': '📕',
      'doc': '📘',
      'docx': '📘',
      'txt': '📝',
      'xls': '📊',
      'xlsx': '📊',
      'ppt': '📙',
      'pptx': '📙'
    };
    return iconMap[ext] || '📄';
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown size';
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Date unknown';
    
    const date = new Date(dateString);
    
    // Format: "Dec 7, 2024, 2:30 PM"
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const handleDelete = async (docId, docName) => {
    if (window.confirm(`Are you sure you want to delete "${docName}"?`)) {
      try {
        await deleteDocument(docId);
        alert('Document deleted successfully');
        onRefresh();
      } catch (error) {
        alert('Failed to delete document: ' + error.message);
      }
    }
  };

  if (loading) {
    return (
      <div className="document-list-container">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading documents...</p>
        </div>
      </div>
    );
  }

  if (!documents || documents.length === 0) {
    return (
      <div className="document-list-container">
        <div className="empty-state">
          <div className="empty-icon">📁</div>
          <h3>No Documents Yet</h3>
          <p>Upload your first document to get started with AI-powered queries</p>
          <button className="refresh-button" onClick={onRefresh}>
            <span>🔄</span>
            <span>Refresh</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="document-list-container">
      <div className="list-header">
        <div className="header-left">
          <h2 className="list-title">Your Documents</h2>
          <span className="document-count">
            {documents.length} {documents.length === 1 ? 'document' : 'documents'}
          </span>
        </div>
        <button className="refresh-button" onClick={onRefresh}>
          <span>🔄</span>
          <span>Refresh</span>
        </button>
      </div>

      <div className="documents-grid">
        {documents.map((doc) => (
          <div key={doc._id} className="document-card">
            <div className="card-header">
              <div className="file-icon-large">
                {getFileIcon(doc.originalName)}
              </div>
              <div className="card-actions">
                <button 
                  className="action-button delete" 
                  title="Delete"
                  onClick={() => handleDelete(doc._id, doc.originalName)}
                >
                  🗑️
                </button>
              </div>
            </div>
            
            <div className="card-body">
              <h3 className="document-name" title={doc.originalName}>
                {doc.originalName}
              </h3>
              
              <div className="document-meta">
                <div className="meta-item">
                  <span className="meta-icon">💾</span>
                  <span className="meta-text">{formatFileSize(doc.size)}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-icon">📅</span>
                  <span className="meta-text">{formatDate(doc.uploadedAt)}</span>
                </div>
                {doc.vectorIds && doc.vectorIds.length > 0 && (
                  <div className="meta-item">
                    <span className="meta-icon">🧩</span>
                    <span className="meta-text">{doc.vectorIds.length} chunks</span>
                  </div>
                )}
              </div>

              <div className="card-footer">
                <span className="status-badge">
                  <span className="status-dot"></span>
                  <span>Indexed</span>
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default DocumentList;