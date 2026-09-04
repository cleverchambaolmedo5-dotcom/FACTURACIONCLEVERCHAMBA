import type { Metadata } from "next";
import { CalendarClock, CheckCircle2, AlertTriangle, DollarSign, ClipboardList } from "lucide-react";
import { requireModuleAccess } from "@/lib/auth/guards";
import { listCuotasForUser } from "@/server/services/payment-service";
import { DashboardStatCard } from "@/components/dashboard/dashboard-stat-card";
import { SaleSearch } from "@/components/sales/sale-search";
import { CuotaFilters } from "@/components/cuotas/cuota-filters";
import { CuotaTable } from "@/components/cuotas/cuota-table";
import { CuotaEmptyState } from "@/components/cuotas/cuota-empty-state";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: `Cuotas · ${siteConfig.name}` };

const currencyFormatter = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

// Cuotas is a read-only tracking dashboard over the same Installment rows
// Pagos already manages -- it never creates, edits, or deletes a cuota
// itself (see payment-service.ts#listCuotasForUser). Row-level scoping
// (SELLER only sees cuotas on their own sales) and every amount/status
// come from that same reused service layer, mirroring how /pagos already
// works.
export default async function CuotasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const user = await requireModuleAccess("cuotas");
  const { q, status } = await searchParams;
  const search = q?.trim() || undefined;

  const { stats, installments } = await listCuotasForUser(user, { search, status });

  const hasFilters = !!(search || status);
  const hasAnyCuotas = stats.totalCount > 0;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Cuotas</h2>
        <p className="text-sm text-muted-foreground">
          Seguimiento y control de las cuotas generadas por las ventas.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <DashboardStatCard icon={ClipboardList} label="Total de cuotas" value={String(stats.totalCount)} />
        <DashboardStatCard icon={CalendarClock} label="Pendientes" value={String(stats.pendingCount)} />
        <DashboardStatCard
          icon={CheckCircle2}
          label="Pagadas"
          value={String(stats.paidCount)}
          tone="success"
        />
        <DashboardStatCard
          icon={AlertTriangle}
          label="Vencidas"
          value={String(stats.overdueCount)}
          tone="error"
        />
        <DashboardStatCard
          icon={DollarSign}
          label="Monto pendiente"
          value={currencyFormatter.format(stats.pendingAmountCents / 100)}
          tone="warning"
        />
      </div>

      <form action="/cuotas" method="GET" className="flex flex-col gap-3">
        <SaleSearch defaultValue={search} placeholder="Buscar por cliente o producto..." />
        <CuotaFilters defaultStatus={status} />
      </form>

      {installments.length === 0 ? (
        <CuotaEmptyState hasFilters={hasAnyCuotas && hasFilters} />
      ) : (
        <CuotaTable installments={installments} />
      )}
    </div>
  );
}
