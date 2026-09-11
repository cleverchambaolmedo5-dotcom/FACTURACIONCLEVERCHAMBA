import {
  DollarSign,
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  ShoppingCart,
  Wallet,
  Hourglass,
  Clock,
  TrendingUp,
  PieChart,
} from "lucide-react";
import type { PublicUser } from "@/lib/auth/session";
import type { SellerSalesDashboardData } from "@/server/services/dashboard-service";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { DashboardStatCard } from "./dashboard-stat-card";
import { DashboardSection } from "./dashboard-section";
import { QuickActions } from "./quick-actions";
import { RejectedPaymentsAlert } from "./rejected-payments-alert";
import { SaleTable } from "@/components/sales/sale-table";
import { SalesDashboardHero } from "./sales-dashboard-hero";
import { SalesCollectionProgress } from "./sales-collection-progress";
import { SalesStatusDonut } from "./sales-status-donut";

const currencyFormatter = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

// SELLER has no access to comprobantes at all (see MODULE_ACCESS in
// rbac.ts), so this omits the "Comprobantes pendientes" section entirely --
// unlike Inversiones, Sale amounts are never field-restricted for SELLER
// (see sale-service.ts), so "Total vendido" is shown here just like on the
// ADMIN/ACCOUNTANT views, scoped to their own sales only.
export function SalesSellerDashboard({
  user,
  data,
}: {
  user: PublicUser;
  data: SellerSalesDashboardData;
}) {
  const { totalSoldCents } = data.stats;
  const { collectedCents, pendingToCollectCents } = data.financialSummary;
  const collectedPct = totalSoldCents > 0 ? (collectedCents / totalSoldCents) * 100 : 0;
  const pendingPct = totalSoldCents > 0 ? (pendingToCollectCents / totalSoldCents) * 100 : 0;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <RejectedPaymentsAlert payments={data.rejectedPayments} />

      <SalesDashboardHero
        userName={user.name}
        subtitle="Resumen de las ventas que has registrado."
        primaryAction={{ href: "/ventas/nueva", label: "Nueva venta" }}
      />

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
          label="Saldo por cobrar"
          value={currencyFormatter.format(pendingToCollectCents / 100)}
          caption={`${pendingPct.toFixed(1)}% pendiente`}
          tone="warning"
          layout="stack"
        />
        <DashboardStatCard
          icon={AlertTriangle}
          label="Ventas vencidas"
          value={String(data.stats.overdueCount)}
          caption={data.stats.overdueCount === 0 ? "Sin vencimientos" : "Requieren seguimiento"}
          tone="error"
          layout="stack"
        />
      </div>

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Mis ventas por estado
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardStatCard icon={ShoppingCart} label="Ventas registradas" value={String(data.stats.totalCount)} />
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

      <QuickActions actions={[{ href: "/ventas", label: "Ver mis ventas", icon: ShoppingCart }]} />

      <DashboardSection
        title="Mis ventas vencidas"
        description="Tus ventas con cuotas fuera de plazo."
        icon={AlertTriangle}
        variant="card"
        actionHref="/ventas?status=OVERDUE"
        actionLabel="Ver vencidas"
        isEmpty={data.overdueSales.length === 0}
        emptyMessage="No tienes ventas vencidas."
      >
        <SaleTable sales={data.overdueSales} showSeller={false} />
      </DashboardSection>

      <DashboardSection
        title="Mis ventas recientes"
        description="Últimas ventas registradas en el sistema."
        icon={ShoppingCart}
        variant="card"
        actionHref="/ventas"
        actionLabel="Ver todas"
        isEmpty={data.recentSales.length === 0}
        emptyMessage="Todavía no has registrado ventas."
      >
        <SaleTable sales={data.recentSales} showSeller={false} />
      </DashboardSection>
    </div>
  );
}
