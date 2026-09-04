import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/config";
import { resolveSessionToken } from "@/lib/auth/session";
import { MODULE_HOME_PATHS } from "@/config/modules";
import {
  MODULE_CONTEXT_COOKIE_NAME,
  MODULE_CONTEXT_HEADER_NAME,
  resolveModuleContextFromPathname,
} from "@/config/navigation";

// NOTE: Next.js 16 renamed the `middleware.ts` convention to `proxy.ts`
// (same mechanism, new name/export -- see the framework's own migration
// notes). This file is the route-protection layer for the app.

const LOGIN_PATH = "/login";
const DASHBOARD_PATH = "/dashboard";

// Public entry points, reachable with or without a session:
//   "/"            -- the Clever Chamba module-selection screen. The user
//                      menu's "Módulos" option always logs the user out
//                      before landing here (see logoutToModules in
//                      lib/auth/actions.ts), but this stays public rather
//                      than session-gated so it also works as a direct,
//                      unauthenticated entry point.
//   "/login"       -- existing login screen.
//   "/asesorias"   -- static "Próximamente" placeholder for the
//                      not-yet-built Asesorías module.
// "/inversiones" is intentionally NOT listed here: it's now a real,
// protected module (src/app/(app)/inversiones) requiring a session and
// RBAC, exactly like "/ventas" -- see MODULE_ACCESS in rbac.ts.
// Every other route in this app requires a session (and whatever the
// matcher below already excludes: api/_next/static/etc). This is a
// deny-by-default policy rather than an allowlist of protected paths on
// purpose: as new modules (clientes, ventas, cuotas, ...) get their own
// top-level routes, they're protected automatically, with nothing to
// remember to add here -- only the public exceptions above are listed.
const PUBLIC_PATHS = new Set<string>(["/", LOGIN_PATH, "/asesorias"]);

// Runs a real (database-backed) session check rather than only an
// optimistic cookie-presence check. Proxy now defaults to the Node.js
// runtime (Next.js 16), so a Prisma call here is supported, and doing the
// real check here means an expired/invalid session cookie gets cleared
// immediately instead of bouncing between /login and a protected route.
//
// This is still not the *only* line of defense -- see requireUser() /
// requireModuleAccess() in src/lib/auth/guards.ts, called by every
// authenticated page and layout -- but it stops unauthenticated/expired
// requests before they reach any page at all.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublicPath = PUBLIC_PATHS.has(pathname);
  const isProtected = !isPublicPath;

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const user = token ? await resolveSessionToken(token) : null;

  if (isProtected && !user) {
    const response = NextResponse.redirect(new URL(LOGIN_PATH, request.url));
    if (token) response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }

  // Only /login itself bounces an already-authenticated visitor away --
  // "/" (and the two placeholder modules) stay reachable while logged in
  // too, in case one is visited directly. Where it sends them depends on
  // `?module=` (set by the "/" module-selection cards, see
  // src/config/modules.ts): this is what makes clicking Ventas or
  // Inversiones while already logged in skip the login form and land on
  // the right module instead of always /dashboard. An unrecognized/absent
  // module falls back to the previous, unconditional /dashboard redirect.
  if (pathname === LOGIN_PATH && user) {
    const moduleKey = request.nextUrl.searchParams.get("module") ?? "";
    const destination = MODULE_HOME_PATHS[moduleKey as keyof typeof MODULE_HOME_PATHS] ?? DASHBOARD_PATH;
    return NextResponse.redirect(new URL(destination, request.url));
  }

  // Which of the two authenticated "areas" (Ventas/Inversiones) this
  // request belongs to, purely from its route -- see
  // resolveModuleContextFromPathname. Forwarded as a request header so
  // (app)/layout.tsx can read it for THIS render (a Set-Cookie below only
  // takes effect on the *next* request, too late for the page about to
  // render), and persisted to a cookie so a later visit to a shared route
  // like /clientes can still recover it.
  const routeModuleContext = resolveModuleContextFromPathname(pathname);
  const forwardedHeaders = new Headers(request.headers);
  if (routeModuleContext) {
    forwardedHeaders.set(MODULE_CONTEXT_HEADER_NAME, routeModuleContext);
  }

  const response = NextResponse.next({ request: { headers: forwardedHeaders } });

  if (routeModuleContext) {
    response.cookies.set(MODULE_CONTEXT_COOKIE_NAME, routeModuleContext, {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 30, // 30 days -- a nav preference, not tied to the session's own lifetime
    });
  }

  if (token && !user) {
    // Reaching here with a token but no resolved user only happens on a
    // public path (protected paths already redirected above): a
    // stale/invalid cookie, not an error -- clean it up while we're here.
    response.cookies.delete(SESSION_COOKIE_NAME);
  }
  return response;
}

export const config = {
  // Run on every page route except static assets and API routes (Route
  // Handlers are expected to verify their own session/authorization).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
