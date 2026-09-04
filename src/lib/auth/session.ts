import "server-only";
import { randomBytes, createHash } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { UserStatus } from "@/generated/prisma/enums";
import type { User } from "@/generated/prisma/client";
import {
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
  getSessionCookieOptions,
} from "./config";

// The subset of User safe to hand back from session verification. Never
// includes passwordHash -- callers (pages, layouts) should never be able
// to accidentally leak it further. `avatarUrl` is included because the
// Header/Sidebar/user menu need it on every authenticated render; the
// other profile fields (phone/country/city) are only fetched by the
// profile page itself, on demand.
export type PublicUser = Pick<
  User,
  "id" | "name" | "email" | "role" | "status" | "avatarUrl"
>;

function toPublicUser(user: User): PublicUser {
  const { id, name, email, role, status, avatarUrl } = user;
  return { id, name, email, role, status, avatarUrl };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateSessionToken(): string {
  // 256 bits of randomness from Node's CSPRNG.
  return randomBytes(32).toString("base64url");
}

/**
 * Pure session lookup: given the raw token from the cookie, hash it, look
 * up the Session row, verify it hasn't expired and belongs to an ACTIVE
 * user. Deletes the session row as a side effect if it's expired.
 *
 * Deliberately never touches cookies -- where a cookie can be written
 * depends on the caller's context (Server Action, Route Handler, or
 * Proxy), so each caller owns that part itself.
 */
export async function resolveSessionToken(
  token: string,
): Promise<PublicUser | null> {
  const tokenHash = hashToken(token);

  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {
      // Already gone (e.g. deleted concurrently) -- nothing to do.
    });
    return null;
  }

  if (session.user.status !== UserStatus.ACTIVE) {
    // Defense in depth: a user deactivated mid-session is treated as
    // unauthenticated immediately, without waiting for the session to
    // expire naturally. The session row is left intact so access resumes
    // automatically if the account is reactivated.
    return null;
  }

  return toPublicUser(session.user);
}

/** Creates a new Session row and returns the raw token to put in a cookie. */
export async function createSessionForUser(userId: string) {
  const token = generateSessionToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await prisma.session.create({
    data: { userId, tokenHash, expiresAt },
  });

  return { token, expiresAt };
}

export async function deleteSessionByToken(token: string) {
  await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

// --- Cookie-aware helpers, for use in Server Actions / Route Handlers ---
// (cookies() can only be mutated in those contexts, never during a plain
// Server Component render.)

/** Creates a session for `userId` and sets the HttpOnly cookie. */
export async function establishSession(userId: string) {
  const { token, expiresAt } = await createSessionForUser(userId);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions(expiresAt));
}

/** Deletes the current session (DB row + cookie), if any. */
export async function clearSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await deleteSessionByToken(token);
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * The reusable session-verification function: reads the cookie, hashes
 * it, looks up the Session, checks expiration, and returns the associated
 * user (or null). Memoized per request with React's `cache()` so calling
 * it from multiple Server Components in the same render only hits the
 * database once.
 */
export const getCurrentUser = cache(async (): Promise<PublicUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  const user = await resolveSessionToken(token);

  if (!user) {
    // Invalid, expired, or inactive-user session: this cookie is useless.
    // Clearing it only works in a Server Action / Route Handler context;
    // inside a Server Component render it throws, which we swallow here.
    // Proxy runs the same check ahead of protected routes and clears the
    // browser cookie there instead.
    try {
      cookieStore.delete(SESSION_COOKIE_NAME);
    } catch {
      // Not mutable in this render context -- see comment above.
    }
  }

  return user;
});
