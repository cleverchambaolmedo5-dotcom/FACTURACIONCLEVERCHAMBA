import Link from "next/link";
import { Pencil } from "lucide-react";
import type { ManagedUserListItem } from "@/server/repositories/user-repository";
import { UserRoleBadge } from "./user-role-badge";
import { UserStatusBadge } from "./user-status-badge";
import { ToggleUserStatusButton } from "./toggle-user-status-button";
import { UserStatus } from "@/generated/prisma/enums";

export function UserTable({
  users,
  currentUserId,
}: {
  users: ManagedUserListItem[];
  currentUserId: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-4 py-3">Nombre</th>
              <th scope="col" className="px-4 py-3">Usuario</th>
              <th scope="col" className="px-4 py-3">Rol</th>
              <th scope="col" className="px-4 py-3">Estado</th>
              <th scope="col" className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((managedUser) => {
              const isSelf = managedUser.id === currentUserId;
              return (
                <tr key={managedUser.id} className="hover:bg-black/[0.02]">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {managedUser.name}
                    {isSelf && <span className="ml-1.5 text-xs text-muted-foreground">(tú)</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{managedUser.email}</td>
                  <td className="px-4 py-3">
                    <UserRoleBadge role={managedUser.role} />
                  </td>
                  <td className="px-4 py-3">
                    <UserStatusBadge status={managedUser.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/usuarios/${managedUser.id}/editar`}
                        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                      >
                        <Pencil className="size-3.5" aria-hidden />
                        Editar
                      </Link>
                      <ToggleUserStatusButton
                        userId={managedUser.id}
                        status={managedUser.status}
                        disabled={isSelf && managedUser.status === UserStatus.ACTIVE}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
