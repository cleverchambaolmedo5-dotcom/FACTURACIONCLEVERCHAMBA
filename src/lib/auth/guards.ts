import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, type PublicUser } from "./session";
import { canAccessModule, type ModuleKey } from "./rbac";

// Reusable page-level guards, built on top of the existing session/RBAC
// primitives (getCurrentUser, canAccessModule). No session, token, cookie,
// or login/logout logic lives here -- this only orchestrates redirects
// around those existing pieces, for use at the top of Server Components.

/** Redirects to /login if there's no valid session; otherwise returns the user. */
export async function requireUser(): Promise<PublicUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

/**
 * Redirects to /login if unauthenticated, or to /acceso-denegado if the
 * user's role doesn't have access to `moduleKey`. Otherwise returns the
 * user. This is the server-side check module pages must call themselves
 * -- Proxy and the Sidebar's visibility filtering are both defense in
 * depth, not a substitute for this.
 */
export async function requireModuleAccess(
  moduleKey: ModuleKey,
): Promise<PublicUser> {
  const user = await requireUser();
  if (!canAccessModule(user.role, moduleKey)) {
    redirect("/acceso-denegado");
  }
  return user;
}
