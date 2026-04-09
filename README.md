cθsched (cf_ai_cosched)

Technical recruitment at the edge. cθsched is an AI-powered Applicant Tracking System (ATS) built entirely on Cloudflare's Edge infrastructure and Next.js. It leverages vector embeddings, large language models, and automated scheduling to mathematically match candidates to roles and streamline the hiring pipeline.

Live Demo: https://cf-ai-cosched-pm4s.vercel.app/

--------------------------------------------------

SYSTEM ARCHITECTURE & TECHNOLOGIES

The platform is divided into a serverless edge backend and a React-based frontend, communicating via REST APIs.

Frontend
- Framework: Next.js (App Router) / React
- Authentication: Clerk (OAuth integration, specifically Google for Calendar scopes)
- Hosting: Vercel

Edge Backend
- Compute: Cloudflare Workers (Handling all API routing and business logic)
- Database: Cloudflare D1 (Serverless SQLite for relational data)
- Vector Database: Cloudflare Vectorize (For high-dimensional semantic search)
- AI Inference: Cloudflare Workers AI
  - @cf/meta/llama-3-8b-instruct for natural language processing, JSON extraction, and RAG synthesis.
  - @cf/baai/bge-base-en-v1.5 for generating 768-dimensional text embeddings.
- External APIs: Google Calendar API (v3) for automated interview scheduling and Google Meet link generation.

--------------------------------------------------

CORE PIPELINES & DATA FLOW

cθsched relies on several asynchronous pipelines to process data from the moment a candidate uploads a resume to the moment they are scheduled for an interview.

1. Resume Ingestion & Vectorization Pipeline
When a candidate uploads a resume, the system transforms unstructured text into searchable mathematical vectors and relational data.
- The frontend securely passes the raw text and the user's Clerk ID to the Cloudflare Worker.
- Data Extraction: The worker prompts llama-3-8b-instruct with a strict system prompt to parse the unstructured text and return a strictly formatted JSON object containing the candidate's Name, University, Skills, and Experience.
- Relational Storage: The parsed JSON is stored in the Cloudflare D1 "candidates" table, permanently linked to the user's Clerk ID.
- Vector Generation: The worker sends the raw resume text to bge-base-en-v1.5 to generate a 768-dimensional floating-point vector.
- Index Upsertion: The vector is upserted into Cloudflare Vectorize using the Clerk ID as the vector identifier, alongside metadata for quick filtering.

2. AI Match Scoring Engine
Rather than relying on keyword matching, jobs and candidates are matched semantically based on the distance between their vectors.
- When a candidate views the Job Board, the frontend requests match scores for each active job.
- The worker retrieves the job description from D1 and passes it through bge-base-en-v1.5 to generate a job vector.
- The worker queries Vectorize to calculate the Cosine Similarity between the job vector and the specific candidate's vector.
- The raw similarity score is mathematically curved on the backend to output a standard ATS percentage (e.g., 0-99%), allowing candidates and recruiters to instantly see contextual alignment.

3. Semantic Talent Search (RAG Pipeline)
Recruiters can query their candidate pool using natural language (e.g., "Find me a frontend engineer with React experience from UTD").
- Intent Parsing: llama-3-8b-instruct parses the recruiter's natural language query to extract core technical requirements and keywords.
- Semantic Search: The extracted keywords are embedded via bge-base-en-v1.5 and queried against the Vectorize index to find the top K closest candidate vectors.
- Context Retrieval: The worker takes the IDs of the top vectors and runs a SQL query against D1 to retrieve the full relational profiles of those specific candidates.
- Synthesis: The retrieved profiles and the original query are fed back into llama-3-8b-instruct as context. The model generates a synthesized, conversational response evaluating the best matches for the recruiter's query.

4. Automated Interview & Calendar Sync Pipeline
The platform integrates directly with Google OAuth to handle real-world scheduling without leaving the dashboard.
- The recruiter clicks "Invite to Interview," which updates the D1 "interviews" table status to "pending".
- The candidate logs in and selects an available time slot from the UI.
- The Next.js backend securely retrieves the candidate's active Google OAuth Access Token via the Clerk SDK.
- The token and selected timestamp are sent to the Cloudflare Worker.
- The Worker validates the request, updates the D1 database status to "scheduled", and constructs a Google Calendar v3 Event Payload.
- The Worker executes a server-to-server POST request to the Google Calendar API using the OAuth token. The API creates the calendar event, automatically generates a Google Meet conference link, and dispatches official email invitations to the candidate and recruiter.

--------------------------------------------------

DATABASE SCHEMA (Cloudflare D1)

The relational state is maintained across four primary tables:

- candidates: Stores AI-extracted JSON data (id, name, skills, university, positions).
- jobs: Stores recruiter-posted roles (id, title, description, recruiter_id, questions, created_at).
- applications: Maps candidates to jobs with dynamic answers (id, job_id, applicant_email, applicant_id, answers, created_at).
- interviews: Tracks scheduling state (id, job_id, recruiter_id, candidate_email, status, scheduled_time, created_at).

When recruiters view applications, the backend utilizes a LEFT JOIN between "applications" and "candidates" to deliver a unified view of the application answers alongside the parsed resume data in a single network request.

--------------------------------------------------

BRIEF LOCAL SETUP

If you wish to run the architecture locally:

1. Clone the repository: git clone https://github.com/c3rry/cf_ai_cosched.git
2. Initialize a Cloudflare D1 database and Vectorize index using wrangler.
3. Apply the SQL schemas to your D1 instance.
4. Update wrangler.toml with your specific binding IDs.
5. Deploy the worker via: npx wrangler deploy
6. In the frontend directory, create a .env.local with your NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY. Ensure Google OAuth and Calendar Scopes are enabled in your Clerk dashboard.
7. Update WORKER_URL in app/page.tsx to point to your deployed worker.
8. Run: npm install and npm run dev.
