# Outreach OS

Private recruiter outreach automation for Anuj Wadi. Outreach OS turns pasted job descriptions and messy contact blocks into parsed recipients, structured job analysis, tailored outreach, Gmail drafts/sends with resume attachment, logs, exports, and campaign tracking.

## Stack

- Next.js 14 App Router
- TypeScript
- Tailwind CSS with shadcn-style local components
- Prisma
- Postgres
- NextAuth Google OAuth
- Gmail API
- OpenAI API
- Vercel-ready deployment

## Features

- Owner-only Google OAuth login
- Raw contact parsing with regex-first extraction and optional OpenAI fallback
- Job description analysis into structured JSON
- Candidate/persona matching for Anuj Wadi
- Fixed-format outreach generation:
  - Recipient
  - Subject line options
  - Main email
  - Follow-up email
  - Hook summary
  - Status
- Default PDF resume upload and reuse
- Gmail draft creation with multipart PDF attachment
- Direct send workflow only after typing `SEND_NOW`
- Per-contact statuses, logs, retry-safe draft creation, JSON/CSV export
- Seed/demo campaign data

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy env vars:

```bash
cp .env.example .env
```

3. Fill `.env`:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/outreach_os?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-a-long-secret"
OWNER_EMAIL="awadi@asu.edu"
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
OPENAI_API_KEY="..."
OPENAI_MODEL="gpt-4.1-mini"
```

4. Create/update the database:

```bash
npm run db:push
```

5. Optional demo data:

```bash
npm run db:seed
```

6. Start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Google OAuth / Gmail

Create a Google OAuth client in Google Cloud Console:

- App type: Web application
- Authorized JavaScript origin: `http://localhost:3000`
- Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`

For production, add:

- Origin: `https://your-domain.com`
- Redirect URI: `https://your-domain.com/api/auth/callback/google`

Enable the Gmail API and request these scopes:

- `https://www.googleapis.com/auth/gmail.compose`
- `https://www.googleapis.com/auth/gmail.send`
- `https://www.googleapis.com/auth/gmail.modify`

The app stores OAuth tokens server-side through NextAuth's Prisma adapter. Draft creation and direct sending run only on the server.

## Deployment Notes

Use a hosted Postgres provider such as Neon, Supabase, Railway, or Vercel Postgres. Set all env vars in Vercel, then run migrations/push from a trusted environment:

```bash
npm run db:push
```

Uploaded resumes are stored at `storage/resumes` for local development and self-hosted Node deployments. For Vercel, replace `lib/resume-storage.ts` with durable storage such as Vercel Blob or S3 because serverless filesystems are not durable across deployments.

## Safety Rules

- Draft mode is the default.
- Send mode never sends during campaign creation.
- Direct send requires explicit `SEND_NOW` confirmation.
- Contacts with missing or invalid email addresses are flagged and skipped.
- The LLM parser is not allowed to introduce email addresses that were not present in the pasted source text.
- Editing a generated draft clears existing Gmail IDs so it can be recreated cleanly.

## Useful Commands

```bash
npm run lint
npm run build
npm run db:generate
npm run db:push
npm run db:seed
npm run db:studio
```

## Project Structure

- `app/` - App Router pages, API routes, and server actions
- `components/` - UI primitives, dashboard, campaign workflow components
- `lib/auth.ts` - NextAuth Google OAuth and owner access guard
- `lib/parser.ts` - Contact parser and LLM fallback
- `lib/jd-analysis.ts` - JD structured analysis
- `lib/generation.ts` - Outreach generation pipeline
- `lib/gmail.ts` - Gmail MIME draft/send/resync integration
- `lib/resume-storage.ts` - PDF upload and default resume handling
- `lib/campaign-workflow.ts` - Campaign orchestration and exports
- `prisma/schema.prisma` - Database schema
- `prisma/seed.js` - Demo campaign seed data
