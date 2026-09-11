import {
  DollarSign,
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  ShoppingCart,
  ShieldCheck,
  Wallet,
  Hourglass,
  Clock,
  XCircle,
  Landmark,
  TrendingUp,
  PieChart,
} from "lucide-react";
import type { PublicUser } from "@/lib/auth/session";
import type { BankAccountSummaryItem, FinancialSalesDashboardData } from "@/server/services/dashboard-service";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { DashboardStatCard } from "./dashboard-stat-card";
import { DashboardSection } from "./dashboard-section";
import { QuickActions } from "./quick-actions";
import { SaleTable } from "@/components/sales/sale-table";
import { PendingPaymentsTable } from "@/components/payments/pending-payments-table";
import { BankAccountSummaryGrid } from "./bank-account-summary-grid";
import { SalesDashboardHero } from "./sales-dashboard-hero";
import { SalesCollectionProgress } from "./sales-collection-progress";
import { SalesStatusDonut } from "./sales-status-donut";

const currencyFormatter = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

// ACCOUNTANT can't create sales (see sale-service.ts#createSaleForUser), so
// this has no "Nueva venta" action anywhere (hero or QuickActions) --
// otherwise focused on the contadora's financial tasks (métricas,
// comprobantes, cuentas bancarias, ventas vencidas) rather than mirroring
// SalesAdminDashboard's full sales listing preview. Deliberately has no
// "Últimas ventas registradas" section -- that stays ADMIN/SELLER-only.
export function SalesAccountantDashboard({
  user,
  data,
  bankAccounts,
}: {
  user: PublicUser;
  data: FinancialSalesDashboardData;
  bankAccounts: BankAccountSummaryItem[];
}) {
  const { totalSoldCents } = data.stats;
  const { collectedCents, pendingToCollectCents } = data.financialSummary;
  const collectedPct = totalSoldCents > 0 ? (collectedCents / totalSoldCents) * 100 : 0;
  const pendingPct = totalSoldCents > 0 ? (pendingToCollectCents / totalSoldCents) * 100 : 0;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <SalesDashboardHero userName={user.name} subtitle="Visión financiera de las ventas." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardStatCard
          icon={DollarSign}
          label="Total vendido"
          value={currencyFormatter.format(totalSoldCents / 100)}
          variant="hero"
        />
        <DashboardStatCard
          icon={Wallet}
          label="Total cobrado"
          value={currencyFormatter.format(collectedCents / 100)}
          caption={`${collectedPct.toFixed(1)}% del total`}
          tone="success"
          layout="stack"
        />
        <DashboardStatCard
          icon={Hourglass}
          label="Total por cobrar"
          value={currencyFormatter.format(pendingToCollectCents / 100)}
          caption={`${pendingPct.toFixed(1)}% pendiente`}
          tone="warning"
          layout="stack"
        />
        <DashboardStatCard
          icon={AlertTriangle}
          label="Cuotas vencidas"
          value={String(data.overdueInstallmentsCount)}
          caption={data.overdueInstallmentsCount === 0 ? "Sin vencimientos" : "Requieren seguimiento"}
          tone="error"
          layout="stack"
        />
      </div>

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Ventas por estado
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <DashboardStatCard icon={ShoppingCart} label="Total de ventas" value={String(data.stats.totalCount)} />
          <DashboardStatCard icon={ClipboardList} label="Pendientes" value={String(data.stats.activeCount)} />
          <DashboardStatCard
            icon={Clock}
            label="Parcialmente pagadas"
            value={String(data.stats.partiallyPaidCount)}
            tone="warning"
          />
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
        </div>
      </div>

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Comprobantes y pagos
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <DashboardStatCard
            icon={ShieldCheck}
            label="Pagos pendientes de aprobación"
            value={String(data.pendingPaymentsCount)}
            tone="warning"
          />
          <DashboardStatCard
            icon={CheckCircle2}
            label="Pagos aprobados"
            value={String(data.approvedPaymentsCount)}
            tone="success"
          />
          <DashboardStatCard
            icon={XCircle}
            label="Pagos rechazados"
            value={String(data.rejectedPaymentsCount)}
            tone="error"
          />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card padding="lg">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <TrendingUp className="size-5" aria-hidden />
            </div>
            <div>
              <CardTitle>Cobranza acumulada</CardTitle>
              <CardDescription>Cobrado vs. saldo pendiente sobre el total vendido.</CardDescription>
            </div>
          </div>
          <div className="mt-5">
            <SalesCollectionProgress
              totalCents={totalSoldCents}
              collectedCents={collectedCents}
              pendingCents={pendingToCollectCents}
            />
          </div>
        </Card>

        <Card padding="lg">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <PieChart className="size-5" aria-hidden />
            </div>
            <div>
              <CardTitle>Estado de ventas</CardTitle>
              <CardDescription>Distribución por estado de pago.</CardDescription>
            </div>
          </div>
          <div className="mt-5">
            <SalesStatusDonut
              totalLabel={data.stats.totalCount === 1 ? "venta" : "ventas"}
              breakdown={{
                paid: data.stats.paidCount,
                partiallyPaid: data.stats.partiallyPaidCount,
                overdue: data.stats.overdueCount,
                pending: data.stats.activeCount,
              }}
            />
          </div>
        </Card>
      </div>

      <QuickActions
        actions={[
          { href: "/comprobantes", label: "Validar comprobantes", icon: ShieldCheck },
          { href: "/ventas", label: "Ver ventas", icon: ShoppingCart },
        ]}
      />

      <DashboardSection
        title="Comprobantes pendientes de validación"
        icon={ShieldCheck}
        variant="card"
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
        icon={Landmark}
        variant="card"
        actionHref="/cuentas-bancarias"
        actionLabel="Ver todas"
        isEmpty={bankAccounts.length === 0}
        emptyMessage="No hay cuentas bancarias activas."
      >
        <div className="p-5">
          <BankAccountSummaryGrid accounts={bankAccounts} />
        </div>
      </DashboardSection>

      <DashboardSection
        title="Ventas vencidas"
        description="Ventas con cuotas fuera de plazo."
        icon={AlertTriangle}
        variant="card"
        actionHref="/ventas?status=OVERDUE"
        actionLabel="Ver vencidas"
        isEmpty={data.overdueSales.length === 0}
        emptyMessage="No hay ventas vencidas."
      >
        <SaleTable sales={data.overdueSales} showSeller />
      </DashboardSection>
    </div>
  );
}
