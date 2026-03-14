// ─────────────────────────────────────────────────────────────────────────────
// users.ts  —  Simple user management
// ─────────────────────────────────────────────────────────────────────────────
//
// In a real app this would connect to your auth system:
//   - NextAuth.js  → the user record comes from the session
//   - Clerk        → the userId comes from clerkClient.users.getUser()
//   - Supabase Auth → the userId comes from supabase.auth.getUser()
//
// Here we keep it simple: find or create by email.

import db from './db';

// ── Find or create a user by email ───────────────────────────────────────────
// "upsert" = insert if not exists, return existing if already there
// This is useful for a demo so we can always get a valid userId
export async function findOrCreateUser(email: string, name?: string) {
  const user = await db.user.upsert({
    where: { email: email },
    update: {}, // don't update anything if user already exists
    create: { email: email, name: name || email },
  });

  return user;
}

// ── Get a user by ID ─────────────────────────────────────────────────────────
export async function getUserById(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
  });
}
