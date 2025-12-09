// src/App.js - Updated for React Router v7
import React, { useState, useEffect, useTransition } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './components/Login';
import Register from './components/Register';
import DocumentUpload from './components/DocumentUpload';
import QueryInterface from './components/QueryInterface';
import DocumentList from './components/DocumentList';
import ChatHistory from './components/ChatHistory';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import Settings from './components/Settings';
import { getDocuments } from './services/api';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route 
              path="/" 
              element={
                <ProtectedRoute>
                  <MainApp />
                </ProtectedRoute>
              } 
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
}

function MainApp() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('upload');
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const docs = await getDocuments();
      setDocuments(docs);
    } catch (error) {
      console.error('Failed to load documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSuccess = async () => {
    await loadDocuments();
    startTransition(() => {
      setActiveTab('query');
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const handleTabChange = (tab) => {
    startTransition(() => {
      setActiveTab(tab);
    });
  };

  // Calculate tab position for the indicator
  const getTabPosition = () => {
    const tabs = ['upload', 'query', 'documents', 'history', 'analytics', 'settings'];
    const index = tabs.indexOf(activeTab);
    return `${(index / tabs.length) * 100}%`;
  };

  return (
    <div className="app-container">
      <div className="animated-bg">
        <div className="gradient-orb orb-1"></div>
        <div className="gradient-orb orb-2"></div>
        <div className="gradient-orb orb-3"></div>
      </div>

      <header className="app-header">
        <div className="header-content">
          <div className="logo-section">
            <div className="logo-icon">🧠</div>
            <div>
              <h1 className="app-title">AI Document Intelligence</h1>
              <p className="app-subtitle">Your Documents, Supercharged with AI Magic ✨</p>
            </div>
          </div>
          
          <div className="header-right">
            <div className="stats-badge">
              <span className="stats-icon">📚</span>
              <span className="stats-text">{documents.length} Documents</span>
            </div>
            
            <div className="user-section">
              <div className="user-avatar">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="user-info">
                <span className="user-name">{user?.name || 'User'}</span>
                <button onClick={handleLogout} className="logout-btn">
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="main-content">
        <div className="content-wrapper">
          <div className="tab-navigation">
            <button 
              className={`tab-button ${activeTab === 'upload' ? 'active' : ''}`}
              onClick={() => handleTabChange('upload')}
              disabled={isPending}
            >
              <span className="tab-icon">📤</span>
              <span>Upload</span>
            </button>
            <button 
              className={`tab-button ${activeTab === 'query' ? 'active' : ''}`}
              onClick={() => handleTabChange('query')}
              disabled={isPending}
            >
              <span className="tab-icon">🤖</span>
              <span>Query</span>
            </button>
            <button 
              className={`tab-button ${activeTab === 'documents' ? 'active' : ''}`}
              onClick={() => handleTabChange('documents')}
              disabled={isPending}
            >
              <span className="tab-icon">📁</span>
              <span>Documents</span>
            </button>
            <button 
              className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => handleTabChange('history')}
              disabled={isPending}
            >
              <span className="tab-icon">💬</span>
              <span>History</span>
            </button>
            <button 
              className={`tab-button ${activeTab === 'analytics' ? 'active' : ''}`}
              onClick={() => handleTabChange('analytics')}
              disabled={isPending}
            >
              <span className="tab-icon">📊</span>
              <span>Analytics</span>
            </button>
            <button 
              className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => handleTabChange('settings')}
              disabled={isPending}
            >
              <span className="tab-icon">⚙️</span>
              <span>Settings</span>
            </button>
            <div className="tab-indicator" style={{
              left: getTabPosition(),
              width: `${100 / 6}%`
            }}></div>
          </div>

          <div className="tab-content">
            {activeTab === 'upload' && (
              <div className="tab-panel fade-in">
                <DocumentUpload onUploadSuccess={handleUploadSuccess} />
              </div>
            )}
            
            {activeTab === 'query' && (
              <div className="tab-panel fade-in">
                <QueryInterface />
              </div>
            )}
            
            {activeTab === 'documents' && (
              <div className="tab-panel fade-in">
                <DocumentList 
                  documents={documents} 
                  loading={loading}
                  onRefresh={loadDocuments}
                />
              </div>
            )}
            
            {activeTab === 'history' && (
              <div className="tab-panel fade-in">
                <ChatHistory />
              </div>
            )}
            
            {activeTab === 'analytics' && (
              <div className="tab-panel fade-in">
                <AnalyticsDashboard />
              </div>
            )}
            
            {activeTab === 'settings' && (
              <div className="tab-panel fade-in">
                <Settings />
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="app-footer">
        <p>Crafted by Animesh Singh | Intelligent Document Processing System</p>
      </footer>
    </div>
  );
}

export default App;