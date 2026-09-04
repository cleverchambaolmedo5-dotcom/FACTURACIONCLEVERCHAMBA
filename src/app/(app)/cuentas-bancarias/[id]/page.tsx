import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { UserRole } from "@/generated/prisma/enums";
import { requireModuleAccess } from "@/lib/auth/guards";
import { getBankAccountDetailForUser } from "@/server/services/bank-account-service";
import { BankAccountStatusBadge } from "@/components/bank-accounts/bank-account-status-badge";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: `Detalle de cuenta bancaria · ${siteConfig.name}` };

const dateFormatter = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium" });
const currencyFormatter = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

// Mirrors bank-account-table.tsx's maskAccountNumber -- the full number is
// only ever shown on the ADMIN-only edit form.
function maskAccountNumber(accountNumber: string): string {
  const visible = accountNumber.slice(-4);
  const hiddenLength = accountNumber.length - visible.length;
  if (hiddenLength <= 0) return accountNumber;
  return "•".repeat(hiddenLength) + visible;
}

// Read-only for both ADMIN and ACCOUNTANT (see rbac.ts + canRead in
// bank-account-service.ts) -- editing stays on the separate
// /cuentas-bancarias/[id]/editar screen, ADMIN-only, linked from here.
export default async function CuentaBancariaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireModuleAccess("cuentas-bancarias");
  const { id } = await params;

  const detail = await getBankAccountDetailForUser(user, id);
  if (!detail) {
    notFound();
  }
  const { account, transactions } = detail;
  const canManage = user.role === UserRole.ADMIN;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{account.bankName}</h2>
          <p className="text-sm text-muted-foreground">
            {account.alias} · {maskAccountNumber(account.accountNumber)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BankAccountStatusBadge active={account.active} />
          {canManage && (
            <Link
              href={`/cuentas-bancarias/${account.id}/editar`}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-black/[0.02]"
            >
              <Pencil className="size-3.5" aria-hidden />
              Editar
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-4 rounded-lg border border-border bg-surface p-6 sm:grid-cols-3">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Titular</dt>
          <dd className="text-sm text-foreground">{account.accountHolder}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Tipo de cuenta
          </dt>
          <dd className="text-sm text-foreground">{account.accountType}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Moneda</dt>
          <dd className="text-sm text-foreground">{account.currency}</dd>
        </div>
        <div className="sm:col-span-3">
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Saldo actual
          </dt>
          <dd className="text-2xl font-bold text-primary">
            {currencyFormatter.format(Number(account.balance))}
          </dd>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Movimientos</h3>
          <span className="text-xs text-muted-foreground">
            {transactions.length} {transactions.length === 1 ? "movimiento" : "movimientos"}
          </span>
        </div>

        {transactions.length === 0 ? (
          <p className="rounded-lg border border-border bg-black/[0.02] px-4 py-3 text-sm text-muted-foreground">
            Esta cuenta todavía no tiene movimientos registrados.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="px-4 py-3">Fecha</th>
                    <th scope="col" className="px-4 py-3">Descripción</th>
                    <th scope="col" className="px-4 py-3">Tipo</th>
                    <th scope="col" className="px-4 py-3 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {transactions.map((transaction) => {
                    const isIncome = transaction.type === "INCOME";
                    return (
                      <tr key={transaction.id} className="hover:bg-black/[0.02]">
                        <td className="px-4 py-3 text-muted-foreground">
                          {dateFormatter.format(transaction.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-foreground">
                          {transaction.description ??
                            (transaction.sale
                              ? `${transaction.sale.customer.fullName} · ${transaction.sale.product.name}`
                              : "—")}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {isIncome ? "Ingreso" : "Egreso"}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-medium ${
                            isIncome ? "text-success" : "text-error"
                          }`}
                        >
                          {isIncome ? "+" : "-"}
                          {currencyFormatter.format(Number(transaction.amount))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
