// src/components/DocumentUpload.js
import React, { useState } from 'react';
import { uploadDocument } from '../services/api';
import './DocumentUpload.css';

function DocumentUpload({ onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const allowedTypes = [
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!allowedTypes.includes(selectedFile.type)) {
        setMessage('error:Only PDF, DOC, DOCX, or TXT files are allowed.');
        return;
      }
      if (selectedFile.size > MAX_SIZE) {
        setMessage('error:File size exceeds 10MB limit.');
        return;
      }
      setFile(selectedFile);
      setMessage('');
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const dropped = e.dataTransfer?.files?.[0];
    if (dropped) {
      if (!allowedTypes.includes(dropped.type)) {
        setMessage('error:Only PDF, DOC, DOCX, or TXT files are allowed.');
        return;
      }
      if (dropped.size > MAX_SIZE) {
        setMessage('error:File size exceeds 10MB limit.');
        return;
      }
      setFile(dropped);
      setMessage('');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage('error:Please select a file before uploading.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setMessage('');

    try {
      await uploadDocument(file, (progressEvent) => {
        if (progressEvent && progressEvent.total) {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percent);
        }
      });

      setMessage('success:Upload successful!');
      setFile(null);
      setUploadProgress(0);

      // allow parent to refresh list
      if (typeof onUploadSuccess === 'function') {
        setTimeout(() => onUploadSuccess(), 600);
      }
    } catch (err) {
      // prefer server-side message
      const serverMsg = err?.response?.data?.message || err?.response?.data || err?.message;
      console.error('Upload error:', err);
      setMessage(`error:${serverMsg || 'Upload failed. Please try again.'}`);
    } finally {
      setUploading(false);
    }
  };

  const clearFile = () => {
    setFile(null);
    setMessage('');
    setUploadProgress(0);
  };

  const getFileIcon = (fileName) => {
    if (!fileName) return '📄';
    const ext = fileName.split('.').pop().toLowerCase();
    const iconMap = {
      pdf: '📕',
      doc: '📘',
      docx: '📘',
      txt: '📝',
      xls: '📊',
      xlsx: '📊',
      ppt: '📙',
      pptx: '📙',
    };
    return iconMap[ext] || '📄';
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round(bytes / Math.pow(k, i) * 100) / 100} ${sizes[i]}`;
  };

  // robust message parsing (handles messages without colon)
  const colonIndex = message.indexOf(':');
  const messageType = colonIndex === -1 ? (message ? 'info' : '') : message.slice(0, colonIndex);
  const messageText = colonIndex === -1 ? message : message.slice(colonIndex + 1);

  return (
    <div className="upload-container">
      <div className="upload-header">
        <h2 className="upload-title">Upload Your Documents</h2>
        <p className="upload-description">
          Support for PDF, DOC, DOCX, TXT files • Max size 10MB
        </p>
      </div>

      <div
        className={`drop-zone ${dragActive ? 'drag-active' : ''} ${file ? 'has-file' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {!file ? (
          <>
            <div className="drop-icon">📤</div>
            <h3 className="drop-title">Drag & Drop your file here</h3>
            <p className="drop-subtitle">or</p>
            <label className="file-input-label">
              <input
                type="file"
                onChange={handleFileChange}
                accept=".pdf,.txt,.doc,.docx"
                className="file-input-hidden"
              />
              <span className="browse-button">Browse Files</span>
            </label>
          </>
        ) : (
          <div className="file-preview">
            <div className="file-icon">{getFileIcon(file.name)}</div>
            <div className="file-info">
              <div className="file-name">{file.name}</div>
              <div className="file-size">{formatFileSize(file.size)}</div>
              {uploading && (
                <div className="progress-row">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${uploadProgress}%` }}
                      aria-valuenow={uploadProgress}
                    />
                  </div>
                  <div className="progress-text">{uploadProgress}%</div>
                </div>
              )}
            </div>
            <button className="remove-button" onClick={clearFile}>
              ✕
            </button>
          </div>
        )}
      </div>

      {file && (
        <button
          onClick={handleUpload}
          disabled={uploading}
          className={`upload-button ${uploading ? 'uploading' : ''}`}
        >
          {uploading ? (
            <>
              <span className="spinner" />
              <span>Uploading... {uploadProgress}%</span>
            </>
          ) : (
            <>
              <span>🚀</span>
              <span>Upload Document</span>
            </>
          )}
        </button>
      )}

      {message && (
        <div className={`message ${messageType}`}>
          <span className="message-icon">{messageType === 'success' ? '✓' : '⚠'}</span>
          <span>{messageText}</span>
        </div>
      )}
    </div>
  );
}

export default DocumentUpload;
