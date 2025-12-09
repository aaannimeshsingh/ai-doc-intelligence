// src/components/Settings.js
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import './Settings.css';

const Settings = () => {
  const { user, logout } = useAuth();

  // Theme Settings
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [accentColor, setAccentColor] = useState(localStorage.getItem('accentColor') || 'blue');

  // AI Model Settings
  const [aiModel, setAiModel] = useState(localStorage.getItem('aiModel') || 'llama-3.3-70b-versatile');
  const [temperature, setTemperature] = useState(parseFloat(localStorage.getItem('temperature') || '0.7'));
  const [maxTokens, setMaxTokens] = useState(parseInt(localStorage.getItem('maxTokens') || '2000'));

  // Query Settings
  const [chunkSize, setChunkSize] = useState(parseInt(localStorage.getItem('chunkSize') || '1000'));
  const [topK, setTopK] = useState(parseInt(localStorage.getItem('topK') || '3'));

  // Loading state
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  // Apply theme immediately when component mounts and when theme/accent changes
  useEffect(() => {
    applyTheme(theme, accentColor);
  }, [theme, accentColor]);

  const applyTheme = (themeValue, accentValue) => {
    console.log('Applying theme:', themeValue, 'accent:', accentValue);
    
    // For 'auto' theme, detect system preference
    let effectiveTheme = themeValue;
    if (themeValue === 'auto') {
      effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    
    // Apply theme to document
    document.documentElement.setAttribute('data-theme', effectiveTheme);
    document.documentElement.setAttribute('data-accent', accentValue);
    
    // Save to localStorage
    localStorage.setItem('theme', themeValue);
    localStorage.setItem('accentColor', accentValue);
  };

  // Listen for system theme changes when in auto mode
  useEffect(() => {
    if (theme === 'auto') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => {
        const effectiveTheme = mediaQuery.matches ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', effectiveTheme);
      };
      
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  const showMessage = (message, type = 'success') => {
    setSaveMessage(message);
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const validateSettings = () => {
    if (temperature < 0 || temperature > 1) {
      showMessage('Temperature must be between 0 and 1', 'error');
      return false;
    }
    if (maxTokens < 100 || maxTokens > 4000) {
      showMessage('Max tokens must be between 100 and 4000', 'error');
      return false;
    }
    if (chunkSize < 100 || chunkSize > 2000) {
      showMessage('Chunk size must be between 100 and 2000', 'error');
      return false;
    }
    if (topK < 1 || topK > 10) {
      showMessage('Top K must be between 1 and 10', 'error');
      return false;
    }
    return true;
  };

  const saveSettings = async () => {
    if (!validateSettings()) return;

    try {
      setSaving(true);

      // Save all settings to localStorage
      localStorage.setItem('theme', theme);
      localStorage.setItem('accentColor', accentColor);
      localStorage.setItem('aiModel', aiModel);
      localStorage.setItem('temperature', temperature.toString());
      localStorage.setItem('maxTokens', maxTokens.toString());
      localStorage.setItem('chunkSize', chunkSize.toString());
      localStorage.setItem('topK', topK.toString());

      showMessage('✅ Settings saved successfully!');
      
      // Dispatch event for other components to pick up changes
      window.dispatchEvent(new CustomEvent('settingsChanged', { 
        detail: { 
          theme, 
          accentColor, 
          aiModel, 
          temperature, 
          maxTokens, 
          chunkSize, 
          topK 
        }
      }));

      // Apply theme immediately
      applyTheme(theme, accentColor);

    } catch (error) {
      console.error('Error saving settings:', error);
      showMessage('❌ Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const resetSettings = () => {
    if (window.confirm('Reset all settings to default values? This will reload the page.')) {
      try {
        const settingsKeys = [
          'theme', 'accentColor', 'aiModel', 'temperature', 
          'maxTokens', 'chunkSize', 'topK'
        ];
        
        settingsKeys.forEach(key => localStorage.removeItem(key));
        
        showMessage('Settings reset! Reloading...');
        setTimeout(() => window.location.reload(), 1000);
      } catch (error) {
        console.error('Error resetting settings:', error);
        showMessage('❌ Failed to reset settings', 'error');
      }
    }
  };

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h1>⚙️ Settings & Preferences</h1>
        <p>Customize your AI Document Intelligence experience</p>
      </div>

      {/* Save Message */}
      {saveMessage && (
        <div className={`save-message ${saveMessage.includes('❌') ? 'error' : 'success'}`}>
          {saveMessage}
        </div>
      )}

      <div className="settings-content">
        {/* Theme Settings */}
        <section className="settings-section">
          <div className="section-header">
            <h2>🎨 Theme & Appearance</h2>
            <p>Customize the look and feel</p>
          </div>

          <div className="setting-item">
            <label className="setting-label">
              <span className="label-text">Theme Mode</span>
              <span className="label-desc">Choose between light and dark mode</span>
            </label>
            <div className="theme-selector">
              <button
                className={`theme-option ${theme === 'light' ? 'active' : ''}`}
                onClick={() => setTheme('light')}
              >
                ☀️ Light
              </button>
              <button
                className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
                onClick={() => setTheme('dark')}
              >
                🌙 Dark
              </button>
              <button
                className={`theme-option ${theme === 'auto' ? 'active' : ''}`}
                onClick={() => setTheme('auto')}
              >
                🔄 Auto
              </button>
            </div>
          </div>

          <div className="setting-item">
            <label className="setting-label">
              <span className="label-text">Accent Color</span>
              <span className="label-desc">Choose your preferred color scheme</span>
            </label>
            <div className="color-selector">
              {['blue', 'purple', 'green', 'orange', 'red', 'pink'].map(color => (
                <button
                  key={color}
                  className={`color-option ${color} ${accentColor === color ? 'active' : ''}`}
                  onClick={() => setAccentColor(color)}
                  title={color.charAt(0).toUpperCase() + color.slice(1)}
                  aria-label={`Select ${color} color`}
                />
              ))}
            </div>
          </div>
        </section>

        {/* AI Model Settings */}
        <section className="settings-section">
          <div className="section-header">
            <h2>🤖 AI Model Configuration</h2>
            <p>Configure how the AI responds to your queries</p>
          </div>

          <div className="setting-item">
            <label className="setting-label">
              <span className="label-text">AI Model</span>
              <span className="label-desc">Choose the language model</span>
            </label>
            <select 
              className="setting-select"
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
            >
              <option value="llama-3.3-70b-versatile">Llama 3.3 70B ⭐ (Recommended - Best Quality)</option>
              <option value="llama-3.1-8b-instant">Llama 3.1 8B ⚡ (Ultra Fast)</option>
            </select>
            <div className="model-description">
              {aiModel === 'llama-3.3-70b-versatile' && (
                <p className="model-info">
                  <strong>Llama 3.3 70B:</strong> Most accurate and intelligent. Best for complex document analysis, 
                  detailed Q&A, and when quality matters most. Slightly slower but worth it.
                </p>
              )}
              {aiModel === 'llama-3.1-8b-instant' && (
                <p className="model-info">
                  <strong>Llama 3.1 8B Instant:</strong> Lightning fast responses! Perfect for quick queries, 
                  simple questions, and when speed is priority. Still very capable for most tasks.
                </p>
              )}
            </div>
          </div>

          <div className="setting-item">
            <label className="setting-label">
              <span className="label-text">Temperature: {temperature.toFixed(1)}</span>
              <span className="label-desc">Controls creativity vs accuracy</span>
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="setting-slider"
            />
            <div className="slider-labels">
              <span>🧊 Focused (0.0)</span>
              <span>⚖️ Balanced (0.5)</span>
              <span>🔥 Creative (1.0)</span>
            </div>
            <div className="temperature-hint">
              {temperature <= 0.3 && (
                <p className="hint">💡 Low temperature = More precise and factual. Great for data extraction!</p>
              )}
              {temperature > 0.3 && temperature < 0.7 && (
                <p className="hint">💡 Balanced temperature = Natural conversation. Perfect for most use cases!</p>
              )}
              {temperature >= 0.7 && (
                <p className="hint">💡 High temperature = More creative and varied. Good for brainstorming!</p>
              )}
            </div>
          </div>

          <div className="setting-item">
            <label className="setting-label">
              <span className="label-text">Max Tokens: {maxTokens}</span>
              <span className="label-desc">Maximum length of AI responses</span>
            </label>
            <input
              type="range"
              min="500"
              max="4000"
              step="100"
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value))}
              className="setting-slider"
            />
            <div className="slider-labels">
              <span>Short (500)</span>
              <span>Medium (2000)</span>
              <span>Long (4000)</span>
            </div>
          </div>
        </section>

        {/* Query Settings */}
        <section className="settings-section">
          <div className="section-header">
            <h2>🔍 Query Configuration</h2>
            <p>Fine-tune document search and retrieval</p>
          </div>

          <div className="setting-item">
            <label className="setting-label">
              <span className="label-text">Chunk Size: {chunkSize} characters</span>
              <span className="label-desc">Size of text chunks for processing</span>
            </label>
            <input
              type="range"
              min="500"
              max="2000"
              step="100"
              value={chunkSize}
              onChange={(e) => setChunkSize(parseInt(e.target.value))}
              className="setting-slider"
            />
            <div className="slider-labels">
              <span>Small (500)</span>
              <span>Medium (1000)</span>
              <span>Large (2000)</span>
            </div>
          </div>

          <div className="setting-item">
            <label className="setting-label">
              <span className="label-text">Top K Results: {topK}</span>
              <span className="label-desc">Number of relevant chunks to retrieve</span>
            </label>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={topK}
              onChange={(e) => setTopK(parseInt(e.target.value))}
              className="setting-slider"
            />
            <div className="slider-labels">
              <span>1</span>
              <span>5</span>
              <span>10</span>
            </div>
          </div>
        </section>

        {/* Account Info */}
        <section className="settings-section">
          <div className="section-header">
            <h2>👤 Account Information</h2>
            <p>Your account details</p>
          </div>
          <div className="account-info">
            <div className="info-item">
              <span className="info-label">Name:</span>
              <span className="info-value">{user?.name || 'N/A'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Email:</span>
              <span className="info-value">{user?.email || 'N/A'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">User ID:</span>
              <span className="info-value" style={{ fontSize: '0.85rem', opacity: 0.7 }}>
                {user?.id || 'N/A'}
              </span>
            </div>
          </div>
          
          <div className="account-actions">
            <button onClick={logout} className="btn-logout">
              🚪 Logout from Account
            </button>
          </div>
        </section>
      </div>

      {/* Action Buttons */}
      <div className="settings-actions">
        <button 
          onClick={resetSettings} 
          className="btn-secondary" 
          disabled={saving}
        >
          🔄 Reset to Defaults
        </button>
        <button 
          onClick={saveSettings} 
          className="btn-primary" 
          disabled={saving}
        >
          {saving ? (
            <>⏳ Saving...</>
          ) : (
            <>💾 Save Settings</>
          )}
        </button>
      </div>
    </div>
  );
};

export default Settings;