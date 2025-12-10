// src/components/AnalyticsDashboard.js
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { API_URL, getAuthHeaders } from '../config/api';
import './AnalyticsDashboard.css';

const AnalyticsDashboard = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();
  const { showError } = useToast();

  const fetchAnalytics = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_URL}/api/analytics?userId=${user.id}`, {
        headers: getAuthHeaders()
      });

      const data = await response.json();

      if (data.success) {
        setAnalytics(data.analytics);
      } else {
        setError('Failed to load analytics');
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError('Failed to load analytics data');
      showError('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [user, showError]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${Math.floor(diffInHours)}h ago`;
    if (diffInHours < 48) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner-large"></div>
        <p>Loading analytics...</p>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="error-state">
        <span className="error-icon">⚠️</span>
        <h3>{error || 'No analytics data available'}</h3>
        <button onClick={fetchAnalytics} className="retry-btn">
          🔄 Retry
        </button>
      </div>
    );
  }

  const maxFileSize = Math.max(...Object.values(analytics.documentsByType).map(cat => cat.totalSize), 1);

  return (
    <div className="analytics-container">
      <div className="analytics-header">
        <div>
          <h1 className="analytics-title">📊 Analytics Dashboard</h1>
          <p className="analytics-description">Overview of your document intelligence system</p>
        </div>
        <button onClick={fetchAnalytics} className="refresh-btn">
          🔄 Refresh
        </button>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-icon">📄</span>
          <div className="stat-content">
            <h3>{analytics.totalDocuments}</h3>
            <p>Total Documents</p>
            {analytics.totalDocuments > 0 && (
              <span className="stat-badge">Active</span>
            )}
          </div>
        </div>

        <div className="stat-card">
          <span className="stat-icon">💬</span>
          <div className="stat-content">
            <h3>{analytics.totalConversations}</h3>
            <p>Conversations</p>
            {analytics.totalConversations > 0 && (
              <span className="stat-badge primary">Engaged</span>
            )}
          </div>
        </div>

        <div className="stat-card">
          <span className="stat-icon">❓</span>
          <div className="stat-content">
            <h3>{analytics.totalQueries}</h3>
            <p>Total Queries</p>
          </div>
        </div>

        <div className="stat-card">
          <span className="stat-icon">💾</span>
          <div className="stat-content">
            <h3>{formatFileSize(analytics.totalStorage)}</h3>
            <p>Storage Used</p>
          </div>
        </div>
      </div>

      {/* Documents by Type */}
      {Object.keys(analytics.documentsByType).length > 0 && (
        <div className="analytics-section">
          <h2 className="section-title">📑 Documents by Type</h2>
          <div className="category-grid">
            {Object.entries(analytics.documentsByType).map(([type, data]) => (
              <div key={type} className="category-card">
                <div className="category-header">
                  <span className="category-name">{type || 'other'}</span>
                  <span className="category-count">{data.count}</span>
                </div>
                <div className="category-size">{formatFileSize(data.totalSize)}</div>
                <div className="category-bar">
                  <div 
                    className="category-fill" 
                    style={{ width: `${(data.totalSize / maxFileSize) * 100}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Most Active Documents */}
      {analytics.mostActiveDocuments && analytics.mostActiveDocuments.length > 0 && (
        <div className="analytics-section">
          <h2 className="section-title">🔥 Most Active Documents</h2>
          <div className="documents-list">
            {analytics.mostActiveDocuments.slice(0, 5).map((doc, index) => (
              <div key={doc._id} className="document-row">
                <div className="doc-rank">#{index + 1}</div>
                <div className="doc-details">
                  <div className="doc-name">{doc.filename}</div>
                  <div className="doc-meta">
                    {formatFileSize(doc.fileSize)} • Uploaded {formatDate(doc.uploadDate)}
                  </div>
                </div>
                <div className="doc-stats">
                  <span style={{ color: '#3b82f6', fontWeight: 600 }}>
                    {doc.queryCount} queries
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {analytics.recentActivity && analytics.recentActivity.length > 0 && (
        <div className="analytics-section">
          <h2 className="section-title">⚡ Recent Activity</h2>
          <div className="activity-list">
            {analytics.recentActivity.slice(0, 5).map((activity, index) => (
              <div key={index} className="activity-row">
                <span className="activity-icon">
                  {activity.type === 'upload' ? '📤' : '💬'}
                </span>
                <div className="activity-details">
                  <div className="activity-name">
                    {activity.type === 'upload' 
                      ? `Uploaded ${activity.documentId?.filename || 'document'}`
                      : activity.title || 'New conversation'}
                  </div>
                  <div className="activity-time">{formatDate(activity.timestamp)}</div>
                </div>
                {activity.type === 'conversation' && activity.messages?.length > 0 && (
                  <span className="activity-count">
                    {activity.messages.length} messages
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Timeline */}
      {analytics.uploadTimeline && analytics.uploadTimeline.length > 0 && (
        <div className="analytics-section">
          <h2 className="section-title">📈 Upload Timeline (Last 7 Days)</h2>
          <div className="timeline-chart">
            {analytics.uploadTimeline.map((day, index) => {
              const maxCount = Math.max(...analytics.uploadTimeline.map(d => d.count), 1);
              const height = (day.count / maxCount) * 100;
              
              return (
                <div key={index} className="timeline-bar-wrapper">
                  <div 
                    className="timeline-bar" 
                    style={{ height: `${Math.max(height, 5)}%` }}
                    title={`${day.count} uploads on ${day.date}`}
                  >
                    {day.count > 0 && (
                      <span className="timeline-count">{day.count}</span>
                    )}
                  </div>
                  <div className="timeline-date">
                    {new Date(day.date).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsDashboard;