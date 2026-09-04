import "server-only";
import { prisma } from "@/lib/prisma";
import type { UserRole, UserStatus } from "@/generated/prisma/enums";

// Pure data access for User's self-service profile fields. No auth/RBAC
// awareness lives here -- callers (src/server/services/profile-service.ts)
// enforce that a user can only ever read/write their own row, by always
// passing an id derived from the authenticated session, never from
// client input.

const profileSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  avatarUrl: true,
  phone: true,
  country: true,
  city: true,
} as const;

export type UserProfile = NonNullable<
  Awaited<ReturnType<typeof findProfileById>>
>;

export function findProfileById(id: string) {
  return prisma.user.findUnique({ where: { id }, select: profileSelect });
}

/** Includes passwordHash -- only for the password-change flow, never returned to the client. */
export function findUserWithPasswordById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, passwordHash: true },
  });
}

export type UpdateProfileData = {
  name: string;
  email: string;
  phone: string | null;
  country: string | null;
  city: string | null;
  avatarUrl?: string | null;
};

export function updateProfile(id: string, data: UpdateProfileData) {
  return prisma.user.update({ where: { id }, data, select: profileSelect });
}

export function updatePasswordHash(id: string, passwordHash: string) {
  return prisma.user.update({ where: { id }, data: { passwordHash } });
}

export function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email }, select: { id: true } });
}

// ---------------------------------------------------------------------
// Admin user management (Usuarios module) -- listing/creating/editing any
// user's row, as opposed to the self-service profile fields above. Still
// no auth/RBAC awareness here -- callers
// (src/server/services/user-management-service.ts) enforce that only
// ADMIN can ever reach any of this.
// ---------------------------------------------------------------------

const managedUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
} as const;

export type ManagedUserListItem = Awaited<ReturnType<typeof listUsers>>[number];

export function listUsers(params: { search?: string }) {
  const search = params.search?.trim();

  return prisma.user.findMany({
    where: search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : undefined,
    select: managedUserSelect,
    orderBy: { name: "asc" },
  });
}

export type ManagedUser = NonNullable<Awaited<ReturnType<typeof findManagedUserById>>>;

export function findManagedUserById(id: string) {
  return prisma.user.findUnique({ where: { id }, select: managedUserSelect });
}

/**
 * Count of currently ACTIVE ADMIN users, optionally excluding one id.
 * Used to check "would this change leave the system with zero active
 * admins?" before a role or status change is committed -- see
 * user-management-service.ts#wouldLeaveNoActiveAdmin.
 */
export function countActiveAdmins(params: { excludeId?: string } = {}) {
  return prisma.user.count({
    where: {
      role: "ADMIN",
      status: "ACTIVE",
      ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
    },
  });
}

export type CreateManagedUserData = {
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
};

/**
 * `status` is intentionally not settable here -- every new user starts
 * ACTIVE via the schema's own default (see User.status in schema.prisma),
 * matching "el nuevo usuario debe crearse activo por defecto".
 */
export function createManagedUser(data: CreateManagedUserData) {
  return prisma.user.create({ data, select: managedUserSelect });
}

export type UpdateManagedUserData = {
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  // Omitted entirely (not just empty) when the admin leaves the password
  // field blank -- see user-management-service.ts#updateUserForAdmin --
  // so an update never accidentally clears/overwrites the existing hash.
  passwordHash?: string;
};

export function updateManagedUser(id: string, data: UpdateManagedUserData) {
  return prisma.user.update({ where: { id }, data, select: managedUserSelect });
}
