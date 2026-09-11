import Link from "next/link";
import { Pencil } from "lucide-react";
import { UserRole } from "@/generated/prisma/enums";
import type { CustomerListItem } from "@/server/repositories/customer-repository";
import { CustomerDeleteButton } from "./customer-delete-button";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

const dateFormatter = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium" });

export function CustomerTable({
  customers,
  currentUserRole,
}: {
  customers: CustomerListItem[];
  currentUserRole: UserRole;
}) {
  const canDelete = currentUserRole === UserRole.ADMIN;
  return (
    <Table className="min-w-[720px]">
      <TableHeader>
        <tr>
          <TableHead>Nombre completo</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Teléfono</TableHead>
          <TableHead>País</TableHead>
          <TableHead>Vendedor responsable</TableHead>
          <TableHead>Registrado</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </tr>
      </TableHeader>
      <TableBody>
        {customers.map((customer) => (
          <TableRow key={customer.id}>
            <TableCell>
              <div className="flex items-center gap-3">
                <UserAvatar name={customer.fullName} size="sm" />
                <span className="font-medium text-foreground">{customer.fullName}</span>
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground">{customer.email ?? "—"}</TableCell>
            <TableCell className="text-muted-foreground">{customer.phone}</TableCell>
            <TableCell className="text-muted-foreground">{customer.country}</TableCell>
            <TableCell className="text-muted-foreground">{customer.assignedSeller.name}</TableCell>
            <TableCell className="text-muted-foreground">{dateFormatter.format(customer.createdAt)}</TableCell>
            <TableCell className="text-right">
              <div className="inline-flex items-center justify-end gap-1">
                <Link
                  href={`/clientes/${customer.id}/editar`}
                  className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary-soft"
                >
                  <Pencil className="size-3.5" aria-hidden />
                  Editar
                </Link>
                {canDelete && <CustomerDeleteButton customerId={customer.id} />}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
