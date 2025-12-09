// src/components/Navbar.js - CREATE THIS FILE
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="app-navbar">
      <div className="navbar-brand">
        <span className="brand-icon">🧠</span>
        <div className="brand-text">
          <h1>AI Document Intelligence</h1>
          <p>POWERED BY RAG & MACHINE LEARNING</p>
        </div>
      </div>

      <div className="navbar-links">
        <button
          className={`nav-link ${isActive('/') ? 'active' : ''}`}
          onClick={() => navigate('/')}
        >
          📤 Upload
        </button>
        <button
          className={`nav-link ${isActive('/documents') ? 'active' : ''}`}
          onClick={() => navigate('/documents')}
        >
          📂 Documents
        </button>
        <button
          className={`nav-link ${isActive('/query') ? 'active' : ''}`}
          onClick={() => navigate('/query')}
        >
          🤖 Query
        </button>
        <button
          className={`nav-link ${isActive('/history') ? 'active' : ''}`}
          onClick={() => navigate('/history')}
        >
          💬 History
        </button>
        <button
          className={`nav-link ${isActive('/analytics') ? 'active' : ''}`}
          onClick={() => navigate('/analytics')}
        >
          📊 Analytics
        </button>
        <button
          className={`nav-link ${isActive('/settings') ? 'active' : ''}`}
          onClick={() => navigate('/settings')}
        >
          ⚙️ Settings
        </button>
      </div>

      <div className="navbar-user">
        <div className="user-avatar">
          {user?.name?.charAt(0).toUpperCase() || 'U'}
        </div>
        <span className="user-name">{user?.name || 'User'}</span>
        <button className="logout-btn" onClick={logout}>
          Logout
        </button>
      </div>
    </nav>
  );
};

export default Navbar;