# MedQrown MedEazy

Comprehensive exam management platform for medical education with AI-powered SAQ marking.

## Architecture
- **Frontend**: React + Vite + TailwindCSS + shadcn/ui + TanStack Query + Wouter
- **Backend**: Express.js + Drizzle ORM + PostgreSQL (Neon serverless)
- **AI**: Multi-provider orchestration (OpenAI, Gemini, Anthropic via Replit AI Integrations) with custom endpoints/models
- **Storage**: GCS Object Storage via Replit integration
- **Email**: Gmail SMTP via nodemailer (medqrownmedicalsolutions24@gmail.com)

## Key Features
- Role-based admin access (super_admin, examiner, reviewer)
- Exam creation with MCQ and SAQ question types
- Per-question timer, full-exam timer, or no timer modes
- Auto-submit on timer expiry (per-question auto-advances, full-exam auto-submits)
- Next-only navigation (no going back)
- Refresh persistence via DB-stored attempt state
- Binary SAQ AI marking (correct/incorrect) with educational feedback (explains correct answer when wrong)
- Auto-mark on submission (per-exam toggle: AI marks SAQ automatically when student submits)
- Multi-AI provider weighted distribution with custom endpoint URLs, model names, and direct API key entry
- Gmail SMTP mass emailing with success/failure counts
- Student results with admin-controlled release
- Podium-style top-3 rankings
- Analytics and student feedback
- Contact section on student portal
- One attempt per student (admin can reset)
- Image upload and preview for questions (image captions sent to AI for SAQ only)
- Individual SAQ response marking with progress stats dashboard

## Project Structure
```
shared/schema.ts          - DB schema + types + indexes (Drizzle + Zod)
server/db.ts              - Database connection (auto-detects Neon/Supabase/standard PG)
server/storage.ts         - DatabaseStorage class (all CRUD)
server/routes.ts          - All API routes (admin + student)
server/seed.ts            - Seed data (admin, AI providers, email template)
server/ai-orchestrator.ts - Multi-provider SAQ marking (batch + individual)
server/marking-queue.ts   - Sequential marking queue (prevents AI call flooding)
server/exam-cache.ts      - In-memory exam structure cache (5-min TTL)
server/index.ts           - Express server entry point
client/src/App.tsx         - Router
client/src/pages/admin/    - Admin portal (login, dashboard, exam-detail, settings)
client/src/pages/student/  - Student portal (login, exam, results)
```

## Default Credentials
- Admin: norysndachule@gmail.com / admin123

## Database Tables
admins, exams, students, exam_students, questions, question_options,
subquestions, attempts, responses, ai_providers (with endpoint/model columns),
email_templates, email_logs, student_feedback, audit_logs, ai_marking_jobs

## SMTP Configuration
- SMTP_HOST=smtp.gmail.com, SMTP_PORT=587
- SMTP_USER=medqrownmedicalsolutions24@gmail.com
- SMTP_FROM_NAME=MedQrown MedEazy
- SMTP_PASS (app password stored as env secret)

## AI Provider Configuration
- AI providers have optional `endpoint` (custom URL) and `model` (custom model name) fields
- `endpoint` overrides `baseUrlEnv` for the API base URL
- `model` overrides default model per type (openai→gpt-4o, gemini→gemini-2.0-flash, anthropic→claude-sonnet-4-20250514)
- Admin can enter API key directly in the UI — stored as process.env at runtime via POST /api/ai-providers/set-key
- AI prompt accepts synonyms/similar phrasing; wrong answers get educational feedback explaining correct answer
- Exams have `autoMarkEnabled` boolean — triggers marking via queue on student submission

## Performance Optimizations
- **Database indexes** on exam_students(exam_id, student_id), questions(exam_id), question_options(question_id), subquestions(question_id), attempts(exam_student_id), responses(attempt_id, question_id)
- **Marking queue** (server/marking-queue.ts): Auto-mark submissions are queued and processed one at a time to prevent AI API call flooding when many students submit simultaneously
- **Exam structure cache** (server/exam-cache.ts): Questions, options, subquestions, and maxScore cached in memory with 5-minute TTL — avoids repeated DB queries when 100+ students load results; invalidated on question create/delete
- **Print support**: Student results page has print button with print-specific CSS (hides nav, shows clean header)

## UI Design
- Gradient backgrounds (`bg-gradient-to-br from-background to-primary/5` on login, `bg-gradient-to-b from-background to-primary/3` on app pages)
- Sticky blur headers (`bg-card/80 backdrop-blur-sm`) with logo top-left
- Cards with `shadow-sm`, colored top borders (green=active, yellow=draft)
- Gradient card headers (`bg-gradient-to-r from-primary/5 to-transparent`)
- Circular numbered badges for questions/sub-questions
- Teal/green theme from logo colors
- Image display with rounded containers (`rounded-xl border bg-muted/30 p-3`)
- Student results page shows question images in breakdown
- Podium-style rankings with gold/silver/bronze theming
- Object storage wildcard route: `/objects/*objectPath` (Express v5 path-to-regexp v8)

## Migration to Supabase (after downloading from Replit)

### Automated Setup (one command)
After downloading and running `npm install`, run:
```bash
npx tsx setup.ts
```
The setup wizard will:
1. Ask for your Supabase DATABASE_URL and save it to `.env`
2. Auto-generate a SESSION_SECRET
3. Push all tables and indexes to your Supabase database
4. Seed the admin user (norysndachule@gmail.com / admin123)
5. Optionally configure Gmail SMTP and AI provider keys

### How it works
- `server/db.ts` auto-detects the environment: Neon driver on Replit, standard `pg` driver elsewhere
- `dotenv/config` is loaded at startup so `.env` files work outside Replit
- All Drizzle schema, routes, frontend, AI marking, and SMTP work without code changes

### Question images
When you start fresh on Supabase, just create new questions with images. You can use any image URL (Supabase Storage, Cloudflare R2, AWS S3, or any public URL). Old images from Replit Object Storage don't need to be migrated — just re-upload them as new questions.

### Optional cleanup (Replit-specific packages)
These are auto-skipped outside Replit but can be uninstalled:
- `@neondatabase/serverless`, `ws`
- `@google-cloud/storage`
- `@uppy/aws-s3`, `@uppy/core`, `@uppy/dashboard`, `@uppy/react`

## Contact Info
- Email: norysndachule@gmail.com
- Phone: 0702797977
- WhatsApp: https://wa.me/254702797977
