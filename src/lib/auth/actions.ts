"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { UserStatus } from "@/generated/prisma/enums";
import { MODULE_HOME_PATHS } from "@/config/modules";
import { MODULE_CONTEXT_COOKIE_NAME } from "@/config/navigation";
import { verifyPassword, DUMMY_PASSWORD_HASH } from "./password";
import { establishSession, clearSession } from "./session";

const DEFAULT_POST_LOGIN_PATH = "/dashboard";

export type LoginState = { error?: string } | undefined;

// Intentionally generic and identical for every failure case (unknown
// email, wrong password, inactive account, unexpected error) so a login
// attempt never reveals whether a given email is registered.
const GENERIC_LOGIN_ERROR = "Credenciales incorrectas.";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  // Set by the login form's hidden `module` field (see login-form.tsx),
  // itself only ever populated from the "/" module-selection screen's
  // `?module=` query param (src/config/modules.ts). Purely a post-login
  // navigation target -- an unrecognized/missing value (including one a
  // user tampered with) just falls back to the previous, unconditional
  // /dashboard redirect. Never affects which credentials are checked.
  const moduleKey = String(formData.get("module") ?? "");
  const destination =
    MODULE_HOME_PATHS[moduleKey as keyof typeof MODULE_HOME_PATHS] ?? DEFAULT_POST_LOGIN_PATH;

  if (!email || !password || !isValidEmail(email)) {
    return { error: GENERIC_LOGIN_ERROR };
  }

  let authenticatedUserId: string | null = null;

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    // Always run a bcrypt comparison, even when no user was found, using
    // a fixed dummy hash. This keeps the response time consistent
    // between "unknown email" and "wrong password", so timing can't be
    // used to enumerate registered emails.
    const passwordMatches = await verifyPassword(
      password,
      user?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );

    if (user && user.status === UserStatus.ACTIVE && passwordMatches) {
      authenticatedUserId = user.id;
    }
  } catch {
    // Don't leak internal error details to the client.
    return { error: GENERIC_LOGIN_ERROR };
  }

  if (!authenticatedUserId) {
    return { error: GENERIC_LOGIN_ERROR };
  }

  await establishSession(authenticatedUserId);
  redirect(destination);
}

/**
 * Ends the current session (DB row + SESSION_COOKIE_NAME) and also clears
 * MODULE_CONTEXT_COOKIE_NAME -- the "last module visited" nav preference
 * (see src/config/navigation.ts). Without clearing it, a stale cookie from
 * a previous session could still influence which Sidebar nav set renders
 * on a later, unrelated session; clearing it here means every logout
 * starts the next login from a completely clean navigation context.
 */
async function endSession() {
  await clearSession();
  const cookieStore = await cookies();
  cookieStore.delete(MODULE_CONTEXT_COOKIE_NAME);
}

/**
 * Both the user menu's "Cerrar sesión" and its "Módulos" confirmation
 * modal land here now: logging out always goes back to "/", the
 * module-selection screen, never straight to /login. Landing on /login
 * directly (with no `?module=`) would leave LoginForm's hidden `module`
 * field empty, so a successful login there falls back to
 * DEFAULT_POST_LOGIN_PATH ("/dashboard", the Inversiones dashboard) even
 * for a user who was working in Ventas -- going through "/" first forces
 * the user to reselect a module, which sets the right `?module=` for
 * login() (see MODULE_HOME_PATHS) every time.
 */
export async function logout() {
  await endSession();
  redirect("/");
}

/** Same as `logout()` -- kept as a separate export since it's bound to a different form (the "Módulos" confirmation modal) than the plain "Cerrar sesión" button, not because the behavior differs. */
export async function logoutToModules() {
  await endSession();
  redirect("/");
}
