// src/services/api.js - Production & Development Compatible
import axios from 'axios';

// ===================================================================
// 🌐 SMART API URL DETECTION
// Works automatically in both development and production
// ===================================================================
const getApiUrl = () => {
  // Priority 1: Environment variable (set in Vercel/Netlify)
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // Priority 2: Detect if running in production (deployed)
  if (process.env.NODE_ENV === 'production') {
    // If you're on Vercel and backend is on Render, set this in Vercel env vars
    return 'https://your-backend.onrender.com/api';
  }
  
  // Priority 3: Local development
  return 'http://localhost:5001/api';
};

const API_BASE_URL = getApiUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // Default timeout for most requests
  headers: {
    'Content-Type': 'application/json',
  },
});

// ===================================================================
// SETTINGS UTILITIES (inline to avoid extra file)
// ===================================================================
const getSettings = () => {
  return {
    aiModel: localStorage.getItem('aiModel') || 'llama-3.3-70b-versatile',
    temperature: parseFloat(localStorage.getItem('temperature') || '0.7'),
    maxTokens: parseInt(localStorage.getItem('maxTokens') || '2000'),
    chunkSize: parseInt(localStorage.getItem('chunkSize') || '1000'),
    topK: parseInt(localStorage.getItem('topK') || '3'),
  };
};

// ===================================================================
// INTERCEPTORS
// ===================================================================

// Request interceptor - attach token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      console.warn('⚠️ Unauthorized - clearing token');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Only redirect if not already on login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ===================================================================
// DOCUMENTS API
// ===================================================================

export async function getDocuments() {
  const res = await api.get('/documents');
  if (Array.isArray(res.data)) return res.data;
  if (res.data?.documents) return res.data.documents;
  return res.data;
}

export async function uploadDocument(file, onProgress) {
  if (!file) throw new Error('No file selected');

  const formData = new FormData();
  formData.append('document', file);

  // ✅ Extended timeout for OCR processing
  const res = await api.post('/documents/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: 300000, // 5 minutes for OCR processing
    onUploadProgress: onProgress,
  });

  return res.data;
}

export async function deleteDocument(id) {
  const res = await api.delete(`/documents/${id}`);
  return res.data;
}

export async function getDocumentSuggestions(documentId) {
  const res = await api.get(`/documents/${documentId}/suggestions`);
  return res.data;
}

// ===================================================================
// AUTH API
// ===================================================================

export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (name, email, password) => api.post('/auth/register', { name, email, password }),
  getMe: () => api.get('/auth/me'),
};

// ===================================================================
// QUERY API - WITH SETTINGS SUPPORT! ✅
// ===================================================================

export async function queryDocuments(question, documentId = null) {
  // Get user's settings from localStorage
  const settings = getSettings();
  
  console.log('🔧 Using settings:', settings);
  
  const res = await api.post('/query', { 
    question, 
    documentId,
    settings  // ✅ Send settings to backend
  });
  
  return res.data;
}

// ===================================================================
// CONVERSATIONS API
// ===================================================================

export async function getConversations(userId, starred = false) {
  const params = new URLSearchParams({ userId });
  if (starred) params.append('starred', 'true');
  
  const res = await api.get(`/conversations?${params}`);
  return res.data;
}

export async function getConversation(conversationId) {
  const res = await api.get(`/conversations/${conversationId}`);
  return res.data;
}

export async function searchConversations(userId, searchTerm) {
  const res = await api.post('/conversations/search', {
    userId,
    searchTerm
  });
  return res.data;
}

export async function toggleConversationStar(conversationId) {
  const res = await api.put(`/conversations/${conversationId}/star`);
  return res.data;
}

export async function deleteConversation(conversationId) {
  const res = await api.delete(`/conversations/${conversationId}`);
  return res.data;
}

export async function deleteAllConversations(userId) {
  const res = await api.delete('/conversations/delete-all', {
    data: { userId }
  });
  return res.data;
}

// ===================================================================
// ANALYTICS API
// ===================================================================

export async function getAnalytics(userId) {
  const res = await api.get(`/analytics?userId=${userId}`);
  return res.data;
}

// ===================================================================
// EXPORT API
// ===================================================================

export async function exportAllData(userId) {
  const res = await api.get(`/export/all?userId=${userId}`, {
    responseType: 'blob'
  });
  return res.data;
}

export async function exportConversation(conversationId) {
  const res = await api.get(`/export/conversation/${conversationId}`, {
    responseType: 'blob'
  });
  return res.data;
}

// ===================================================================
// HEALTH CHECK
// ===================================================================

export async function checkHealth() {
  // Remove /api from base URL for health check
  const healthUrl = API_BASE_URL.replace('/api', '') + '/api/health';
  const res = await axios.get(healthUrl);
  return res.data;
}

// ===================================================================
// DEBUG INFO (logs configuration on startup)
// ===================================================================
if (process.env.NODE_ENV === 'development') {
  console.log('═══════════════════════════════════════════════');
  console.log('🌐 API Configuration');
  console.log('═══════════════════════════════════════════════');
  console.log('📍 Base URL:', API_BASE_URL);
  console.log('🏗️  Environment:', process.env.NODE_ENV);
  console.log('⚙️  Using env var:', !!process.env.REACT_APP_API_URL);
  console.log('═══════════════════════════════════════════════');
}

export default api;