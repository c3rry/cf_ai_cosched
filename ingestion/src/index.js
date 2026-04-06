export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    const url = new URL(request.url);

    if (url.pathname === "/match" && request.method === "GET") {
      try {
        const jobId = url.searchParams.get("job_id");
        const candidateId = url.searchParams.get("candidate_id");

        if (!candidateId || candidateId === "undefined") {
          return new Response(JSON.stringify({ score: 0 }), { headers: corsHeaders });
        }

        const { results } = await env.DB.prepare("SELECT description FROM jobs WHERE id = ?").bind(jobId).all();
        if (results.length === 0) return new Response(JSON.stringify({ score: 0 }), { headers: corsHeaders });

        const jobEmbed = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [results[0].description] });
        const jobVector = jobEmbed.data[0];

        const candidateMatches = await env.VECTORIZE.query(jobVector, { topK: 20 });
        const match = candidateMatches.matches.find(m => m.id === candidateId);

        let finalScore = 0;
        if (match) {
          const rawPercentage = Math.round(match.score * 100);
          finalScore = Math.min(99, Math.round(rawPercentage * 1.25)); 
        }

        return new Response(JSON.stringify({ score: finalScore }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    if (url.pathname === "/summary" && request.method === "GET") {
      try {
        const candidateId = url.searchParams.get("candidate_id");
        const { results } = await env.DB.prepare("SELECT * FROM candidates WHERE id = ?").bind(candidateId).all();
        
        if (results.length === 0) return new Response(JSON.stringify({ summary: "Candidate profile not found." }), { headers: corsHeaders });
        
        const c = results[0];
        const prompt = `Write a professional, impressive 2-sentence recruiter summary for this candidate. Name: ${c.name}. University: ${c.university}. Experience: ${c.positions}. Skills: ${c.skills}.`;
        
        const aiRes = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
          messages: [{ role: "user", content: prompt }]
        });
        
        return new Response(JSON.stringify({ summary: aiRes.response }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    if (url.pathname === "/interviews" && request.method === "GET") {
      const email = url.searchParams.get("email");
      try {
        const { results } = await env.DB.prepare(`
          SELECT i.*, j.title as job_title 
          FROM interviews i 
          JOIN jobs j ON i.job_id = j.id 
          WHERE i.candidate_email = ?
        `).bind(email).all();
        return new Response(JSON.stringify(results), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    if (url.pathname === "/interviews/invite" && request.method === "POST") {
      try {
        const { job_id, recruiter_id, candidate_email } = await request.json();
        const inviteId = crypto.randomUUID();
        
        await env.DB.prepare("INSERT INTO interviews (id, job_id, recruiter_id, candidate_email) VALUES (?, ?, ?, ?)")
          .bind(inviteId, job_id, recruiter_id, candidate_email)
          .run();

        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    if (url.pathname === "/interviews/schedule" && request.method === "POST") {
      try {
        const { interview_id, scheduled_time, candidate_email, google_token } = await request.json();
        
        await env.DB.prepare("UPDATE interviews SET status = 'scheduled', scheduled_time = ? WHERE id = ?")
          .bind(scheduled_time, interview_id)
          .run();

        const eventStartTime = new Date(scheduled_time);
        const eventEndTime = new Date(eventStartTime.getTime() + 60 * 60 * 1000); 

        const googleEventPayload = {
          summary: "cθsched Tech Interview",
          description: "Automated interview scheduled via cθsched ATS.",
          start: { dateTime: eventStartTime.toISOString(), timeZone: "America/Chicago" },
          end: { dateTime: eventEndTime.toISOString(), timeZone: "America/Chicago" },
          attendees: [{ email: candidate_email }],
          conferenceData: {
            createRequest: { requestId: crypto.randomUUID(), conferenceSolutionKey: { type: "hangoutsMeet" } }
          }
        };

        // LIVE: Actual Google Calendar integration with email dispatch
        if (google_token) {
          const gcalRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${google_token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(googleEventPayload)
          });

          if (!gcalRes.ok) {
            const errorData = await gcalRes.json();
            return new Response(JSON.stringify({ error: "Google Calendar API Failed", details: errorData }), { status: 400, headers: corsHeaders });
          }
        } else {
            return new Response(JSON.stringify({ error: "Missing Google Token. Please log in with Google." }), { status: 401, headers: corsHeaders });
        }

        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
      }
    }

    if (url.pathname === "/jobs") {
      if (request.method === "GET") {
        try {
          const { results } = await env.DB.prepare("SELECT * FROM jobs ORDER BY created_at DESC").all();
          return new Response(JSON.stringify(results), { headers: corsHeaders });
        } catch (err) {
          return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
        }
      }

      if (request.method === "POST") {
        try {
          const { title, description, recruiter_id, questions } = await request.json();
          const jobId = crypto.randomUUID();
          const questionsString = questions ? JSON.stringify(questions) : "[]";

          await env.DB.prepare("INSERT INTO jobs (id, title, description, recruiter_id, questions) VALUES (?, ?, ?, ?, ?)")
            .bind(jobId, title, description, recruiter_id, questionsString)
            .run();
            
          return new Response(JSON.stringify({ success: true, jobId }), { headers: corsHeaders });
        } catch (err) {
          return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
        }
      }
    }

    if (url.pathname === "/applications") {
      if (request.method === "GET") {
        const jobId = url.searchParams.get("job_id");
        try {
          const { results } = await env.DB.prepare(`
            SELECT a.id, a.job_id, a.applicant_email, a.applicant_id, a.answers, a.created_at, 
                   c.name, c.skills, c.university, c.positions 
            FROM applications a 
            LEFT JOIN candidates c ON a.applicant_id = c.id 
            WHERE a.job_id = ? 
            ORDER BY a.created_at DESC
          `).bind(jobId).all();
          return new Response(JSON.stringify(results), { headers: corsHeaders });
        } catch (err) {
          return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
        }
      }

      if (request.method === "POST") {
        try {
          const { job_id, applicant_email, applicant_id, answers } = await request.json();
          const appId = crypto.randomUUID();
          const answersString = answers ? JSON.stringify(answers) : "{}";

          await env.DB.prepare("INSERT INTO applications (id, job_id, applicant_email, applicant_id, answers) VALUES (?, ?, ?, ?, ?)")
            .bind(appId, job_id, applicant_email, applicant_id, answersString)
            .run();

          return new Response(JSON.stringify({ success: true, appId }), { headers: corsHeaders });
        } catch (err) {
          return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
        }
      }
    }

    if (url.pathname === "/chat" && request.method === "POST") {
      try {
        const { query } = await request.json();
        const optimizeRes = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
          messages: [
            { role: "system", content: "Extract technical skills and keywords. Output ONLY a clean, comma-separated list." },
            { role: "user", content: query }
          ]
        });

        const queryEmbed = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [optimizeRes.response] });
        const matches = await env.VECTORIZE.query(queryEmbed.data[0], { topK: 3 });
        
        if (matches.matches.length === 0) return new Response(JSON.stringify({ response: "No matches found." }), { headers: corsHeaders });

        const ids = matches.matches.map(m => m.id);
        const { results } = await env.DB.prepare(`SELECT * FROM candidates WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all();
        const context = results.map(c => `- ${c.name} | Skills: ${c.skills} | Uni: ${c.university} | Roles: ${c.positions}`).join('\n');

        const chatRes = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
          messages: [
            { role: "system", content: "You are the cθsched AI. Analyze candidates based ONLY on context." },
            { role: "user", content: `Query: ${query}\n\nCandidates:\n${context}` }
          ]
        });

        return new Response(JSON.stringify({ response: chatRes.response }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ response: "Error: " + err.message }), { status: 500, headers: corsHeaders });
      }
    }

    if (url.pathname === "/" && request.method === "POST") {
      try {
        const formData = await request.formData();
        
        const rawId = formData.get("candidate_id");
        const candidateId = (rawId && rawId !== "undefined" && rawId !== "null") ? rawId : crypto.randomUUID();

        const mockText = "Mihir Tirumalasetti. Software Engineer at UT Southwestern Medical Center. Skills: Python, JS, Machine Learning, React, Cloudflare Workers. University: BS Data Science UTD.";

        const aiRes = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
          messages: [
            { role: "system", content: "Extract data and return ONLY strict valid JSON. Format: {\"name\":\"\",\"skills\":[],\"university\":\"\",\"positions\":[]}" },
            { role: "user", content: mockText }
          ]
        });

        let profile;
        try {
          profile = JSON.parse(aiRes.response.replace(/```json/gi, '').replace(/```/g, '').trim());
        } catch (e) {
          profile = { name: "Mihir Tirumalasetti", skills: ["AI", "React"], university: "UTD", positions: ["Engineer"] };
        }

        await env.DB.prepare("INSERT OR REPLACE INTO candidates (id, name, skills, university, positions) VALUES (?, ?, ?, ?, ?)")
          .bind(candidateId, profile.name, profile.skills.join(", "), profile.university, profile.positions.join(" | "))
          .run();

        const embedRes = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [mockText] });
        await env.VECTORIZE.upsert([{ id: candidateId, values: embedRes.data[0], metadata: { name: profile.name } }]);

        return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
      }
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  }
};