"use client";
import React, { useState, useEffect } from 'react';
import ResumeUpload from '../src/components/ResumeUpload';
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";

export default function Home() {
  const { user, isLoaded, isSignedIn } = useUser();
  const [jobs, setJobs] = useState([]);
  const [newJob, setNewJob] = useState({ title: '', description: '' });
  const [activeTab, setActiveTab] = useState('candidate');
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('http://localhost:8787/jobs')
      .then(res => res.json())
      .then(data => setJobs(Array.isArray(data) ? data : []))
      .catch(() => setJobs([]));
  }, []);

  const postJob = async () => {
    if (!newJob.title || !newJob.description) return alert("Please fill all fields");
    try {
      await fetch('http://localhost:8787/jobs', {
        method: 'POST',
        body: JSON.stringify({ ...newJob, recruiter_id: user?.id }),
        headers: { 'Content-Type': 'application/json' }
      });
      alert("Job Published to cθsched!");
      setNewJob({ title: '', description: '' });
      const res = await fetch('http://localhost:8787/jobs');
      const data = await res.json();
      setJobs(data);
    } catch (err) {
      alert("Worker connection failed.");
    }
  };

  const askChatbot = async () => {
    if (!query) return;
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8787/chat', {
        method: 'POST',
        body: JSON.stringify({ query }),
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      setAnswer(data.response);
    } catch (err) {
      setAnswer("Could not reach cθsched AI.");
    }
    setLoading(false);
  };

  // Wait for Clerk to load before showing anything to prevent layout flash
  if (!isLoaded) return <div style={{ backgroundColor: '#1E2129', minHeight: '100vh' }} />;

  return (
    <main style={{ backgroundColor: '#1E2129', minHeight: '100vh', color: 'white', fontFamily: 'sans-serif' }}>
      <nav style={{ padding: '1.2rem 5%', borderBottom: '1px solid #374151', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#2A2E38' }}>
        <h2 style={{ color: '#F38020', fontWeight: '900', letterSpacing: '2px', margin: 0 }}>CΘSCHED</h2>
        <div>
          {!isSignedIn ? (
            <SignInButton mode="modal">
              <button style={{ backgroundColor: '#F38020', color: 'white', padding: '0.6rem 1.8rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Sign In</button>
            </SignInButton>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
              <button onClick={() => setActiveTab('candidate')} style={{ background: 'none', border: 'none', color: activeTab === 'candidate' ? '#F38020' : '#9ca3af', cursor: 'pointer', fontWeight: 'bold' }}>Candidate Portal</button>
              <button onClick={() => setActiveTab('recruiter')} style={{ background: 'none', border: 'none', color: activeTab === 'recruiter' ? '#F38020' : '#9ca3af', cursor: 'pointer', fontWeight: 'bold' }}>Recruiter Dashboard</button>
              <UserButton afterSignOutUrl="/" />
            </div>
          )}
        </div>
      </nav>

      <div style={{ padding: '4rem 5%' }}>
        {!isSignedIn ? (
          <div style={{ textAlign: 'center', marginTop: '15vh' }}>
            <h1 style={{ fontSize: '4rem', marginBottom: '1rem', letterSpacing: '-2px' }}>Welcome to cθsched</h1>
            <p style={{ color: '#9ca3af', fontSize: '1.4rem' }}>Technical recruitment at the edge.</p>
          </div>
        ) : (
          <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            {activeTab === 'recruiter' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '5rem' }}>
                <section style={{ backgroundColor: '#2A2E38', padding: '3rem', borderRadius: '20px', border: '1px solid #374151' }}>
                  <h2 style={{ color: '#F38020', marginBottom: '2rem' }}>Post New Position</h2>
                  <input 
                    placeholder="Job Title" 
                    value={newJob.title}
                    onChange={(e) => setNewJob({...newJob, title: e.target.value})}
                    style={{ width: '100%', padding: '1.2rem', marginBottom: '1.5rem', backgroundColor: '#1E2129', border: '1px solid #4b5563', color: 'white', borderRadius: '10px' }}
                  />
                  <textarea 
                    placeholder="Job Description..." 
                    value={newJob.description}
                    onChange={(e) => setNewJob({...newJob, description: e.target.value})}
                    style={{ width: '100%', height: '200px', padding: '1.2rem', backgroundColor: '#1E2129', border: '1px solid #4b5563', color: 'white', borderRadius: '10px', marginBottom: '2rem' }}
                  />
                  <button onClick={postJob} style={{ width: '100%', padding: '1.2rem', backgroundColor: '#F38020', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>Publish</button>
                </section>

                <section>
                  <h2 style={{ fontSize: '2.5rem', marginBottom: '1.5rem' }}>Talent Search</h2>
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                    <input 
                      value={query} 
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Ask AI about candidates..."
                      style={{ flex: 1, padding: '1.2rem', borderRadius: '10px', border: '1px solid #4b5563', backgroundColor: '#2A2E38', color: 'white' }}
                    />
                    <button onClick={askChatbot} style={{ padding: '1.2rem 2rem', backgroundColor: '#F38020', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>Search</button>
                  </div>
                  <div style={{ backgroundColor: '#2A2E38', padding: '2rem', borderRadius: '16px', border: '1px solid #374151', minHeight: '300px' }}>
                    <p style={{ color: '#d1d5db', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>{answer || "Results will appear here..."}</p>
                  </div>
                </section>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '5rem' }}>
                <section>
                  <h1 style={{ fontSize: '3rem', marginBottom: '2.5rem' }}>Open Opportunities</h1>
                  {jobs.map((job: any) => (
                    <div key={job.id} style={{ padding: '2.5rem', backgroundColor: '#2A2E38', borderRadius: '16px', border: '1px solid #374151', marginBottom: '2rem' }}>
                      <h3 style={{ margin: 0, color: '#F38020', fontSize: '1.8rem' }}>{job.title}</h3>
                      <p style={{ color: '#d1d5db', marginTop: '1.5rem', lineHeight: '1.8' }}>{job.description}</p>
                      <button style={{ marginTop: '2rem', background: 'transparent', border: '2px solid #F38020', color: '#F38020', padding: '0.8rem 2rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Apply Now</button>
                    </div>
                  ))}
                  {jobs.length === 0 && <p style={{ color: '#6b7280' }}>No jobs posted yet.</p>}
                </section>
                <section>
                  <div style={{ backgroundColor: '#2A2E38', padding: '3rem', borderRadius: '20px', border: '1px solid #374151', position: 'sticky', top: '2rem' }}>
                    <h2 style={{ marginBottom: '2rem' }}>Instant Matching</h2>
                    <ResumeUpload />
                  </div>
                </section>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}