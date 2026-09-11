import Link from "next/link";
import { Landmark } from "lucide-react";
import type { BankAccountSummaryItem } from "@/server/services/dashboard-service";

const balanceFormatter = new Intl.NumberFormat("es-EC", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatBalance(balance: number, currency: string): string {
  return `$${balanceFormatter.format(balance)} ${currency}`;
}

function formatMovementCount(count: number): string {
  return `${count} ${count === 1 ? "movimiento" : "movimientos"}`;
}

// Card grid for the ACCOUNTANT sales dashboard's "Cuentas bancarias"
// section -- mirrors DashboardStatCard's icon-circle layout and
// BankAccountTable's border/shadow/spacing system, just laid out as cards
// instead of table rows. Each card links to the existing /cuentas-bancarias
// detail page (read-only for ACCOUNTANT, enforced by bank-account-service).
export function BankAccountSummaryGrid({ accounts }: { accounts: BankAccountSummaryItem[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {accounts.map((account) => (
        <Link
          key={account.id}
          href={`/cuentas-bancarias/${account.id}`}
          className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5 shadow-card transition-colors hover:bg-row-hover"
        >
          <div className="flex items-center gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Landmark className="size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{account.bankName}</p>
              <p className="truncate text-xs text-muted-foreground">{account.accountName}</p>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Saldo disponible
            </p>
            <p className="truncate text-xl font-semibold text-foreground">
              {formatBalance(Number(account.balance), account.currency)}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">{formatMovementCount(account.movementCount)}</p>
        </Link>
      ))}
    </div>
  );
}
