import Link from "next/link";
import { Pencil } from "lucide-react";
import { UserRole } from "@/generated/prisma/enums";
import type { BankAccountListItem } from "@/server/repositories/bank-account-repository";
import { BankAccountStatusBadge } from "./bank-account-status-badge";
import { BankAccountToggleStatusButton } from "./bank-account-toggle-status-button";
import { BankAccountDeleteButton } from "./bank-account-delete-button";

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
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-4 py-3">Banco</th>
              <th scope="col" className="px-4 py-3">Alias</th>
              <th scope="col" className="px-4 py-3">Titular</th>
              <th scope="col" className="px-4 py-3">Número de cuenta</th>
              <th scope="col" className="px-4 py-3">Tipo</th>
              <th scope="col" className="px-4 py-3">Moneda</th>
              <th scope="col" className="px-4 py-3 text-right">Saldo</th>
              <th scope="col" className="px-4 py-3">Estado</th>
              <th scope="col" className="px-4 py-3">Fecha de creación</th>
              {canManage && <th scope="col" className="px-4 py-3 text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {bankAccounts.map((account) => (
              <tr key={account.id} className="hover:bg-black/[0.02]">
                <td className="px-4 py-3 font-medium text-foreground">
                  <Link href={`/cuentas-bancarias/${account.id}`} className="hover:underline">
                    {account.bankName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{account.alias}</td>
                <td className="px-4 py-3 text-muted-foreground">{account.accountHolder}</td>
                <td className="px-4 py-3 font-mono text-muted-foreground">
                  {maskAccountNumber(account.accountNumber)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{account.accountType}</td>
                <td className="px-4 py-3 text-muted-foreground">{account.currency}</td>
                <td className="px-4 py-3 text-right font-medium text-foreground">
                  {currencyFormatter.format(Number(account.balance))}
                </td>
                <td className="px-4 py-3">
                  <BankAccountStatusBadge active={account.active} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {dateFormatter.format(account.createdAt)}
                </td>
                {canManage && (
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center justify-end gap-1">
                      <Link
                        href={`/cuentas-bancarias/${account.id}/editar`}
                        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                      >
                        <Pencil className="size-3.5" aria-hidden />
                        Editar
                      </Link>
                      <BankAccountToggleStatusButton bankAccountId={account.id} active={account.active} />
                      <BankAccountDeleteButton bankAccountId={account.id} active={account.active} />
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
