// src/utils/settingsUtils.js

/**
 * Get all user settings from localStorage with defaults
 */
export const getSettings = () => {
  return {
    // AI Model Settings
    aiModel: localStorage.getItem('aiModel') || 'llama-3.3-70b-versatile',
    temperature: parseFloat(localStorage.getItem('temperature') || '0.7'),
    maxTokens: parseInt(localStorage.getItem('maxTokens') || '2000'),
    
    // Query Settings
    chunkSize: parseInt(localStorage.getItem('chunkSize') || '1000'),
    topK: parseInt(localStorage.getItem('topK') || '3'),
    
    // Theme Settings
    theme: localStorage.getItem('theme') || 'dark',
    accentColor: localStorage.getItem('accentColor') || 'blue',
    
    // Preferences
    enableNotifications: localStorage.getItem('enableNotifications') !== 'false',
    autoSaveConversations: localStorage.getItem('autoSaveConversations') !== 'false'
  };
};

/**
 * Get only AI-related settings for query requests
 */
export const getAISettings = () => {
  const settings = getSettings();
  return {
    model: settings.aiModel,
    temperature: settings.temperature,
    maxTokens: settings.maxTokens,
    topK: settings.topK
  };
};

/**
 * Get only query-related settings
 */
export const getQuerySettings = () => {
  const settings = getSettings();
  return {
    chunkSize: settings.chunkSize,
    topK: settings.topK
  };
};

/**
 * Save a specific setting
 */
export const saveSetting = (key, value) => {
  localStorage.setItem(key, value.toString());
  
  // Dispatch event so other components can react
  window.dispatchEvent(new CustomEvent('settingChanged', { 
    detail: { key, value } 
  }));
};

/**
 * Listen for settings changes
 */
export const onSettingsChange = (callback) => {
  const handler = (event) => callback(event.detail);
  window.addEventListener('settingsChanged', handler);
  
  // Return cleanup function
  return () => window.removeEventListener('settingsChanged', handler);
};