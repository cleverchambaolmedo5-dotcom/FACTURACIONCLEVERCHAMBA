import Link from "next/link";
import { Pencil } from "lucide-react";
import type { ManagedUserListItem } from "@/server/repositories/user-repository";
import { UserRoleBadge } from "./user-role-badge";
import { UserStatusBadge } from "./user-status-badge";
import { ToggleUserStatusButton } from "./toggle-user-status-button";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { UserStatus } from "@/generated/prisma/enums";

export function UserTable({
  users,
  currentUserId,
}: {
  users: ManagedUserListItem[];
  currentUserId: string;
}) {
  return (
    <Table className="min-w-[720px]">
      <TableHeader>
        <tr>
          <TableHead>Nombre</TableHead>
          <TableHead>Usuario</TableHead>
          <TableHead>Rol</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </tr>
      </TableHeader>
      <TableBody>
        {users.map((managedUser) => {
          const isSelf = managedUser.id === currentUserId;
          return (
            <TableRow key={managedUser.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <UserAvatar name={managedUser.name} size="sm" />
                  <span className="font-medium text-foreground">
                    {managedUser.name}
                    {isSelf && <span className="ml-1.5 text-xs text-muted-foreground">(tú)</span>}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">{managedUser.email}</TableCell>
              <TableCell>
                <UserRoleBadge role={managedUser.role} />
              </TableCell>
              <TableCell>
                <UserStatusBadge status={managedUser.status} />
              </TableCell>
              <TableCell className="text-right">
                <div className="inline-flex items-center justify-end gap-1">
                  <Link
                    href={`/usuarios/${managedUser.id}/editar`}
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary-soft"
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
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
