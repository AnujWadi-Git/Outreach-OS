Step 1 — Prepare local environment & safe dev mode

What this commit contains
- .env.example: example env file to copy to .env.local (contains NO_OAUTH_MODE and OWNER_EMAIL).

Why we created these files
- Prevents committing real secrets while giving a clear local setup for Step 1.
- Documents the exact .env keys used in the project so you can run the app locally in dev-only mode.

How to use
1. From your project root, copy the example to a local env file (this file must NOT be committed):
   cp .env.example .env.local
2. Edit .env.local and set OWNER_EMAIL to your email. Keep NO_OAUTH_MODE=true while developing.
3. Start the app (example):
   npm run dev
4. Verify acceptance criteria:
   - App opens into the standalone outreach workbench
   - Campaigns persist in browser storage
   - No sign-in prompt / no OAuth redirect loops

If you want me to push a small code change to make the app read NO_OAUTH_MODE automatically and skip server OAuth, reply “next” and I will add a minimal guard and open a PR for review.