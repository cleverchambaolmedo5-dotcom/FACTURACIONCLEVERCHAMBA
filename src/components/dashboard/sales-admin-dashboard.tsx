import { DollarSign, ClipboardList, CheckCircle2, AlertTriangle, Plus, ShoppingCart, Wallet, Hourglass } from "lucide-react";
import type { PublicUser } from "@/lib/auth/session";
import type { BankAccountSummaryItem, FinancialSalesDashboardData } from "@/server/services/dashboard-service";
import { DashboardStatCard } from "./dashboard-stat-card";
import { DashboardSection } from "./dashboard-section";
import { QuickActions } from "./quick-actions";
import { PendingPaymentsTable } from "@/components/payments/pending-payments-table";
import { BankAccountSummaryGrid } from "./bank-account-summary-grid";
import { OverdueInstallmentsTable } from "./overdue-installments-table";

const currencyFormatter = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

function sumAvailableBalance(accounts: BankAccountSummaryItem[]): number {
  return accounts.reduce((sum, account) => sum + Number(account.balance), 0);
}

// Financial/operational control panel for ADMIN: sales counts, real
// collected-vs-pending money (dashboard-service.ts#getFinancialSummaryForUser,
// derived from the same APPROVED-payments ledger the Comprobantes/Cuotas
// modules use, never a re-sum of sale totals), a "Saldo por cuentas"
// summary reusing the same BankAccountSummaryGrid/getBankAccountsSummaryForUser
// the ACCOUNTANT dashboard already uses, and per-cuota overdue detail.
// Deliberately has no "Últimas ventas registradas" section anymore.
export function SalesAdminDashboard({
  user,
  data,
  bankAccounts,
}: {
  user: PublicUser;
  data: FinancialSalesDashboardData;
  bankAccounts: BankAccountSummaryItem[];
}) {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Hola, {user.name}</h2>
        <p className="text-sm text-muted-foreground">Visión global de las ventas.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <DashboardStatCard icon={ShoppingCart} label="Total de ventas" value={String(data.stats.totalCount)} />
        <DashboardStatCard icon={ClipboardList} label="Activas" value={String(data.stats.activeCount)} />
        <DashboardStatCard
          icon={CheckCircle2}
          label="Pagadas"
          value={String(data.stats.paidCount)}
          tone="success"
        />
        <DashboardStatCard
          icon={AlertTriangle}
          label="Vencidas"
          value={String(data.stats.overdueCount)}
          tone="error"
        />
        <DashboardStatCard
          icon={DollarSign}
          label="Total vendido"
          value={currencyFormatter.format(data.stats.totalSoldCents / 100)}
          tone="success"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <DashboardStatCard
          icon={Wallet}
          label="Dinero cobrado"
          value={currencyFormatter.format(data.financialSummary.collectedCents / 100)}
          tone="success"
        />
        <DashboardStatCard
          icon={Hourglass}
          label="Pendiente por cobrar"
          value={currencyFormatter.format(data.financialSummary.pendingToCollectCents / 100)}
          tone="warning"
        />
      </div>

      <QuickActions
        actions={[
          { href: "/ventas/nueva", label: "Nueva venta", icon: Plus },
          { href: "/ventas", label: "Ver ventas", icon: ShoppingCart },
          { href: "/comprobantes", label: "Validar comprobantes", icon: ClipboardList },
        ]}
      />

      <DashboardSection
        title="Saldo por cuentas"
        description="Dinero disponible por cada cuenta bancaria activa."
        actionHref="/cuentas-bancarias"
        actionLabel="Ver todas"
        isEmpty={bankAccounts.length === 0}
        emptyMessage="No hay cuentas bancarias activas."
      >
        <div className="flex flex-col gap-4">
          <DashboardStatCard
            icon={Wallet}
            label="Total disponible"
            value={currencyFormatter.format(sumAvailableBalance(bankAccounts))}
            tone="success"
          />
          <BankAccountSummaryGrid accounts={bankAccounts} />
        </div>
      </DashboardSection>

      <DashboardSection
        title="Comprobantes pendientes de validación"
        actionHref="/comprobantes"
        actionLabel="Ver todos"
        isEmpty={data.pendingPayments.length === 0}
        emptyMessage="No hay comprobantes pendientes de validación."
      >
        <PendingPaymentsTable payments={data.pendingPayments} />
      </DashboardSection>

      <DashboardSection
        title="Ventas vencidas"
        description="Cuotas fuera de plazo, con el monto pendiente y los días de atraso."
        actionHref="/ventas?status=OVERDUE"
        actionLabel="Ver vencidas"
        isEmpty={data.overdueInstallments.length === 0}
        emptyMessage="No hay ventas vencidas."
      >
        <OverdueInstallmentsTable installments={data.overdueInstallments} />
      </DashboardSection>
    </div>
  );
}
