import { DollarSign, ClipboardList, CheckCircle2, XCircle, Plus, LineChart } from "lucide-react";
import type { PublicUser } from "@/lib/auth/session";
import type { FinancialInvestmentDashboardData } from "@/server/services/dashboard-service";
import { DashboardStatCard } from "./dashboard-stat-card";
import { DashboardSection } from "./dashboard-section";
import { QuickActions } from "./quick-actions";
import { InvestmentTable } from "@/components/investments/investment-table";

const currencyFormatter = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

export function AdminDashboard({
  user,
  data,
}: {
  user: PublicUser;
  data: FinancialInvestmentDashboardData;
}) {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Hola, {user.name}</h2>
        <p className="text-sm text-muted-foreground">Visión global de las inversiones.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <DashboardStatCard icon={LineChart} label="Total de inversiones" value={String(data.stats.totalCount)} />
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
        <DashboardStatCard
          icon={DollarSign}
          label="Capital total aprobado"
          value={currencyFormatter.format(data.stats.approvedPrincipalCents / 100)}
          tone="success"
        />
      </div>

      <QuickActions
        actions={[
          { href: "/inversiones/nueva", label: "Nueva inversión", icon: Plus },
          { href: "/inversiones", label: "Ver inversiones", icon: LineChart },
          { href: "/inversiones?status=PENDING_VALIDATION", label: "Validar pendientes", icon: ClipboardList },
        ]}
      />

      <DashboardSection
        title="Inversiones pendientes de validación"
        actionHref="/inversiones?status=PENDING_VALIDATION"
        actionLabel="Ver todas"
        isEmpty={data.pendingInvestments.length === 0}
        emptyMessage="No hay inversiones pendientes de validación."
      >
        <InvestmentTable view="financial" items={data.pendingInvestments} />
      </DashboardSection>

      <DashboardSection
        title="Próximas a cumplir un año"
        description="Inversiones activas cuyo primer rendimiento se acerca."
        actionHref="/inversiones?status=ACTIVE"
        actionLabel="Ver activas"
        isEmpty={data.upcomingAnniversaries.length === 0}
        emptyMessage="No hay inversiones activas con un primer rendimiento próximo."
      >
        <InvestmentTable view="financial" items={data.upcomingAnniversaries} />
      </DashboardSection>

      <DashboardSection
        title="Próximas a vencer"
        description="Inversiones activas cerca de su fecha de vencimiento."
        actionHref="/inversiones?status=ACTIVE"
        actionLabel="Ver activas"
        isEmpty={data.upcomingMaturities.length === 0}
        emptyMessage="No hay inversiones activas próximas a vencer."
      >
        <InvestmentTable view="financial" items={data.upcomingMaturities} />
      </DashboardSection>

      <DashboardSection
        title="Últimas inversiones registradas"
        actionHref="/inversiones"
        actionLabel="Ver todas"
        isEmpty={data.recentInvestments.length === 0}
        emptyMessage="Todavía no hay inversiones registradas."
      >
        <InvestmentTable view="financial" items={data.recentInvestments} />
      </DashboardSection>
    </div>
  );
}
