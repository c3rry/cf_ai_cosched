"use client";
import React, { useState } from 'react';

export default function ResumeUpload({ candidateId }) {
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (e) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    setIsUploading(true);
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("resume", file);
    
    // CRITICAL: Send the Clerk ID to the backend so it links to you
    if (candidateId) {
      formData.append("candidate_id", candidateId);
    }

    try {
      const res = await fetch("http://localhost:8787/", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Upload failed");
      }

      alert("Resume successfully analyzed and indexed by AI!");
    } catch (err) {
      alert("Failed to process resume.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div style={{ textAlign: 'center', padding: '2rem', border: '2px dashed #4b5563', borderRadius: '10px' }}>
      <input 
        type="file" 
        accept=".pdf,.txt,.docx" 
        onChange={handleUpload} 
        disabled={isUploading}
        style={{ display: 'none' }}
        id="resume-upload"
      />
      <label htmlFor="resume-upload" style={{ cursor: isUploading ? 'wait' : 'pointer', color: '#10b981', fontWeight: 'bold' }}>
        {isUploading ? "Processing via AI Edge..." : "Click to Upload Resume (PDF/TXT)"}
      </label>
    </div>
  );
}