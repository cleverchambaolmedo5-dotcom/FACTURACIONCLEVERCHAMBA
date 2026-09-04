import "server-only";
import { UserRole, UserStatus } from "@/generated/prisma/enums";
import type { PublicUser } from "@/lib/auth/session";
import { isValidEmail, isValidUuid } from "@/lib/validation";
import { hashPassword } from "@/lib/auth/password";
import * as userRepository from "@/server/repositories/user-repository";

// All admin user-management permission logic lives here, not in
// pages/components/actions -- distinct from profile-service.ts, which is
// strictly self-service (a user editing only their own row). Every
// function here takes the authenticated `actingUser` and enforces:
//   1. Only ADMIN may list/create/edit/toggle any user. MODULE_ACCESS in
//      rbac.ts already keeps ACCOUNTANT/SELLER out of "usuarios" entirely
//      via requireModuleAccess (called by every page/action below), but
//      every function here re-checks actingUser.role === ADMIN again on
//      its own, as defense in depth -- mirroring sale-service.ts's
//      ACCOUNTANT check, never trusting the caller alone.
//   2. An ADMIN can never deactivate their own account, and no role or
//      status change may ever leave the system with zero ACTIVE ADMIN
//      users (see wouldLeaveNoActiveAdmin below).
// Callers (Server Actions, pages) must still call
// requireModuleAccess("usuarios") themselves first.

const MIN_PASSWORD_LENGTH = 8;

export type ManagedUserFieldErrors = Partial<
  Record<"name" | "email" | "password" | "confirmPassword" | "role" | "status", string>
>;

export type ManagedUserActionResult =
  | { ok: true; id: string }
  | { ok: false; errors?: ManagedUserFieldErrors; formError?: string };

export type RawCreateUserInput = {
  name?: FormDataEntryValue | null;
  email?: FormDataEntryValue | null;
  password?: FormDataEntryValue | null;
  confirmPassword?: FormDataEntryValue | null;
  role?: FormDataEntryValue | null;
};

export type RawUpdateUserInput = RawCreateUserInput & {
  status?: FormDataEntryValue | null;
};

