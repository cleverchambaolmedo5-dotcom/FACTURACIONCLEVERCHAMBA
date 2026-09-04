// Centralized session/cookie configuration. Nothing here is a secret --
// actual credentials live only in `.env` -- but every value that shapes
// how the session cookie behaves is defined once, here, instead of being
// repeated (and risking drift) across login/logout/proxy code.

export const SESSION_COOKIE_NAME = "cc_session";

export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function getSessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    // HTTPS-only outside local development, where we run plain HTTP.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}
