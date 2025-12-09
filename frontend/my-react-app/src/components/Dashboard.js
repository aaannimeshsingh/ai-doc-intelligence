// src/components/Dashboard.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DocumentUpload from './DocumentUpload';
import DocumentList from './DocumentList';
import DocumentManagement from './DocumentManagement';
import ChatHistory from './ChatHistory';
import AnalyticsDashboard from './AnalyticsDashboard';
import Settings from './Settings';
import './Dashboard.css';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState('documents'); // Changed from activeTab
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUploadSuccess = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <div className="logo">
            <span className="logo-icon">🧠</span>
            <div>
              <h1>AI Document Intelligence</h1>
              <p className="tagline">POWERED BY RAG & MACHINE LEARNING</p>
            </div>
          </div>
        </div>
        <div className="header-right">
          <button className="doc-count-btn">
            📚 1 Documents
          </button>
          <div className="user-info">
            <div className="user-avatar">
              {user?.name?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div>
              <span className="user-name">{user?.name || 'User'}</span>
              <button onClick={logout} className="logout-link">Logout</button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Action Buttons */}
      <div className="main-actions">
        <button
          className={`action-card ${activeView === 'upload' ? 'active' : ''}`}
          onClick={() => setActiveView('upload')}
        >
          <span className="action-icon">📤</span>
          <span className="action-text">Upload</span>
        </button>
        <button
          className={`action-card ${activeView === 'query' ? 'active' : ''}`}
          onClick={() => navigate('/query')}
        >
          <span className="action-icon">🤖</span>
          <span className="action-text">Query</span>
        </button>
        <button
          className={`action-card ${activeView === 'documents' ? 'active' : ''}`}
          onClick={() => setActiveView('documents')}
        >
          <span className="action-icon">📂</span>
          <span className="action-text">Documents</span>
        </button>
      </div>

      {/* Navigation Tabs - NEW! */}
      <nav className="dashboard-tabs">
        <button
          className={`tab-btn ${activeView === 'documents' ? 'active' : ''}`}
          onClick={() => setActiveView('documents')}
        >
          📂 Documents
        </button>
        <button
          className={`tab-btn ${activeView === 'upload' ? 'active' : ''}`}
          onClick={() => setActiveView('upload')}
        >
          📤 Upload
        </button>
        <button
          className={`tab-btn ${activeView === 'management' ? 'active' : ''}`}
          onClick={() => setActiveView('management')}
        >
          ⚙️ Management
        </button>
        <button
          className={`tab-btn ${activeView === 'history' ? 'active' : ''}`}
          onClick={() => setActiveView('history')}
        >
          💬 History
        </button>
        <button
          className={`tab-btn ${activeView === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveView('analytics')}
        >
          📊 Analytics
        </button>
        <button
          className={`tab-btn ${activeView === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveView('settings')}
        >
          ⚙️ Settings
        </button>
      </nav>

      {/* Main Content */}
      <main className="dashboard-content">
        {activeView === 'upload' && (
          <DocumentUpload onUploadSuccess={handleUploadSuccess} />
        )}
        
        {activeView === 'documents' && (
          <DocumentList key={refreshKey} />
        )}
        
        {activeView === 'management' && (
          <DocumentManagement />
        )}
        
        {activeView === 'history' && (
          <ChatHistory />
        )}
        
        {activeView === 'analytics' && (
          <AnalyticsDashboard />
        )}
        
        {activeView === 'settings' && (
          <Settings />
        )}
      </main>

      {/* Footer */}
      <footer className="dashboard-footer">
        <p>Built by Animesh Singh</p>
      </footer>
    </div>
  );
};

export default Dashboard;