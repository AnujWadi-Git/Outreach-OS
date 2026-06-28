// Minimal helper to check NO_OAUTH_MODE and owner-restricted checks
// Usage: import { isNoOauthMode, isOwnerEmail } from '../lib/noOauth'

export const isNoOauthMode = (): boolean => {
  try {
    return String(process.env.NO_OAUTH_MODE).toLowerCase() === 'true';
  } catch (e) {
    return false;
  }
};

export const isOwnerEmail = (email?: string | null): boolean => {
  const owner = process.env.OWNER_EMAIL || '';
  if (!owner) return false;
  if (!email) return false;
  return email.toLowerCase() === owner.toLowerCase();
};
