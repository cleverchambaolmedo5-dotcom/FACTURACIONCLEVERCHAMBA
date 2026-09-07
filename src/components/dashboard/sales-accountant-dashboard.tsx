import { DollarSign, ClipboardList, CheckCircle2, AlertTriangle, ShoppingCart, ShieldCheck, Wallet, Hourglass } from "lucide-react";
import type { PublicUser } from "@/lib/auth/session";
import type { BankAccountSummaryItem, FinancialSalesDashboardData } from "@/server/services/dashboard-service";
import { DashboardStatCard } from "./dashboard-stat-card";
import { DashboardSection } from "./dashboard-section";
import { QuickActions } from "./quick-actions";
import { SaleTable } from "@/components/sales/sale-table";
import { PendingPaymentsTable } from "@/components/payments/pending-payments-table";
import { BankAccountSummaryGrid } from "./bank-account-summary-grid";

const currencyFormatter = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

// ACCOUNTANT can't create sales (see sale-service.ts#createSaleForUser), so
// this omits the "Nueva venta" quick action -- otherwise focused on the
// contadora's financial tasks (métricas, comprobantes, cuentas bancarias,
// ventas vencidas) rather than mirroring SalesAdminDashboard's full sales
// listing preview. Deliberately has no "Últimas ventas registradas"
// section -- that stays ADMIN/SELLER-only.
export function SalesAccountantDashboard({
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
        <p className="text-sm text-muted-foreground">Visión financiera de las ventas.</p>
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
          label="Total cobrado"
          value={currencyFormatter.format(data.financialSummary.collectedCents / 100)}
          tone="success"
        />
        <DashboardStatCard
          icon={Hourglass}
          label="Total por cobrar"
          value={currencyFormatter.format(data.financialSummary.pendingToCollectCents / 100)}
          tone="warning"
        />
      </div>

      <QuickActions
        actions={[
          { href: "/comprobantes", label: "Validar comprobantes", icon: ShieldCheck },
          { href: "/ventas", label: "Ver ventas", icon: ShoppingCart },
        ]}
      />

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
        title="Cuentas bancarias"
        description="Resumen del dinero disponible por cuenta."
        actionHref="/cuentas-bancarias"
        actionLabel="Ver todas"
        isEmpty={bankAccounts.length === 0}
        emptyMessage="No hay cuentas bancarias activas."
      >
        <BankAccountSummaryGrid accounts={bankAccounts} />
      </DashboardSection>

      <DashboardSection
        title="Ventas vencidas"
        description="Ventas con cuotas fuera de plazo."
        actionHref="/ventas?status=OVERDUE"
        actionLabel="Ver vencidas"
        isEmpty={data.overdueSales.length === 0}
        emptyMessage="No hay ventas vencidas."
      >
        <SaleTable sales={data.overdueSales} />
      </DashboardSection>
    </div>
  );
}
