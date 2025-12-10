// src/config/api.js
// Simple, bulletproof API configuration

// Check if we're running locally or in production
const isLocalhost = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// Set API URL based on environment
export const API_URL = isLocalhost 
  ? 'http://localhost:5001' 
  : 'https://ai-doc-intelligence-backend-7bkp.onrender.com';

// Helper function to get auth headers
export const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

// Helper for making authenticated requests
export const apiCall = async (endpoint, options = {}) => {
  const url = `${API_URL}${endpoint}`;
  const response = await fetch(url, {
    headers: getAuthHeaders(),
    ...options
  });
  return response;
};

// Log the API URL (helps with debugging)
console.log('🌐 API URL:', API_URL);