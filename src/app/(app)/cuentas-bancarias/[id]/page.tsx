import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { UserRole } from "@/generated/prisma/enums";
import { requireModuleAccess } from "@/lib/auth/guards";
import {
  getBankAccountForUser,
  listBankTransactionsForUser,
} from "@/server/services/bank-account-service";
import { BankAccountStatusBadge } from "@/components/bank-accounts/bank-account-status-badge";
import { BankTransactionFilters } from "@/components/bank-accounts/bank-transaction-filters";
import { ExportExcelLink } from "@/components/ui/export-excel-link";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";
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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string; dateFrom?: string; dateTo?: string }>;
}) {
  const user = await requireModuleAccess("cuentas-bancarias");
  const { id } = await params;
  const { type, dateFrom, dateTo } = await searchParams;

  const account = await getBankAccountForUser(user, id);
  if (!account) {
    notFound();
  }

  // listBankTransactionsForUser scopes to this account and computes each
  // row's running balance from the account's full, unfiltered history --
  // see the design note on that function (bank-account-service.ts).
  const transactions = await listBankTransactionsForUser(user, {
    bankAccountId: id,
    type,
    dateFrom,
    dateTo,
  });
  const canManage = user.role === UserRole.ADMIN;
  const hasFilters = !!(type || dateFrom || dateTo);

  const exportParams = new URLSearchParams({ bankAccountId: id });
  if (type) exportParams.set("type", type);
  if (dateFrom) exportParams.set("dateFrom", dateFrom);
  if (dateTo) exportParams.set("dateTo", dateTo);
  const exportHref = `/cuentas-bancarias/movimientos/export?${exportParams.toString()}`;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">{account.bankName}</h2>
          <p className="text-sm text-muted-foreground">
            {account.alias} · {maskAccountNumber(account.accountNumber)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BankAccountStatusBadge active={account.active} />
          {canManage && (
            <Link
              href={`/cuentas-bancarias/${account.id}/editar`}
              className={buttonVariants({ variant: "secondary", size: "sm" })}
            >
              <Pencil className="size-3.5" aria-hidden />
              Editar
            </Link>
          )}
        </div>
      </div>

      <Card padding="lg" className="grid gap-4 sm:grid-cols-3">
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
      </Card>

      <div className="space-y-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Movimientos</h3>
            <span className="text-xs text-muted-foreground">
              {transactions.length} {transactions.length === 1 ? "movimiento" : "movimientos"}
            </span>
          </div>
          <ExportExcelLink href={exportHref} />
        </div>

        <form
          action={`/cuentas-bancarias/${account.id}`}
          method="GET"
          className="flex flex-col gap-3"
        >
          <BankTransactionFilters defaultType={type} defaultDateFrom={dateFrom} defaultDateTo={dateTo} />
        </form>

        {transactions.length === 0 ? (
          <p className="rounded-lg border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
            {hasFilters
              ? "No se encontraron movimientos con los filtros seleccionados."
              : "Esta cuenta todavía no tiene movimientos registrados."}
          </p>
        ) : (
          <Table className="min-w-[640px]">
            <TableHeader>
              <tr>
                <TableHead>Fecha</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {transactions.map((transaction) => {
                const isIncome = transaction.type === "INCOME";
                return (
                  <TableRow key={transaction.id}>
                    <TableCell className="text-muted-foreground">
                      {dateFormatter.format(transaction.createdAt)}
                    </TableCell>
                    <TableCell>
                      {transaction.description ??
                        (transaction.sale
                          ? `${transaction.sale.customer.fullName} · ${transaction.sale.product.name}`
                          : "—")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{isIncome ? "Ingreso" : "Egreso"}</TableCell>
                    <TableCell className={cn("text-right font-medium", isIncome ? "text-success" : "text-error")}>
                      {isIncome ? "+" : "-"}
                      {currencyFormatter.format(Number(transaction.amount))}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-foreground">
                      {currencyFormatter.format(transaction.balanceAfterCents / 100)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
