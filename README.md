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
AUTH_BYPASS_ENABLED="true"
STANDALONE_FRONTEND_ONLY="false"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-a-long-secret"
OWNER_EMAIL="awadi@asu.edu"
LOCAL_AUTH_ENABLED="true"
GOOGLE_AUTH_ENABLED="false"
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
OPENAI_API_KEY="..."
OPENAI_MODEL="gpt-4.1-mini"
```

4. Create/update the database:

```bash
npm run dev
```

This starts both the local Postgres-compatible development database and the
Next.js app. In another terminal, create/update the schema:

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

The current public build can skip login with `AUTH_BYPASS_ENABLED=true`. In this
mode, Outreach OS creates/uses the owner account automatically, defaults new
campaigns to dry run, and disables Gmail draft/send/resync buttons until Google
OAuth is connected.

If the deployed site does not have Postgres ready yet, set
`STANDALONE_FRONTEND_ONLY=true`. The home page will run as a browser-only tool
with parsing, heuristic JD analysis, outreach generation, local campaign
history, copy, JSON export, and CSV export.

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

If Google shows `Error 401: invalid_client` or says the OAuth client was not
found, the running app is missing real `GOOGLE_CLIENT_ID` /
`GOOGLE_CLIENT_SECRET` values or the OAuth client was deleted in Google Cloud.
Update `.env`, confirm the redirect URI exactly matches
`http://localhost:3000/api/auth/callback/google`, then restart `npm run dev`.
Keep `GOOGLE_AUTH_ENABLED=false` to hide a broken Google button and use local
owner login while you recreate the OAuth client. Set it to `true` only after the
client ID works in Google Cloud and the redirect URI is saved.
For local development, `LOCAL_AUTH_ENABLED=true` also enables a local owner
login so you can use campaign parsing and generation while fixing Google Cloud.
Gmail draft/send actions still require completing Google OAuth.

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
npm run db:local
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
