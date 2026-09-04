import Link from "next/link";
import { Pencil } from "lucide-react";
import { UserRole } from "@/generated/prisma/enums";
import type { CustomerListItem } from "@/server/repositories/customer-repository";
import { CustomerDeleteButton } from "./customer-delete-button";

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
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-4 py-3">Nombre completo</th>
              <th scope="col" className="px-4 py-3">Email</th>
              <th scope="col" className="px-4 py-3">Teléfono</th>
              <th scope="col" className="px-4 py-3">País</th>
              <th scope="col" className="px-4 py-3">Vendedor responsable</th>
              <th scope="col" className="px-4 py-3">Registrado</th>
              <th scope="col" className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {customers.map((customer) => (
              <tr key={customer.id} className="hover:bg-black/[0.02]">
                <td className="px-4 py-3 font-medium text-foreground">
                  {customer.fullName}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {customer.email ?? "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{customer.phone}</td>
                <td className="px-4 py-3 text-muted-foreground">{customer.country}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {customer.assignedSeller.name}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {dateFormatter.format(customer.createdAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center justify-end gap-1">
                    <Link
                      href={`/clientes/${customer.id}/editar`}
                      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                    >
                      <Pencil className="size-3.5" aria-hidden />
                      Editar
                    </Link>
                    {canDelete && <CustomerDeleteButton customerId={customer.id} />}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
