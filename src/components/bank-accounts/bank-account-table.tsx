import Link from "next/link";
import { Pencil } from "lucide-react";
import { UserRole } from "@/generated/prisma/enums";
import type { BankAccountListItem } from "@/server/repositories/bank-account-repository";
import { BankAccountStatusBadge } from "./bank-account-status-badge";
import { BankAccountToggleStatusButton } from "./bank-account-toggle-status-button";
import { BankAccountDeleteButton } from "./bank-account-delete-button";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

const dateFormatter = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium" });
const currencyFormatter = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

// Masks everything but the last 4 characters (e.g. "••••••1234"), mirroring
// the "número de cuenta parcialmente oculto" requirement -- applied in
// every listing regardless of role, including ADMIN. The full number is
// only ever shown on the ADMIN-only edit form.
function maskAccountNumber(accountNumber: string): string {
  const visible = accountNumber.slice(-4);
  const hiddenLength = accountNumber.length - visible.length;
  if (hiddenLength <= 0) return accountNumber;
  return "•".repeat(hiddenLength) + visible;
}

// Rendered on /cuentas-bancarias for both ADMIN and ACCOUNTANT (see
// rbac.ts) -- ACCOUNTANT is read-only within the module, so it never gets
// the edit/activar/eliminar controls, mirroring CustomerTable's
// currentUserRole branching.
export function BankAccountTable({
  bankAccounts,
  currentUserRole,
}: {
  bankAccounts: BankAccountListItem[];
  currentUserRole: UserRole;
}) {
  const canManage = currentUserRole === UserRole.ADMIN;

  return (
    <Table className="min-w-[960px]">
      <TableHeader>
        <tr>
          <TableHead>Banco</TableHead>
          <TableHead>Alias</TableHead>
          <TableHead>Titular</TableHead>
          <TableHead>Número de cuenta</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Moneda</TableHead>
          <TableHead className="text-right">Saldo</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Fecha de creación</TableHead>
          {canManage && <TableHead className="text-right">Acciones</TableHead>}
        </tr>
      </TableHeader>
      <TableBody>
        {bankAccounts.map((account) => (
          <TableRow key={account.id}>
            <TableCell className="font-medium text-foreground">
              <Link href={`/cuentas-bancarias/${account.id}`} className="hover:underline">
                {account.bankName}
              </Link>
            </TableCell>
            <TableCell className="text-muted-foreground">{account.alias}</TableCell>
            <TableCell className="text-muted-foreground">{account.accountHolder}</TableCell>
            <TableCell className="font-mono text-muted-foreground">
              {maskAccountNumber(account.accountNumber)}
            </TableCell>
            <TableCell className="text-muted-foreground">{account.accountType}</TableCell>
            <TableCell className="text-muted-foreground">{account.currency}</TableCell>
            <TableCell className="text-right font-semibold text-foreground">
              {currencyFormatter.format(Number(account.balance))}
            </TableCell>
            <TableCell>
              <BankAccountStatusBadge active={account.active} />
            </TableCell>
            <TableCell className="text-muted-foreground">{dateFormatter.format(account.createdAt)}</TableCell>
            {canManage && (
              <TableCell className="text-right">
                <div className="inline-flex items-center justify-end gap-1">
                  <Link
                    href={`/cuentas-bancarias/${account.id}/editar`}
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary-soft"
                  >
                    <Pencil className="size-3.5" aria-hidden />
                    Editar
                  </Link>
                  <BankAccountToggleStatusButton bankAccountId={account.id} active={account.active} />
                  <BankAccountDeleteButton bankAccountId={account.id} active={account.active} />
                </div>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
