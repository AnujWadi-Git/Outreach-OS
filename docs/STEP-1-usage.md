Step 1 — Prepare local environment & safe dev mode

What this commit contains
- .env.example: example env file to copy to .env.local (contains NO_OAUTH_MODE and OWNER_EMAIL).
- docs/usage: added a short code snippet showing how to use the NO_OAUTH_MODE helper in Next.js/Express.

How to use the helper (examples)

1) In a Next.js API route (for example pages/api/some-protected.ts):

```ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { isNoOauthMode, isOwnerEmail } from '../src/lib/noOauth';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // If dev mode is enabled, skip auth checks
  if (isNoOauthMode()) {
    return res.status(200).json({ ok: true, devMode: true });
  }

  // Normal protected behavior: verify session / user email, then check owner
  const userEmail = req.headers['x-user-email'] as string | undefined; // replace with your session logic
  if (!isOwnerEmail(userEmail)) return res.status(403).json({ error: 'forbidden' });

  // ...handle normal logic
  return res.status(200).json({ ok: true });
}
```

2) In NextAuth signIn callback (pages/api/auth/[...nextauth].ts):

```ts
import { isNoOauthMode, isOwnerEmail } from '../../../src/lib/noOauth'

callbacks: {
  async signIn({ user }) {
    if (isNoOauthMode()) return true; // allow local dev
    return isOwnerEmail(user?.email);
  }
}
```

Notes
- The helper is intentionally tiny and has no runtime dependencies. Import it anywhere you need to gate OAuth or server-side endpoints.
- This commit does NOT change your auth implementation automatically — it provides a safe, standard place to call the guard.

Next steps
- If you'd like, I can modify your actual NextAuth config or server auth routes to call this helper directly and open a PR with those changes. Reply "apply guard" and I will update the auth code paths I find in the repo.