function str(value: FormDataEntryValue | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

// Deliberately not trimmed, mirroring profile-service.ts's passwordStr --
// a password's leading/trailing whitespace may be intentional.
function passwordStr(value: FormDataEntryValue | null | undefined): string {
  return typeof value === "string" ? value : "";
}

function isValidUserRole(value: string): value is UserRole {
  return (Object.values(UserRole) as string[]).includes(value);
}

function isValidUserStatus(value: string): value is UserStatus {
  return (Object.values(UserStatus) as string[]).includes(value);
}

function isUniqueEmailError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/** ADMIN-only, listing every user -- there is no "owner" concept for User itself, so unlike Customer/Sale there is no row-level scoping to apply here. */
export function listUsersForAdmin(
  actingUser: PublicUser,
  search?: string,
): Promise<userRepository.ManagedUserListItem[]> {
  if (actingUser.role !== UserRole.ADMIN) {
    return Promise.resolve([]);
  }
  return userRepository.listUsers({ search });
}

export async function getManagedUserForAdmin(
  actingUser: PublicUser,
  id: string,
): Promise<userRepository.ManagedUser | null> {
  if (actingUser.role !== UserRole.ADMIN || !isValidUuid(id)) {
    return null;
  }
  return userRepository.findManagedUserById(id);
}

/**
 * True when applying `newRole`/`newStatus` to `existing` would leave the
 * system with zero ACTIVE ADMIN users: `existing` currently counts as one
 * (ADMIN + ACTIVE), the change would stop it from counting (role moved
 * away from ADMIN, or status moved away from ACTIVE), and no *other* user
 * is currently an ACTIVE ADMIN. Covers both "change this ADMIN's role"
 * and "deactivate this ADMIN" with the same check.
 */
async function wouldLeaveNoActiveAdmin(
  existing: { id: string; role: UserRole; status: UserStatus },
  newRole: UserRole,
  newStatus: UserStatus,
): Promise<boolean> {
  const wasActiveAdmin = existing.role === UserRole.ADMIN && existing.status === UserStatus.ACTIVE;
  const staysActiveAdmin = newRole === UserRole.ADMIN && newStatus === UserStatus.ACTIVE;
  if (!wasActiveAdmin || staysActiveAdmin) {
    return false;
  }
  const otherActiveAdmins = await userRepository.countActiveAdmins({ excludeId: existing.id });
  return otherActiveAdmins === 0;
}

function validateCommonFields(raw: RawCreateUserInput) {
  const name = str(raw.name);
  const email = str(raw.email).toLowerCase();
  const roleRaw = str(raw.role);

  const errors: ManagedUserFieldErrors = {};
  if (!name) errors.name = "El nombre completo es obligatorio.";
  // "Usuario" reuses the existing unique User.email column (see
  // schema.prisma) -- there is no separate username field in the schema,
  // and login already authenticates by email (src/lib/auth/actions.ts).
  if (!email || !isValidEmail(email)) errors.email = "El usuario debe ser un correo válido.";

  return { name, email, roleRaw, errors };
}

export async function createUserForAdmin(
  actingUser: PublicUser,
  raw: RawCreateUserInput,
): Promise<ManagedUserActionResult> {
  if (actingUser.role !== UserRole.ADMIN) {
    return { ok: false, formError: "No tienes permiso para crear usuarios." };
  }

  const { name, email, roleRaw, errors } = validateCommonFields(raw);
  if (!roleRaw || !isValidUserRole(roleRaw)) {
    errors.role = "Selecciona un rol válido.";
  }

  const password = passwordStr(raw.password);
  const confirmPassword = passwordStr(raw.confirmPassword);
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    errors.password = `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }
  if (!confirmPassword || confirmPassword !== password) {
    errors.confirmPassword = "Las contraseñas no coinciden.";
  }

  if (Object.keys(errors).length > 0 || !isValidUserRole(roleRaw)) {
    return { ok: false, errors };
  }
  const role: UserRole = roleRaw;

  try {
    const passwordHash = await hashPassword(password);
    const user = await userRepository.createManagedUser({ name, email, passwordHash, role });
    return { ok: true, id: user.id };
  } catch (error) {
    if (isUniqueEmailError(error)) {
      return { ok: false, errors: { email: "Ya existe un usuario con ese usuario." } };
    }
    console.error("[users] Failed to create user:", error);
    return { ok: false, formError: "No se pudo crear el usuario. Intenta nuevamente." };
  }
}

export async function updateUserForAdmin(
  actingUser: PublicUser,
  id: string,
  raw: RawUpdateUserInput,
): Promise<ManagedUserActionResult> {
  if (actingUser.role !== UserRole.ADMIN) {
    return { ok: false, formError: "No tienes permiso para editar usuarios." };
  }
  if (!isValidUuid(id)) {
    return { ok: false, formError: "Usuario no válido." };
  }

  const existing = await userRepository.findManagedUserById(id);
  if (!existing) {
    return { ok: false, formError: "El usuario indicado no existe." };
  }

  const { name, email, roleRaw, errors } = validateCommonFields(raw);
  if (!roleRaw || !isValidUserRole(roleRaw)) {
    errors.role = "Selecciona un rol válido.";
  }

  const statusRaw = str(raw.status);
  if (!statusRaw || !isValidUserStatus(statusRaw)) {
    errors.status = "Selecciona un estado válido.";
  }

  // Optional password: only validated/hashed when non-empty -- an empty
  // field means "keep the current password", never "clear it" (see
  // updateManagedUser's passwordHash?: string in user-repository.ts).
  const password = passwordStr(raw.password);
  const confirmPassword = passwordStr(raw.confirmPassword);
  if (password) {
    if (password.length < MIN_PASSWORD_LENGTH) {
      errors.password = `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;
    }
    if (confirmPassword !== password) {
      errors.confirmPassword = "Las contraseñas no coinciden.";
    }
  }

  if (
    Object.keys(errors).length > 0 ||
    !isValidUserRole(roleRaw) ||
    !isValidUserStatus(statusRaw)
  ) {
    return { ok: false, errors };
  }
  const role: UserRole = roleRaw;
  const status: UserStatus = statusRaw;

  // Self-deactivation: an absolute rule, regardless of how many other
  // ADMIN users are currently active (see AGENTS.md's "un ADMIN no debe
  // poder desactivarse a sí mismo").
  if (actingUser.id === id && existing.status === UserStatus.ACTIVE && status === UserStatus.INACTIVE) {
    return { ok: false, formError: "No puedes desactivar tu propia cuenta." };
  }

  if (await wouldLeaveNoActiveAdmin(existing, role, status)) {
    return {
      ok: false,
      formError:
        "Esta acción dejaría al sistema sin ningún administrador activo. Asigna o activa otro ADMIN antes de continuar.",
    };
  }

  try {
    const passwordHash = password ? await hashPassword(password) : undefined;
    await userRepository.updateManagedUser(id, {
      name,
      email,
      role,
      status,
      ...(passwordHash ? { passwordHash } : {}),
    });
    return { ok: true, id };
  } catch (error) {
    if (isUniqueEmailError(error)) {
      return { ok: false, errors: { email: "Ya existe un usuario con ese usuario." } };
    }
    console.error("[users] Failed to update user:", error);
    return { ok: false, formError: "No se pudo actualizar el usuario. Intenta nuevamente." };
  }
}

export type ToggleUserStatusResult = { ok: true } | { ok: false; formError: string };

/**
 * Quick activar/desactivar action from the listing table -- same guards
 * as updateUserForAdmin's status change (self-deactivation, last active
 * ADMIN), without touching name/email/role/password.
 */
export async function toggleUserStatusForAdmin(
  actingUser: PublicUser,
  id: string,
): Promise<ToggleUserStatusResult> {
  if (actingUser.role !== UserRole.ADMIN) {
    return { ok: false, formError: "No tienes permiso para administrar usuarios." };
  }
  if (!isValidUuid(id)) {
    return { ok: false, formError: "Usuario no válido." };
  }

  const existing = await userRepository.findManagedUserById(id);
  if (!existing) {
    return { ok: false, formError: "El usuario indicado no existe." };
  }

  const newStatus = existing.status === UserStatus.ACTIVE ? UserStatus.INACTIVE : UserStatus.ACTIVE;

  if (actingUser.id === id && newStatus === UserStatus.INACTIVE) {
    return { ok: false, formError: "No puedes desactivar tu propia cuenta." };
  }

  if (await wouldLeaveNoActiveAdmin(existing, existing.role, newStatus)) {
    return { ok: false, formError: "No puedes desactivar al único administrador activo del sistema." };
  }

  await userRepository.updateManagedUser(id, {
    name: existing.name,
    email: existing.email,
    role: existing.role,
    status: newStatus,
  });

  return { ok: true };
}
