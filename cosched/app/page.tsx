"use client";
import React, { useState, useEffect } from 'react';
import ResumeUpload from '../src/components/ResumeUpload';
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";

export default function Home() {
  const { user, isLoaded, isSignedIn } = useUser();
  const [jobs, setJobs] = useState([]);
  const [newJob, setNewJob] = useState({ title: '', description: '' });
  
  const [activeTab, setActiveTab] = useState('jobs'); 
  const [hasUploaded, setHasUploaded] = useState(false);
  
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.primaryEmailAddress?.emailAddress) {
      const email = user.primaryEmailAddress.emailAddress;
      const uploadStatus = localStorage.getItem(`cosched_profile_${email}`);
      if (uploadStatus === 'active') {
        setHasUploaded(true);
      }
    }
  }, [user]);

  useEffect(() => {
    fetch('http://localhost:8787/jobs')
      .then(res => res.ok ? res.json() : [])
      .then(data => setJobs(Array.isArray(data) ? data : []))
      .catch(() => setJobs([]));
  }, []);

  const confirmUpload = () => {
    if (user?.primaryEmailAddress?.emailAddress) {
      localStorage.setItem(`cosched_profile_${user.primaryEmailAddress.emailAddress}`, 'active');
      setHasUploaded(true);
      setActiveTab('jobs'); 
    }
  };

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
      if (res.ok) {
        const data = await res.json();
        setJobs(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      alert("Worker connection failed.");
    }
  };

  const askChatbot = async () => {
    if (!query) return;
    setLoading(true);
    setAnswer(''); 
    try {
      const response = await fetch('http://localhost:8787/chat', {
        method: 'POST',
        body: JSON.stringify({ query }),
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      setAnswer(data.response || "No response generated.");
    } catch (err) {
      setAnswer("Could not reach cθsched AI.");
    }
    setLoading(false);
  };

  if (!isLoaded) return <div style={{ backgroundColor: '#1E2129', minHeight: '100vh' }} />;

  return (
    <main style={{ backgroundColor: '#1E2129', minHeight: '100vh', color: 'white', fontFamily: 'sans-serif' }}>
      <style>{`
        @keyframes shimmer {
          0% { left: -100%; }
          100% { left: 100%; }
        }
      `}</style>

      <nav style={{ padding: '1.2rem 5%', borderBottom: '1px solid #374151', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#2A2E38' }}>
        <h2 style={{ color: '#F38020', fontWeight: '900', letterSpacing: '2px', margin: 0 }}>CΘSCHED</h2>
        <div>
          {!isSignedIn ? (
            <SignInButton mode="modal">
              <button style={{ backgroundColor: '#F38020', color: 'white', padding: '0.6rem 1.8rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Sign In</button>
            </SignInButton>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
              <div style={{ display: 'flex', gap: '1.5rem', borderRight: '1px solid #4b5563', paddingRight: '2rem' }}>
                <button onClick={() => setActiveTab('jobs')} style={{ background: 'none', border: 'none', color: activeTab === 'jobs' ? '#F38020' : '#9ca3af', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}>Job Board</button>
                <button onClick={() => setActiveTab('profile')} style={{ background: 'none', border: 'none', color: activeTab === 'profile' ? '#F38020' : '#9ca3af', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}>
                  My AI Profile {hasUploaded && '(Active)'}
                </button>
              </div>
              <button onClick={() => setActiveTab('recruiter')} style={{ background: 'none', border: 'none', color: activeTab === 'recruiter' ? '#10b981' : '#9ca3af', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}>Recruiter Dashboard</button>
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
            
            {activeTab === 'jobs' && (
              <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                <h1 style={{ fontSize: '3rem', marginBottom: '2rem' }}>Open Opportunities</h1>
                
                {!hasUploaded && (
                  <div style={{ backgroundColor: 'rgba(243, 128, 32, 0.1)', border: '1px solid #F38020', padding: '1.5rem', borderRadius: '12px', marginBottom: '2.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ margin: '0 0 0.5rem 0', color: '#F38020' }}>Optimize Your Search</h3>
                      <p style={{ margin: 0, color: '#d1d5db' }}>Upload your resume to see which roles mathematically match your skills.</p>
                    </div>
                    <button onClick={() => setActiveTab('profile')} style={{ backgroundColor: '#F38020', color: 'white', border: 'none', padding: '0.8rem 1.5rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Set Up Profile</button>
                  </div>
                )}

                {Array.isArray(jobs) && jobs.length > 0 ? (
                  jobs.map((job: any) => (
                    <div key={job.id} style={{ padding: '2.5rem', backgroundColor: '#2A2E38', borderRadius: '16px', border: '1px solid #374151', marginBottom: '2rem', transition: 'transform 0.2s', cursor: 'pointer' }} onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: 0, color: '#F38020', fontSize: '1.8rem' }}>{job.title}</h3>
                        {hasUploaded && <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '0.4rem 0.8rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>AI Matched</span>}
                      </div>
                      <p style={{ color: '#d1d5db', marginTop: '1.5rem', lineHeight: '1.8' }}>{job.description}</p>
                      <button style={{ marginTop: '2rem', background: 'transparent', border: '2px solid #F38020', color: '#F38020', padding: '0.8rem 2rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Apply Now</button>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '4rem 2rem', textAlign: 'center', border: '2px dashed #374151', borderRadius: '16px', color: '#9ca3af', backgroundColor: '#2A2E38' }}>
                    <p style={{ fontSize: '1.3rem', color: '#d1d5db' }}>No active opportunities right now.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'profile' && (
              <div style={{ maxWidth: '700px', margin: '0 auto' }}>
                <div style={{ backgroundColor: '#2A2E38', padding: '4rem 3rem', borderRadius: '20px', border: '1px solid #374151', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
                  
                  {hasUploaded ? (
                    <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                      <div style={{ width: '60px', height: '60px', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </div>
                      <h2 style={{ fontSize: '2rem', marginBottom: '0.5rem', color: 'white' }}>Profile Active</h2>
                      <p style={{ color: '#9ca3af', fontSize: '1.1rem' }}>Your vector embeddings are currently linked to <strong>{user?.primaryEmailAddress?.emailAddress}</strong>.</p>
                      <p style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '1rem' }}>Upload a new PDF below to overwrite your existing AI profile.</p>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                      <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: '#F38020' }}>Initialize Your Profile</h2>
                      <p style={{ color: '#9ca3af', fontSize: '1.1rem' }}>
                        Upload your latest resume. Our edge network will extract your skills and create a mathematical vector mapping to automatically match you with roles.
                      </p>
                    </div>
                  )}
                  
                  <div style={{ backgroundColor: '#1E2129', borderRadius: '12px', padding: '1.5rem', border: '1px dashed #4b5563', marginBottom: '2rem' }}>
                    <ResumeUpload />
                  </div>

                  <button onClick={confirmUpload} style={{ width: '100%', padding: '1.2rem', backgroundColor: '#F38020', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer' }}>
                    {hasUploaded ? 'Update Profile & Return to Jobs' : 'Save Profile & View Matches'}
                  </button>

                </div>
              </div>
            )}

            {activeTab === 'recruiter' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '5rem' }}>
                <section style={{ backgroundColor: '#2A2E38', padding: '3rem', borderRadius: '20px', border: '1px solid #374151' }}>
                  <h2 style={{ color: '#10b981', marginBottom: '2rem' }}>Post New Position</h2>
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
                  <button onClick={postJob} style={{ width: '100%', padding: '1.2rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer' }}>Publish to Board</button>
                </section>

                <section>
                  <h2 style={{ fontSize: '2.5rem', marginBottom: '1.5rem' }}>AI Talent Search</h2>
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                    <input 
                      value={query} 
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Ask AI about candidates..."
                      disabled={loading}
                      style={{ flex: 1, padding: '1.2rem', borderRadius: '10px', border: '1px solid #4b5563', backgroundColor: '#2A2E38', color: 'white', opacity: loading ? 0.5 : 1 }}
                    />
                    <button onClick={askChatbot} disabled={loading} style={{ padding: '1.2rem 2rem', backgroundColor: loading ? '#4b5563' : '#10b981', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer' }}>
                      {loading ? 'Searching...' : 'Search'}
                    </button>
                  </div>
                  
                  <div style={{ backgroundColor: '#2A2E38', padding: '2rem', borderRadius: '16px', border: '1px solid #374151', minHeight: '300px' }}>
                    {loading ? (
                      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', marginTop: '2rem' }}>
                        <p style={{ color: '#9ca3af', marginBottom: '1.5rem', fontSize: '1rem', textAlign: 'center' }}>
                          Parsing intent, scanning vector index, and synthesizing match logic...
                        </p>
                        <div style={{ width: '100%', height: '4px', backgroundColor: '#1E2129', borderRadius: '2px', overflow: 'hidden', position: 'relative' }}>
                          <div style={{ position: 'absolute', top: 0, bottom: 0, width: '40%', backgroundColor: '#10b981', borderRadius: '2px', animation: 'shimmer 1.5s infinite ease-in-out' }}></div>
                        </div>
                      </div>
                    ) : (
                      <p style={{ color: '#d1d5db', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>{answer || "Results will appear here..."}</p>
                    )}
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