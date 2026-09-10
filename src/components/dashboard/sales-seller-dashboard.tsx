import {
  DollarSign,
  ClipboardList,
  CheckCircle2,
  AlertTriangle,
  Plus,
  ShoppingCart,
  Wallet,
  Hourglass,
  Clock,
} from "lucide-react";
import type { PublicUser } from "@/lib/auth/session";
import type { SellerSalesDashboardData } from "@/server/services/dashboard-service";
import { DashboardStatCard } from "./dashboard-stat-card";
import { DashboardSection } from "./dashboard-section";
import { QuickActions } from "./quick-actions";
import { RejectedPaymentsAlert } from "./rejected-payments-alert";
import { SaleTable } from "@/components/sales/sale-table";

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
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Hola, {user.name}</h2>
        <p className="text-sm text-muted-foreground">Resumen de las ventas que has registrado.</p>
      </div>

      <RejectedPaymentsAlert payments={data.rejectedPayments} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
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
          label="Saldo por cobrar"
          value={currencyFormatter.format(data.financialSummary.pendingToCollectCents / 100)}
          tone="warning"
        />
      </div>

      <QuickActions
        actions={[
          { href: "/ventas/nueva", label: "Nueva venta", icon: Plus },
          { href: "/ventas", label: "Ver mis ventas", icon: ShoppingCart },
        ]}
      />

      <DashboardSection
        title="Mis ventas vencidas"
        description="Tus ventas con cuotas fuera de plazo."
        actionHref="/ventas?status=OVERDUE"
        actionLabel="Ver vencidas"
        isEmpty={data.overdueSales.length === 0}
        emptyMessage="No tienes ventas vencidas."
      >
        <SaleTable sales={data.overdueSales} showSeller={false} />
      </DashboardSection>

      <DashboardSection
        title="Mis ventas recientes"
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
