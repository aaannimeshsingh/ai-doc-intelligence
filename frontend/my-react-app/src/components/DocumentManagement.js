// src/components/DocumentManagement.js - Safe version
import React, { useState, useEffect, useCallback } from 'react';
import './DocumentManagement.css';

const DocumentManagement = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [renamingDoc, setRenamingDoc] = useState(null);
  const [newName, setNewName] = useState('');

  // Safe toast functions
  const showSuccess = (message) => console.log('✅', message);
  const showError = (message) => console.error('❌', message);

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5001/api/documents');
      const data = await response.json();

      if (data.success) {
        setDocuments(data.documents);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      showError('Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      fetchDocuments();
      return;
    }

    try {
      const response = await fetch(`http://localhost:5001/api/documents/search?q=${encodeURIComponent(searchTerm)}`);
      const data = await response.json();

      if (data.success) {
        setDocuments(data.documents);
        showSuccess(`Found ${data.count} document(s)`);
      }
    } catch (error) {
      console.error('Error searching:', error);
      showError('Search failed');
    }
  };

  const toggleDocSelection = (docId) => {
    setSelectedDocs(prev =>
      prev.includes(docId)
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    );
  };

  const selectAll = () => {
    if (selectedDocs.length === documents.length) {
      setSelectedDocs([]);
    } else {
      setSelectedDocs(documents.map(doc => doc._id));
    }
  };

  const startRename = (doc) => {
    setRenamingDoc(doc._id);
    setNewName(doc.filename);
  };

  const cancelRename = () => {
    setRenamingDoc(null);
    setNewName('');
  };

  const saveRename = async (docId) => {
    if (!newName.trim()) {
      showError('Filename cannot be empty');
      return;
    }

    try {
      const response = await fetch(`http://localhost:5001/api/documents/${docId}/rename`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: newName.trim() })
      });

      const data = await response.json();

      if (data.success) {
        setDocuments(prev =>
          prev.map(doc =>
            doc._id === docId ? { ...doc, filename: newName.trim() } : doc
          )
        );
        showSuccess('Document renamed successfully');
        cancelRename();
      }
    } catch (error) {
      console.error('Error renaming document:', error);
      showError('Failed to rename document');
    }
  };

  const toggleStar = async (docId) => {
    try {
      const response = await fetch(`http://localhost:5001/api/documents/${docId}/star`, {
        method: 'PUT'
      });

      const data = await response.json();

      if (data.success) {
        setDocuments(prev =>
          prev.map(doc =>
            doc._id === docId ? { ...doc, starred: data.isStarred } : doc
          )
        );
        showSuccess(data.isStarred ? 'Document starred' : 'Document unstarred');
      }
    } catch (error) {
      console.error('Error toggling star:', error);
      showError('Failed to update star status');
    }
  };

  const deleteDocument = async (docId) => {
    if (!window.confirm('Are you sure? This will delete the document and all associated conversations.')) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:5001/api/documents/${docId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        setDocuments(prev => prev.filter(doc => doc._id !== docId));
        showSuccess('Document deleted successfully');
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      showError('Failed to delete document');
    }
  };

  const bulkDelete = async () => {
    if (selectedDocs.length === 0) {
      showError('No documents selected');
      return;
    }

    if (!window.confirm(`Delete ${selectedDocs.length} document(s) and all associated conversations?`)) {
      return;
    }

    try {
      const response = await fetch('http://localhost:5001/api/documents/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIds: selectedDocs })
      });

      const data = await response.json();

      if (data.success) {
        setDocuments(prev => prev.filter(doc => !selectedDocs.includes(doc._id)));
        setSelectedDocs([]);
        showSuccess(`${data.deletedCount} document(s) deleted`);
      }
    } catch (error) {
      console.error('Error bulk deleting:', error);
      showError('Failed to delete documents');
    }
  };

  const sortedDocuments = [...documents].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return a.filename.localeCompare(b.filename);
      case 'size':
        return (b.fileSize || 0) - (a.fileSize || 0);
      case 'date':
      default:
        return new Date(b.uploadDate) - new Date(a.uploadDate);
    }
  });

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="doc-management-loading">
        <div className="loading-spinner"></div>
        <p>Loading documents...</p>
      </div>
    );
  }

  return (
    <div className="document-management-container">
      <div className="management-header">
        <h2>📁 Document Management</h2>
        <p className="doc-count">{documents.length} document(s)</p>
      </div>

      <div className="management-toolbar">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch} className="search-btn">
            🔍 Search
          </button>
        </div>

        <div className="toolbar-actions">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="sort-select"
          >
            <option value="date">Sort by Date</option>
            <option value="name">Sort by Name</option>
            <option value="size">Sort by Size</option>
          </select>

          {selectedDocs.length > 0 && (
            <button onClick={bulkDelete} className="bulk-delete-btn">
              🗑️ Delete {selectedDocs.length}
            </button>
          )}
        </div>
      </div>

      {documents.length === 0 ? (
        <div className="empty-documents">
          <span className="empty-icon">📄</span>
          <h3>No documents found</h3>
          <p>Upload documents to get started</p>
        </div>
      ) : (
        <>
          <div className="select-all-bar">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={selectedDocs.length === documents.length}
                onChange={selectAll}
              />
              Select All
            </label>
            {selectedDocs.length > 0 && (
              <span className="selection-info">
                {selectedDocs.length} selected
              </span>
            )}
          </div>

          <div className="documents-grid">
            {sortedDocuments.map(doc => (
              <div
                key={doc._id}
                className={`document-card ${selectedDocs.includes(doc._id) ? 'selected' : ''}`}
              >
                <div className="doc-card-header">
                  <input
                    type="checkbox"
                    checked={selectedDocs.includes(doc._id)}
                    onChange={() => toggleDocSelection(doc._id)}
                    className="doc-checkbox"
                  />
                  <button
                    className={`star-icon ${doc.starred ? 'starred' : ''}`}
                    onClick={() => toggleStar(doc._id)}
                  >
                    {doc.starred ? '⭐' : '☆'}
                  </button>
                </div>

                <div className="doc-icon">📄</div>

                {renamingDoc === doc._id ? (
                  <div className="rename-input-group">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && saveRename(doc._id)}
                      autoFocus
                    />
                    <div className="rename-actions">
                      <button onClick={() => saveRename(doc._id)} className="save-btn">
                        ✓
                      </button>
                      <button onClick={cancelRename} className="cancel-btn">
                        ✕
                      </button>
                    </div>
                  </div>
                ) : (
                  <h3 className="doc-title" title={doc.filename}>
                    {doc.filename}
                  </h3>
                )}

                <div className="doc-info">
                  <span>📅 {formatDate(doc.uploadDate)}</span>
                  <span>💾 {formatFileSize(doc.fileSize)}</span>
                </div>

                <div className="doc-actions">
                  <button
                    onClick={() => startRename(doc)}
                    className="action-btn rename"
                    title="Rename"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => deleteDocument(doc._id)}
                    className="action-btn delete"
                    title="Delete"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default DocumentManagement;