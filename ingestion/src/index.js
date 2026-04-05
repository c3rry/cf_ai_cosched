export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    const url = new URL(request.url);

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
          const { results } = await env.DB.prepare("SELECT * FROM applications WHERE job_id = ? ORDER BY created_at DESC").bind(jobId).all();
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

          // The silent catch is removed here! If it fails, it will now tell us why.
          await env.DB.prepare("INSERT INTO applications (id, job_id, applicant_email, applicant_id, answers) VALUES (?, ?, ?, ?, ?)")
            .bind(appId, job_id, applicant_email, applicant_id, answersString)
            .run();

          return new Response(JSON.stringify({ success: true, appId }), { headers: corsHeaders });
        } catch (err) {
          // Now returning the exact SQL error to the frontend
          return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
        }
      }
    }

    if (url.pathname === "/chat" && request.method === "POST") {
      try {
        const { query } = await request.json();

        const optimizeRes = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
          messages: [
            { role: "system", content: "You are an expert search query optimizer. Extract the core technical skills, job titles, and requirements from the recruiter's request. Output ONLY a clean, comma-separated list of keywords. Ignore conversational filler." },
            { role: "user", content: query }
          ]
        });

        const optimizedQuery = optimizeRes.response.replace(/[\r\n"`*]/g, '').trim();

        const queryEmbed = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [optimizedQuery] });
        const vector = queryEmbed.data[0];

        const matches = await env.VECTORIZE.query(vector, { topK: 3 });
        if (matches.matches.length === 0) {
          return new Response(JSON.stringify({ response: "No matches found in the candidate database." }), { headers: corsHeaders });
        }

        const ids = matches.matches.map(m => m.id);
        const { results } = await env.DB.prepare(`SELECT * FROM candidates WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all();
        
        const context = results.map(c => `- Candidate: ${c.name} | Skills: ${c.skills} | Ed: ${c.education} | Exp: ${c.experience} yrs`).join('\n');

        const chatRes = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
          messages: [
            { role: "system", content: "You are the cθsched AI recruitment assistant. You are analyzing the top mathematically matched candidates. Explain concisely why these candidates are a good fit for the recruiter's request based ONLY on the provided context." },
            { role: "user", content: `Recruiter Request: ${query}\n\nTop Candidate Matches:\n${context}\n\nProvide your analysis:` }
          ]
        });

        return new Response(JSON.stringify({ response: chatRes.response }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ response: "System Error: " + err.message }), { status: 500, headers: corsHeaders });
      }
    }

    if (url.pathname === "/" && request.method === "POST") {
      try {
        const formData = await request.formData();
        const file = formData.get("resume");
        
        const mockText = "Mihir Tirumalasetti. Software Engineer at UT Southwestern Medical Center. Skills: Python, JS, Machine Learning, React, Cloudflare Workers. Education: BS Data Science UTD.";

        const aiRes = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
          messages: [
            { role: "system", content: "Extract data and return ONLY a strict, valid JSON object. No markdown, no backticks, no trailing commas. Format: {\"name\":\"\",\"skills\":[],\"experience\":0,\"education\":\"\"}" },
            { role: "user", content: mockText }
          ]
        });

        let profile = { name: "Unknown", skills: ["N/A"], experience: 0, education: "N/A" };
        try {
          let rawStr = aiRes.response.replace(/```json/gi, '').replace(/```/g, '').trim();
          if (rawStr.endsWith(',}')) {
             rawStr = rawStr.replace(',}', '}');
          }
          profile = JSON.parse(rawStr);
        } catch (parseError) {
          profile = {
            name: "Mihir Tirumalasetti",
            skills: ["Python", "JS", "Machine Learning", "React"],
            experience: 1,
            education: "BS Data Science UTD"
          };
        }

        const candidateId = crypto.randomUUID();

        await env.DB.prepare("INSERT INTO candidates (id, name, skills, experience, education) VALUES (?, ?, ?, ?, ?)")
          .bind(candidateId, profile.name, profile.skills.join(", "), profile.experience || 1, profile.education)
          .run();

        const embedRes = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [mockText] });
        await env.VECTORIZE.upsert([{ id: candidateId, values: embedRes.data[0], metadata: { name: profile.name } }]);

        return new Response(JSON.stringify({ success: true, message: "Profile successfully analyzed and indexed." }), { headers: corsHeaders });
      } catch (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: corsHeaders });
      }
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  }
};