"use client";
import React, { useState, useEffect } from 'react';
import ResumeUpload from '../src/components/ResumeUpload';
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";

// Ensure you replace YOUR_WORKER_URL if you ever rename your worker!
const WORKER_URL = "https://ingestion.focus-group.workers.dev";

export default function Home() {
  const { user, isLoaded, isSignedIn } = useUser();
  const [jobs, setJobs] = useState([]);
  const [newJob, setNewJob] = useState({ title: '', description: '' });
  
  const [questions, setQuestions] = useState([]);
  const [applyingTo, setApplyingTo] = useState<any>(null);
  const [answers, setAnswers] = useState({});

  const [activeTab, setActiveTab] = useState('jobs'); 
  const [hasUploaded, setHasUploaded] = useState(false);
  
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  const [viewingJobId, setViewingJobId] = useState<string | null>(null);
  const [jobApplications, setJobApplications] = useState([]);

  const [scores, setScores] = useState<Record<string, number>>({});
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [myInterviews, setMyInterviews] = useState([]);

  useEffect(() => {
    if (user?.primaryEmailAddress?.emailAddress) {
      const email = user.primaryEmailAddress.emailAddress;
      const uploadStatus = localStorage.getItem(`cosched_profile_${email}`);
      if (uploadStatus === 'active') {
        setHasUploaded(true);
      }
      fetchInterviews(email);
    }
  }, [user]);

  useEffect(() => {
    fetch(`${WORKER_URL}/jobs`)
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        const rawJobs = Array.isArray(data) ? data : [];
        const parsedJobs = rawJobs.map(job => {
          if (typeof job.questions === 'string') {
            try { return { ...job, questions: JSON.parse(job.questions) }; } 
            catch (e) { return { ...job, questions: [] }; }
          }
          return job;
        });
        setJobs(parsedJobs);
      })
      .catch(() => setJobs([]));
  }, []);

  useEffect(() => {
    if (isSignedIn && user?.id && hasUploaded && jobs.length > 0) {
      jobs.forEach((job: any) => fetchMatchScore(job.id, user.id));
    }
  }, [isSignedIn, user?.id, hasUploaded, jobs]);

  const fetchInterviews = async (email: string) => {
    try {
      const res = await fetch(`${WORKER_URL}/interviews?email=${email}`);
      if (res.ok) {
        setMyInterviews(await res.json());
      }
    } catch (e) { console.error(e); }
  };

  const sendInterviewInvite = async (jobId: string, candidateEmail: string) => {
    try {
      const res = await fetch(`${WORKER_URL}/interviews/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobId, recruiter_id: user?.id, candidate_email: candidateEmail })
      });
      if (res.ok) alert(`Interview invitation sent to ${candidateEmail}!`);
    } catch (e) { alert("Failed to send invite."); }
  };

  // BULLETPROOF SCHEDULING LOGIC
  const scheduleInterview = async (interviewId: string, timeString: string) => {
    try {
      let googleToken = "";
      
      // We safely try to get the token. If this fails, it won't crash the whole app.
      try {
        const tokenRes = await fetch('/api/getToken');
        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          googleToken = tokenData.token || "";
        }
      } catch (err) {
        console.warn("Could not fetch Google Token from Clerk. Continuing without Calendar Sync.");
      }

      const res = await fetch(`${WORKER_URL}/interviews/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          interview_id: interviewId, 
          scheduled_time: timeString, 
          candidate_email: user?.primaryEmailAddress?.emailAddress,
          google_token: googleToken
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.calendarStatus === "Success") {
            alert("Interview Scheduled! An email invite has been sent and synced to your Google Calendar.");
        } else {
            alert("Interview Scheduled in Dashboard! (Note: Google Calendar Sync skipped due to missing OAuth token).");
        }
        if (user?.primaryEmailAddress?.emailAddress) fetchInterviews(user.primaryEmailAddress.emailAddress);
      } else {
        const errData = await res.json();
        alert(`Failed to schedule in database: ${errData.error || 'Unknown Error'}`);
      }
    } catch (e) { 
      console.error(e);
      alert(`Scheduling failed entirely: Please check your console.`); 
    }
  };

  const fetchMatchScore = async (jobId: string, candidateId: string) => {
    const scoreKey = `${jobId}-${candidateId}`;
    if (scores[scoreKey] !== undefined) return;
    try {
      const res = await fetch(`${WORKER_URL}/match?job_id=${jobId}&candidate_id=${candidateId}`);
      if (res.ok) {
        const data = await res.json();
        setScores(prev => ({ ...prev, [scoreKey]: data.score }));
      }
    } catch (e) { console.error("Score fetch failed"); }
  };

  const fetchSummary = async (candidateId: string) => {
    if (summaries[candidateId]) return;
    setSummaries(prev => ({ ...prev, [candidateId]: 'Synthesizing candidate profile...' }));
    try {
      const res = await fetch(`${WORKER_URL}/summary?candidate_id=${candidateId}`);
      if (res.ok) {
        const data = await res.json();
        setSummaries(prev => ({ ...prev, [candidateId]: data.summary }));
      } else {
        setSummaries(prev => ({ ...prev, [candidateId]: 'Failed to generate summary.' }));
      }
    } catch (e) {
      setSummaries(prev => ({ ...prev, [candidateId]: 'Failed to generate summary.' }));
    }
  };

  const confirmUpload = () => {
    if (user?.primaryEmailAddress?.emailAddress) {
      localStorage.setItem(`cosched_profile_${user.primaryEmailAddress.emailAddress}`, 'active');
      setHasUploaded(true);
      setActiveTab('jobs'); 
    }
  };

  const addQuestion = () => {
    setQuestions([...questions, { type: 'free response', text: '', options: ['', ''] } as never]);
  };

  const updateQuestion = (index: number, field: string, value: any) => {
    const updated = [...questions] as any[];
    updated[index][field] = value;
    if (field === 'type' && (value === 'multiple choice' || value === 'multiselect') && !Array.isArray(updated[index].options)) {
      updated[index].options = ['', ''];
    }
    setQuestions(updated as never[]);
  };

  const removeQuestion = (index: number) => {
    const updated = questions.filter((_, i) => i !== index);
    setQuestions(updated);
  };

  const updateOption = (qIndex: number, oIndex: number, value: string) => {
    const updated = [...questions] as any[];
    if (!Array.isArray(updated[qIndex].options)) updated[qIndex].options = ['', ''];
    updated[qIndex].options[oIndex] = value;
    setQuestions(updated as never[]);
  };

  const addOptionToQuestion = (qIndex: number) => {
    const updated = [...questions] as any[];
    if (!Array.isArray(updated[qIndex].options)) updated[qIndex].options = [];
    updated[qIndex].options.push('');
    setQuestions(updated as never[]);
  };

  const removeOptionFromQuestion = (qIndex: number, oIndex: number) => {
    const updated = [...questions] as any[];
    updated[qIndex].options = updated[qIndex].options.filter((_: any, i: number) => i !== oIndex);
    setQuestions(updated as never[]);
  };

  const postJob = async () => {
    if (!newJob.title || !newJob.description) return alert("Please fill all fields");
    const formattedQuestions = questions.map((q: any) => ({
      ...q,
      options: (q.type === 'multiple choice' || q.type === 'multiselect') 
        ? (Array.isArray(q.options) ? q.options.filter(opt => opt.trim() !== '') : [])
        : []
    }));

    try {
      await fetch(`${WORKER_URL}/jobs`, {
        method: 'POST',
        body: JSON.stringify({ 
          ...newJob, 
          recruiter_id: user?.id,
          questions: formattedQuestions 
        }),
        headers: { 'Content-Type': 'application/json' }
      });
      alert("Job & Application Published to cθsched!");
      setNewJob({ title: '', description: '' });
      setQuestions([]);
      const res = await fetch(`${WORKER_URL}/jobs`);
      if (res.ok) {
        const data = await res.json();
        const parsedJobs = data.map((job: any) => {
          if (typeof job.questions === 'string') {
            try { return { ...job, questions: JSON.parse(job.questions) }; } 
            catch (e) { return { ...job, questions: [] }; }
          }
          return job;
        });
        setJobs(Array.isArray(parsedJobs) ? parsedJobs : []);
      }
    } catch (err) { alert("Worker connection failed."); }
  };

  const handleApplyClick = (job: any) => {
    setApplyingTo(job);
    setAnswers({});
  };

  const handleAnswerChange = (questionIndex: number, value: any, isMultiselect = false) => {
    if (isMultiselect) {
      setAnswers((prev: any) => {
        const currentAnswers = prev[questionIndex] || [];
        if (currentAnswers.includes(value)) {
          return { ...prev, [questionIndex]: currentAnswers.filter((v: any) => v !== value) };
        } else {
          return { ...prev, [questionIndex]: [...currentAnswers, value] };
        }
      });
    } else {
      setAnswers(prev => ({ ...prev, [questionIndex]: value }));
    }
  };

  const submitApplication = async () => {
    try {
      const res = await fetch(`${WORKER_URL}/applications`, {
        method: 'POST',
        body: JSON.stringify({
          job_id: applyingTo.id,
          applicant_email: user?.primaryEmailAddress?.emailAddress,
          applicant_id: user?.id,
          answers: answers
        }),
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok) {
        alert("Database Error: " + data.error);
        return;
      }
      alert("Application submitted successfully!");
      setApplyingTo(null);
      setAnswers({});
    } catch (err) { alert("Failed to submit application."); }
  };

  const fetchApplicationsForJob = async (jobId: string) => {
    setViewingJobId(jobId);
    setJobApplications([]);
    try {
      const res = await fetch(`${WORKER_URL}/applications?job_id=${jobId}`);
      if (res.ok) {
        const data = await res.json();
        const apps = Array.isArray(data) ? data : [];
        setJobApplications(apps);
        apps.forEach((app: any) => fetchMatchScore(jobId, app.applicant_id));
      }
    } catch (err) { alert("Failed to fetch applications."); }
  };

  const askChatbot = async () => {
    if (!query) return;
    setLoading(true);
    setAnswer(''); 
    try {
      const response = await fetch(`${WORKER_URL}/chat`, {
        method: 'POST',
        body: JSON.stringify({ query }),
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      setAnswer(data.response || "No response generated.");
    } catch (err) { setAnswer("Could not reach cθsched AI."); }
    setLoading(false);
  };

  if (!isLoaded) return <div style={{ backgroundColor: '#1E2129', minHeight: '100vh' }} />;

  const optionColors = ['#ef4444', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899'];
  const myJobs = jobs.filter((j: any) => j.recruiter_id === user?.id);
  const viewingJob = jobs.find((j: any) => j.id === viewingJobId);

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextDay = new Date(today);
  nextDay.setDate(nextDay.getDate() + 2);

  const mockAvailableSlots = [
    new Date(tomorrow.setHours(10, 0, 0, 0)).toISOString(),
    new Date(tomorrow.setHours(14, 30, 0, 0)).toISOString(),
    new Date(nextDay.setHours(9, 0, 0, 0)).toISOString(),
    new Date(nextDay.setHours(13, 0, 0, 0)).toISOString()
  ];

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
                <button onClick={() => { setActiveTab('jobs'); setApplyingTo(null); }} style={{ background: 'none', border: 'none', color: activeTab === 'jobs' ? '#F38020' : '#9ca3af', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}>Job Board</button>
                <button onClick={() => { setActiveTab('profile'); setApplyingTo(null); }} style={{ background: 'none', border: 'none', color: activeTab === 'profile' ? '#F38020' : '#9ca3af', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}>
                  My AI Profile {hasUploaded && '(Active)'}
                </button>
              </div>
              <button onClick={() => { setActiveTab('recruiter'); setApplyingTo(null); setViewingJobId(null); }} style={{ background: 'none', border: 'none', color: activeTab === 'recruiter' ? '#10b981' : '#9ca3af', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}>Recruiter Dashboard</button>
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
                
                {myInterviews.length > 0 && !applyingTo && (
                  <div style={{ marginBottom: '4rem' }}>
                    <h2 style={{ fontSize: '2rem', marginBottom: '1.5rem', color: '#10b981' }}>My Interviews</h2>
                    {myInterviews.map((invite: any) => (
                      <div key={invite.id} style={{ backgroundColor: '#2A2E38', border: '1px solid #10b981', padding: '2rem', borderRadius: '16px', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <h3 style={{ margin: '0 0 0.5rem 0', color: 'white' }}>{invite.job_title}</h3>
                            <p style={{ margin: 0, color: '#9ca3af' }}>Status: <span style={{ color: invite.status === 'pending' ? '#F38020' : '#10b981', fontWeight: 'bold' }}>{invite.status.toUpperCase()}</span></p>
                          </div>
                          
                          {invite.status === 'pending' && (
                            <div style={{ textAlign: 'right' }}>
                              <p style={{ margin: '0 0 0.5rem 0', color: '#d1d5db', fontSize: '0.9rem' }}>Select a time from Recruiter's Google Calendar:</p>
                              <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {mockAvailableSlots.map(slot => (
                                  <button key={slot} onClick={() => scheduleInterview(invite.id, slot)} style={{ padding: '0.5rem 1rem', backgroundColor: '#1E2129', color: '#10b981', border: '1px solid #10b981', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>
                                    {new Date(slot).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {invite.status === 'scheduled' && (
                            <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', padding: '1rem', borderRadius: '8px', border: '1px dashed #10b981' }}>
                              <p style={{ margin: 0, color: '#10b981', fontWeight: 'bold' }}>📅 {new Date(invite.scheduled_time).toLocaleString()}</p>
                              <p style={{ margin: '0.5rem 0 0 0', color: '#9ca3af', fontSize: '0.85rem' }}>Successfully Scheduled.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {applyingTo ? (
                  <div style={{ padding: '3rem', backgroundColor: '#2A2E38', borderRadius: '16px', border: '1px solid #374151' }}>
                    <button onClick={() => setApplyingTo(null)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      ← Back to Jobs
                    </button>
                    <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: '#F38020' }}>Applying for: {applyingTo.title}</h1>
                    <p style={{ color: '#d1d5db', marginBottom: '3rem', lineHeight: '1.6' }}>{applyingTo.description}</p>
                    
                    {applyingTo.questions && applyingTo.questions.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', marginBottom: '3rem' }}>
                        {applyingTo.questions.map((q: any, idx: number) => (
                          <div key={idx} style={{ backgroundColor: '#1E2129', padding: '2rem', borderRadius: '12px', border: '1px solid #4b5563' }}>
                            <p style={{ fontSize: '1.2rem', marginBottom: '1.5rem', fontWeight: 'bold' }}>{idx + 1}. {q.text}</p>
                            
                            {q.type === 'free response' && (
                              <textarea 
                                value={(answers as any)[idx] || ''}
                                onChange={(e) => handleAnswerChange(idx, e.target.value)}
                                placeholder="Your answer..."
                                style={{ width: '100%', height: '120px', padding: '1rem', backgroundColor: '#2A2E38', border: '1px solid #4b5563', color: 'white', borderRadius: '8px', fontSize: '1rem' }}
                              />
                            )}

                            {q.type === 'multiple choice' && q.options && (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                                {q.options.map((opt: string, oIdx: number) => {
                                  const color = optionColors[oIdx % optionColors.length];
                                  const isSelected = (answers as any)[idx] === opt;
                                  return (
                                    <label key={oIdx} style={{ 
                                      display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer',
                                      padding: '1rem', backgroundColor: isSelected ? `${color}20` : '#2A2E38', 
                                      border: `2px solid ${isSelected ? color : '#4b5563'}`, 
                                      borderRadius: '10px', transition: 'all 0.2s'
                                    }}>
                                      <div style={{ 
                                        width: '20px', height: '20px', borderRadius: '50%', 
                                        border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center' 
                                      }}>
                                        {isSelected && <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: color }} />}
                                      </div>
                                      <input 
                                        type="radio" 
                                        name={`question-${idx}`}
                                        value={opt}
                                        checked={isSelected}
                                        onChange={(e) => handleAnswerChange(idx, e.target.value)}
                                        style={{ display: 'none' }}
                                      />
                                      <span style={{ color: isSelected ? 'white' : '#d1d5db', fontWeight: isSelected ? 'bold' : 'normal' }}>{opt}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}

                            {q.type === 'multiselect' && q.options && (
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
                                {q.options.map((opt: string, oIdx: number) => {
                                  const color = optionColors[oIdx % optionColors.length];
                                  const isSelected = ((answers as any)[idx] || []).includes(opt);
                                  return (
                                    <label key={oIdx} style={{ 
                                      display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer',
                                      padding: '1rem', backgroundColor: isSelected ? `${color}20` : '#2A2E38', 
                                      border: `2px solid ${isSelected ? color : '#4b5563'}`, 
                                      borderRadius: '10px', transition: 'all 0.2s'
                                    }}>
                                      <div style={{ 
                                        width: '20px', height: '20px', borderRadius: '4px', 
                                        border: `2px solid ${color}`, backgroundColor: isSelected ? color : 'transparent',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center' 
                                      }}>
                                        {isSelected && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                                      </div>
                                      <input 
                                        type="checkbox" 
                                        value={opt}
                                        checked={isSelected}
                                        onChange={(e) => handleAnswerChange(idx, e.target.value, true)}
                                        style={{ display: 'none' }}
                                      />
                                      <span style={{ color: isSelected ? 'white' : '#d1d5db', fontWeight: isSelected ? 'bold' : 'normal' }}>{opt}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ color: '#9ca3af', marginBottom: '2rem' }}>This role does not require additional application questions.</p>
                    )}

                    <button onClick={submitApplication} style={{ width: '100%', padding: '1.2rem', backgroundColor: '#F38020', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer' }}>
                      Submit Application
                    </button>
                  </div>
                ) : (
                  <>
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
                            {hasUploaded && (
                              <div style={{ display: 'flex', gap: '0.8rem' }}>
                                <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '0.4rem 0.8rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>AI Matched</span>
                                <span style={{ backgroundColor: 'rgba(243, 128, 32, 0.1)', color: '#F38020', padding: '0.4rem 0.8rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                                  {scores[`${job.id}-${user?.id}`] !== undefined ? `${scores[`${job.id}-${user?.id}`]}% Score` : 'Analyzing...'}
                                </span>
                              </div>
                            )}
                          </div>
                          <p style={{ color: '#d1d5db', marginTop: '1.5rem', lineHeight: '1.8' }}>{job.description}</p>
                          <button onClick={() => handleApplyClick(job)} style={{ marginTop: '2rem', background: 'transparent', border: '2px solid #F38020', color: '#F38020', padding: '0.8rem 2rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Apply Now</button>
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: '4rem 2rem', textAlign: 'center', border: '2px dashed #374151', borderRadius: '16px', color: '#9ca3af', backgroundColor: '#2A2E38' }}>
                        <p style={{ fontSize: '1.3rem', color: '#d1d5db' }}>No active opportunities right now.</p>
                      </div>
                    )}
                  </>
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
                    <ResumeUpload candidateId={user?.id} />
                  </div>

                  <button onClick={confirmUpload} style={{ width: '100%', padding: '1.2rem', backgroundColor: '#F38020', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer' }}>
                    {hasUploaded ? 'Update Profile & Return to Jobs' : 'Save Profile & View Matches'}
                  </button>

                </div>
              </div>
            )}

            {activeTab === 'recruiter' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
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
                      style={{ width: '100%', height: '150px', padding: '1.2rem', backgroundColor: '#1E2129', border: '1px solid #4b5563', color: 'white', borderRadius: '10px', marginBottom: '2rem' }}
                    />

                    <div style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: '#1E2129', borderRadius: '10px', border: '1px dashed #4b5563' }}>
                      <h3 style={{ color: '#10b981', marginBottom: '1.5rem', fontSize: '1.2rem' }}>Application Questions</h3>
                      
                      {questions.map((q: any, idx: number) => (
                        <div key={idx} style={{ marginBottom: '2rem', paddingBottom: '2rem', borderBottom: '1px solid #374151' }}>
                          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                            <select 
                              value={q.type}
                              onChange={(e) => updateQuestion(idx, 'type', e.target.value)}
                              style={{ padding: '0.8rem', backgroundColor: '#2A2E38', border: '1px solid #4b5563', color: 'white', borderRadius: '6px' }}
                            >
                              <option value="free response">Free Response</option>
                              <option value="multiple choice">Multiple Choice</option>
                              <option value="multiselect">Multiselect</option>
                            </select>
                            <button onClick={() => removeQuestion(idx)} style={{ padding: '0.8rem 1rem', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Remove</button>
                          </div>
                          
                          <input 
                            placeholder="Question Text..."
                            value={q.text}
                            onChange={(e) => updateQuestion(idx, 'text', e.target.value)}
                            style={{ width: '100%', padding: '0.8rem', marginBottom: '1rem', backgroundColor: '#2A2E38', border: '1px solid #4b5563', color: 'white', borderRadius: '6px' }}
                          />

                          {(q.type === 'multiple choice' || q.type === 'multiselect') && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '1rem' }}>
                              <p style={{ color: '#9ca3af', fontSize: '0.9rem', margin: '0 0 0.5rem 0' }}>Answer Options:</p>
                              
                              {(Array.isArray(q.options) ? q.options : []).map((opt: string, oIdx: number) => {
                                const color = optionColors[oIdx % optionColors.length];
                                return (
                                  <div key={oIdx} style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                                    <div style={{ width: '8px', height: '100%', minHeight: '36px', backgroundColor: color, borderRadius: '4px' }}></div>
                                    
                                    <input 
                                      placeholder={`Option ${oIdx + 1}`}
                                      value={opt}
                                      onChange={(e) => updateOption(idx, oIdx, e.target.value)}
                                      style={{ flex: 1, padding: '0.8rem', backgroundColor: '#2A2E38', border: '1px solid #4b5563', color: 'white', borderRadius: '6px' }}
                                    />
                                    
                                    {q.options.length > 2 && (
                                      <button 
                                        onClick={() => removeOptionFromQuestion(idx, oIdx)}
                                        style={{ padding: '0.5rem', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.5rem', lineHeight: 1 }}
                                        title="Remove Option"
                                      >
                                        ×
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                              
                              <button 
                                onClick={() => addOptionToQuestion(idx)}
                                style={{ alignSelf: 'flex-start', padding: '0.6rem 1rem', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px dashed #10b981', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', marginTop: '0.5rem' }}
                              >
                                + Add Option
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                      
                      <button onClick={addQuestion} style={{ padding: '0.8rem 1.5rem', backgroundColor: 'transparent', color: '#10b981', border: '1px solid #10b981', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                        + Add Question
                      </button>
                    </div>

                    <button onClick={postJob} style={{ width: '100%', padding: '1.2rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1.1rem' }}>
                      Publish to Board
                    </button>
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

                <section style={{ backgroundColor: '#2A2E38', padding: '3rem', borderRadius: '20px', border: '1px solid #374151' }}>
                  <h2 style={{ fontSize: '2rem', marginBottom: '2rem', color: '#10b981' }}>My Posted Jobs & Applications</h2>
                  
                  {viewingJobId ? (
                    <div>
                      <button onClick={() => setViewingJobId(null)} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        ← Back to My Jobs
                      </button>
                      <h3 style={{ fontSize: '1.8rem', marginBottom: '1rem' }}>Applications for: {viewingJob?.title}</h3>
                      
                      {jobApplications.length === 0 ? (
                        <p style={{ color: '#9ca3af', padding: '2rem', textAlign: 'center', border: '1px dashed #4b5563', borderRadius: '10px' }}>
                          No applications received for this job yet.
                        </p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                          {jobApplications.map((app: any, idx: number) => {
                            let parsedAnswers = {};
                            try {
                              parsedAnswers = typeof app.answers === 'string' ? JSON.parse(app.answers) : app.answers;
                            } catch (e) {}

                            return (
                              <div key={app.id || idx} style={{ backgroundColor: '#1E2129', padding: '2rem', borderRadius: '12px', border: '1px solid #4b5563' }}>
                                <div style={{ borderBottom: '1px solid #374151', paddingBottom: '1.5rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <div>
                                    <h4 style={{ margin: '0 0 0.5rem 0', color: '#10b981', fontSize: '1.5rem' }}>{app.name || 'Candidate'}</h4>
                                    <p style={{ margin: 0, color: '#9ca3af' }}>{app.applicant_email}</p>
                                  </div>
                                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                    <span style={{ backgroundColor: 'rgba(243, 128, 32, 0.1)', color: '#F38020', padding: '0.5rem 1rem', borderRadius: '20px', fontSize: '1rem', fontWeight: 'bold' }}>
                                      {scores[`${viewingJob?.id}-${app.applicant_id}`] !== undefined ? `${scores[`${viewingJob?.id}-${app.applicant_id}`]}% AI Match` : 'Calculating...'}
                                    </span>
                                    <button onClick={() => sendInterviewInvite(viewingJobId, app.applicant_email)} style={{ backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', padding: '0.6rem 1.2rem', fontWeight: 'bold', cursor: 'pointer' }}>
                                      Invite to Interview
                                    </button>
                                  </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                                  <div>
                                    <p style={{ color: '#9ca3af', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>Education</p>
                                    <p style={{ color: 'white', margin: 0 }}>{app.university || 'N/A'}</p>
                                  </div>
                                  <div>
                                    <p style={{ color: '#9ca3af', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>Experience</p>
                                    <p style={{ color: 'white', margin: 0 }}>{app.positions || 'N/A'}</p>
                                  </div>
                                  <div style={{ gridColumn: '1 / -1' }}>
                                    <p style={{ color: '#9ca3af', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>Top Skills</p>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                      {(app.skills || 'N/A').split(',').map((skill: string, i: number) => (
                                        <span key={i} style={{ backgroundColor: '#2A2E38', padding: '0.3rem 0.8rem', borderRadius: '6px', fontSize: '0.85rem', color: '#d1d5db', border: '1px solid #4b5563' }}>{skill.trim()}</span>
                                      ))}
                                    </div>
                                  </div>
                                </div>

                                <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h5 style={{ margin: 0, color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                                      AI Candidate Synthesis
                                    </h5>
                                    {!summaries[app.applicant_id] && (
                                      <button onClick={() => fetchSummary(app.applicant_id)} style={{ padding: '0.5rem 1rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 'bold' }}>
                                        Generate Summary
                                      </button>
                                    )}
                                  </div>
                                  {summaries[app.applicant_id] ? (
                                    <p style={{ color: '#d1d5db', margin: 0, lineHeight: '1.6', fontSize: '0.95rem' }}>{summaries[app.applicant_id]}</p>
                                  ) : (
                                    <p style={{ color: '#6b7280', margin: 0, fontStyle: 'italic', fontSize: '0.9rem' }}>Click generate to analyze this candidate's background against your needs...</p>
                                  )}
                                </div>
                                
                                {viewingJob?.questions && viewingJob.questions.length > 0 ? (
                                  viewingJob.questions.map((q: any, qIdx: number) => {
                                    const rawAns = (parsedAnswers as any)[qIdx];
                                    const displayAns = Array.isArray(rawAns) ? rawAns.join(", ") : (rawAns || "No answer provided");
                                    return (
                                      <div key={qIdx} style={{ marginBottom: '1.5rem' }}>
                                        <p style={{ fontWeight: 'bold', color: '#d1d5db', marginBottom: '0.5rem' }}>Q: {q.text}</p>
                                        <p style={{ color: '#9ca3af', margin: 0, backgroundColor: '#2A2E38', padding: '1rem', borderRadius: '8px' }}>
                                          {displayAns}
                                        </p>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <p style={{ color: '#9ca3af' }}>No custom questions were required for this role.</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      {myJobs.length === 0 ? (
                        <p style={{ color: '#9ca3af' }}>You haven't posted any jobs yet.</p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                          {myJobs.map((job: any) => (
                            <div key={job.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1E2129', padding: '1.5rem 2rem', borderRadius: '12px', border: '1px solid #4b5563' }}>
                              <div>
                                <h3 style={{ margin: '0 0 0.5rem 0', color: 'white', fontSize: '1.3rem' }}>{job.title}</h3>
                                <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.9rem' }}>Job ID: {job.id}</p>
                              </div>
                              <button onClick={() => fetchApplicationsForJob(job.id)} style={{ padding: '0.8rem 1.5rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                                View Applications
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </section>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}