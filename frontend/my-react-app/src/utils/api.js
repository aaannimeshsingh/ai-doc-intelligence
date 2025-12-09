// src/utils/api.js - PRODUCTION READY
import axios from "axios";

// Dynamic API URL based on environment
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

console.log('🔧 API Base URL:', API_BASE_URL);

// Create axios client
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

/* ============================================================
   REQUEST INTERCEPTOR — Attach JWT token to all requests
   ============================================================ */
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
      console.debug("🔑 Token attached →", config.url);
    } else {
      console.debug("⚠️ No token found →", config.url);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/* ============================================================
   RESPONSE INTERCEPTOR — Log + handle Unauthorized (401)
   ============================================================ */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url;

    console.warn("❌ API Error:", status, url);

    if (status === 401) {
      console.warn("🚪 Token invalid → Clearing and redirecting to login");
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      // Only redirect if not already on login page
      if (window.location.pathname !== '/login') {
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

/* ============================================================
   DOCUMENTS API
   ============================================================ */

// GET all documents
export async function getDocuments() {
  const res = await api.get("/documents");

  if (Array.isArray(res.data)) return res.data;
  if (res.data?.documents) return res.data.documents;

  return res.data;
}

// UPLOAD document
export async function uploadDocument(file, onProgress) {
  const formData = new FormData();
  formData.append("document", file);

  const res = await api.post("/documents/upload", formData, {
    onUploadProgress: onProgress,
  });

  return res.data;
}

// DELETE a document
export async function deleteDocument(id) {
  const res = await api.delete(`/documents/${id}`);
  return res.data;
}

/* ============================================================
   AUTH API
   ============================================================ */

export const authAPI = {
  login: (email, password) => api.post("/auth/login", { email, password }),
  register: (name, email, password) =>
    api.post("/auth/register", { name, email, password }),
  getMe: () => api.get("/auth/me"),
};

/* ============================================================
   QUERY API
   ============================================================ */

export async function queryDocuments(question, documentId = null) {
  // Get user settings
  const settings = {
    aiModel: localStorage.getItem('aiModel') || 'llama-3.3-70b-versatile',
    temperature: parseFloat(localStorage.getItem('temperature') || '0.7'),
    maxTokens: parseInt(localStorage.getItem('maxTokens') || '2000'),
    chunkSize: parseInt(localStorage.getItem('chunkSize') || '1000'),
    topK: parseInt(localStorage.getItem('topK') || '3'),
  };

  const res = await api.post("/query", { question, documentId, settings });
  return res.data;
}

/* ============================================================
   HEALTH CHECK
   ============================================================ */

export async function checkHealth() {
  const res = await axios.get(`${API_BASE_URL.replace('/api', '')}/api/health`);
  return res.data;
}

export default api;