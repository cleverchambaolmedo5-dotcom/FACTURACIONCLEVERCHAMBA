import { ClipboardList, CheckCircle2, XCircle, Plus, LineChart } from "lucide-react";
import type { PublicUser } from "@/lib/auth/session";
import type { SellerInvestmentDashboardData } from "@/server/services/dashboard-service";
import { DashboardStatCard } from "./dashboard-stat-card";
import { DashboardSection } from "./dashboard-section";
import { QuickActions } from "./quick-actions";
import { InvestmentTable } from "@/components/investments/investment-table";

// No currency formatter here on purpose -- this view never receives a
// principalAmount/annualRate to format in the first place (see
// dashboard-service.ts#getSellerInvestmentDashboardData).
export function SellerDashboard({
  user,
  data,
}: {
  user: PublicUser;
  data: SellerInvestmentDashboardData;
}) {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Hola, {user.name}</h2>
        <p className="text-sm text-muted-foreground">Resumen de las inversiones que has registrado.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DashboardStatCard icon={LineChart} label="Inversiones registradas" value={String(data.stats.totalCount)} />
        <DashboardStatCard
          icon={ClipboardList}
          label="Pendientes de validación"
          value={String(data.stats.pendingCount)}
          tone="warning"
        />
        <DashboardStatCard
          icon={CheckCircle2}
          label="Aprobadas"
          value={String(data.stats.approvedCount)}
          tone="success"
        />
        <DashboardStatCard icon={XCircle} label="Rechazadas" value={String(data.stats.rejectedCount)} tone="error" />
      </div>

      <QuickActions
        actions={[
          { href: "/inversiones/nueva", label: "Nueva inversión", icon: Plus },
          { href: "/inversiones", label: "Ver mis inversiones", icon: LineChart },
        ]}
      />

      <DashboardSection
        title="Mis inversiones pendientes de validación"
        actionHref="/inversiones?status=PENDING_VALIDATION"
        actionLabel="Ver todas"
        isEmpty={data.pendingInvestments.length === 0}
        emptyMessage="No tienes inversiones pendientes de validación."
      >
        <InvestmentTable view="seller" items={data.pendingInvestments} />
      </DashboardSection>

      <DashboardSection
        title="Próximas a cumplir un año"
        description="Tus inversiones activas cuyo primer rendimiento se acerca."
        actionHref="/inversiones?status=ACTIVE"
        actionLabel="Ver activas"
        isEmpty={data.upcomingAnniversaries.length === 0}
        emptyMessage="No tienes inversiones activas con un primer rendimiento próximo."
      >
        <InvestmentTable view="seller" items={data.upcomingAnniversaries} />
      </DashboardSection>

      <DashboardSection
        title="Próximas a vencer"
        description="Tus inversiones activas cerca de su fecha de vencimiento."
        actionHref="/inversiones?status=ACTIVE"
        actionLabel="Ver activas"
        isEmpty={data.upcomingMaturities.length === 0}
        emptyMessage="No tienes inversiones activas próximas a vencer."
      >
        <InvestmentTable view="seller" items={data.upcomingMaturities} />
      </DashboardSection>

      <DashboardSection
        title="Mis inversiones recientes"
        actionHref="/inversiones"
        actionLabel="Ver todas"
        isEmpty={data.recentInvestments.length === 0}
        emptyMessage="Todavía no has registrado inversiones."
      >
        <InvestmentTable view="seller" items={data.recentInvestments} />
      </DashboardSection>
    </div>
  );
}
