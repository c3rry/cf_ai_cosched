"use client"; 

import React, { useState, useRef } from 'react';
import './ResumeUpload.css'; 

export default function ResumeUpload() {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(null);
  const inputRef = useRef(null);

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
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === 'application/pdf') {
        setFile(droppedFile);
      } else {
        alert('Please upload a PDF file.');
      }
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    inputRef.current.click();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!file) return;
    console.log('File ready for backend:', file.name);
  };

  return (
    <div className="portal-container">
      <div className="portal-card">
        
        <div className="portal-header">
          <h2>Candidate Portal</h2>
          <p>Upload your resume to begin the matching process.</p>
        </div>

        <form onSubmit={handleSubmit} onDragEnter={handleDrag}>
          <input 
            ref={inputRef}
            type="file" 
            style={{ display: 'none' }} 
            accept=".pdf" 
            onChange={handleChange} 
          />
          
          <div 
            className={`drop-zone ${dragActive ? 'active' : ''} ${file ? 'has-file' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={onButtonClick}
          >
            {file ? (
              <div className="icon-container">
                <svg className="icon-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <p className="text-success">{file.name}</p>
                <p className="text-secondary">Click to change file</p>
              </div>
            ) : (
              <div className="icon-container">
                <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                </svg>
                <p className="text-primary">Drag & drop your PDF here</p>
                <p className="text-secondary">or click to browse</p>
              </div>
            )}
          </div>

          <button type="submit" disabled={!file} className="submit-btn">
            {file ? 'Analyze Profile' : 'Select a file to continue'}
          </button>
        </form>

      </div>
    </div>
  );
}