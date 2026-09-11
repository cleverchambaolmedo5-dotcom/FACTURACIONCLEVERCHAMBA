import type { Metadata } from "next";
import { requireModuleAccess } from "@/lib/auth/guards";
import {
  listBankTransactionsForUser,
  listBankAccountsForFilterForUser,
} from "@/server/services/bank-account-service";
import { BankTransactionFilters } from "@/components/bank-accounts/bank-transaction-filters";
import { BankTransactionTable } from "@/components/bank-accounts/bank-transaction-table";
import { ExportExcelLink } from "@/components/ui/export-excel-link";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: `Movimientos bancarios · ${siteConfig.name}` };

// ADMIN/ACCOUNTANT only, same as the rest of /cuentas-bancarias (see
// rbac.ts). Cross-account movement history with filters + Excel export --
// the single-account detail page (/cuentas-bancarias/[id]) keeps its own
// scoped table for a quick per-account view.
export default async function MovimientosBancariosPage({
  searchParams,
}: {
  searchParams: Promise<{
    bankAccountId?: string;
    type?: string;
    dateFrom?: string;
    dateTo?: string;
  }>;
}) {
  const user = await requireModuleAccess("cuentas-bancarias");
  const { bankAccountId, type, dateFrom, dateTo } = await searchParams;

  const [transactions, accounts] = await Promise.all([
    listBankTransactionsForUser(user, { bankAccountId, type, dateFrom, dateTo }),
    listBankAccountsForFilterForUser(user),
  ]);

  const hasFilters = !!(bankAccountId || type || dateFrom || dateTo);

  const exportParams = new URLSearchParams();
  if (bankAccountId) exportParams.set("bankAccountId", bankAccountId);
  if (type) exportParams.set("type", type);
  if (dateFrom) exportParams.set("dateFrom", dateFrom);
  if (dateTo) exportParams.set("dateTo", dateTo);
  const exportQuery = exportParams.toString();
  const exportHref = `/cuentas-bancarias/movimientos/export${exportQuery ? `?${exportQuery}` : ""}`;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Movimientos bancarios</h2>
          <p className="text-sm text-muted-foreground">
            Ingresos y egresos de todas las cuentas bancarias, con su saldo resultante.
          </p>
        </div>
        <ExportExcelLink href={exportHref} />
      </div>

      <form action="/cuentas-bancarias/movimientos" method="GET" className="flex flex-col gap-3">
        <BankTransactionFilters
          accounts={accounts}
          defaultBankAccountId={bankAccountId}
          defaultType={type}
          defaultDateFrom={dateFrom}
          defaultDateTo={dateTo}
        />
      </form>

      {transactions.length === 0 ? (
        <p className="rounded-lg border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
          {hasFilters
            ? "No se encontraron movimientos con los filtros seleccionados."
            : "Todavía no hay movimientos bancarios registrados."}
        </p>
      ) : (
        <BankTransactionTable transactions={transactions} />
      )}
    </div>
  );
}
