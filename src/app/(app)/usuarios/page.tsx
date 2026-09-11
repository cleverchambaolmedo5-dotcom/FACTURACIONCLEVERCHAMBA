import type { Metadata } from "next";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { requireModuleAccess } from "@/lib/auth/guards";
import { listUsersForAdmin } from "@/server/services/user-management-service";
import { UserSearch } from "@/components/users/user-search";
import { UserTable } from "@/components/users/user-table";
import { UserEmptyState } from "@/components/users/user-empty-state";
import { buttonVariants } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: `Usuarios · ${siteConfig.name}` };

// requireModuleAccess("usuarios") is the only page-level check needed here
// -- MODULE_ACCESS.usuarios in rbac.ts already restricts this module to
// ADMIN only (ACCOUNTANT/SELLER get "none"), and
// listUsersForAdmin/createUserForAdmin/updateUserForAdmin/
// toggleUserStatusForAdmin (user-management-service.ts) each re-check
// actingUser.role === ADMIN again on their own, as defense in depth.
export default async function UsuariosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireModuleAccess("usuarios");
  const { q } = await searchParams;
  const search = q?.trim() || undefined;

  const users = await listUsersForAdmin(user, search);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Usuarios</h2>
          <p className="text-sm text-muted-foreground">
            Administración de usuarios internos y sus roles.
          </p>
        </div>
        <Link href="/usuarios/nuevo" className={buttonVariants()}>
          <UserPlus className="size-4" aria-hidden />
          Nuevo usuario
        </Link>
      </div>

      <UserSearch defaultValue={search} />

      {users.length === 0 ? (
        <UserEmptyState hasQuery={!!search} />
      ) : (
        <UserTable users={users} currentUserId={user.id} />
      )}
    </div>
  );
}
