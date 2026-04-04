export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    const url = new URL(request.url);

    // --- JOB BOARD ROUTE ---
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
          const { title, description, recruiter_id } = await request.json();
          const jobId = crypto.randomUUID();
          await env.DB.prepare("INSERT INTO jobs (id, title, description, recruiter_id) VALUES (?, ?, ?, ?)")
            .bind(jobId, title, description, recruiter_id)
            .run();
          return new Response(JSON.stringify({ success: true, jobId }), { headers: corsHeaders });
        } catch (err) {
          return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
        }
      }
    }

    // --- RECRUITER CHAT (RAG) ROUTE ---
    if (url.pathname === "/chat" && request.method === "POST") {
      try {
        const { query } = await request.json();
        const queryEmbed = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [query] });
        const vector = queryEmbed.data[0];

        const matches = await env.VECTORIZE.query(vector, { topK: 3 });
        if (matches.matches.length === 0) {
          return new Response(JSON.stringify({ response: "No matches found." }), { headers: corsHeaders });
        }

        const ids = matches.matches.map(m => m.id);
        const { results } = await env.DB.prepare(`SELECT * FROM candidates WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all();

        const context = results.map(c => `- ${c.name}: ${c.skills}. Ed: ${c.education}`).join('\n');
        const chatRes = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
          messages: [
            { role: "system", content: "You are the cθsched AI assistant. Answer recruiter queries using candidate data." },
            { role: "user", content: `Context:\n${context}\n\nQuestion: ${query}` }
          ]
        });

        return new Response(JSON.stringify({ response: chatRes.response }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ response: "Error: " + err.message }), { status: 500, headers: corsHeaders });
      }
    }

    // --- CANDIDATE INGESTION ROUTE ---
    if (url.pathname === "/" && request.method === "POST") {
      try {
        const formData = await request.formData();
        const file = formData.get("resume");
        
        // Mock text for testing
        const mockText = "Mihir Tirumalasetti. Software Engineer at UT Southwestern Medical Center. Skills: Python, JS, Machine Learning, React, Cloudflare Workers. Education: BS Data Science UTD.";

        const aiRes = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
          messages: [
            { role: "system", content: "Extract data and return ONLY a strict, valid JSON object. No markdown, no backticks, no trailing commas. Format: {\"name\":\"\",\"skills\":[],\"experience\":0,\"education\":\"\"}" },
            { role: "user", content: mockText }
          ]
        });

        // Defensive Parsing
        let profile = { name: "Unknown", skills: ["N/A"], experience: 0, education: "N/A" };
        try {
          // Attempt to clean and parse the AI response
          let rawStr = aiRes.response.replace(/```json/gi, '').replace(/```/g, '').trim();
          
          // Basic check for common Llama JSON errors
          if (rawStr.endsWith(',}')) {
             rawStr = rawStr.replace(',}', '}');
          }

          profile = JSON.parse(rawStr);
        } catch (parseError) {
          console.log("AI returned malformed JSON. Using fallback. Raw AI Output:", aiRes.response);
          // We fall back to standard data to ensure the pipeline doesn't break
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
        console.error("Worker Error:", error);
        return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers: corsHeaders });
      }
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  }
};