import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireModuleAccess } from "@/lib/auth/guards";
import { UserRole } from "@/generated/prisma/enums";
import { listInvestmentsForUser } from "@/server/services/investment-service";
import { SaleSearch } from "@/components/sales/sale-search";
import { InvestmentFilters } from "@/components/investments/investment-filters";
import { InvestmentTable } from "@/components/investments/investment-table";
import { InvestmentEmptyState } from "@/components/investments/investment-empty-state";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: `Inversiones · ${siteConfig.name}` };

export default async function InversionesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }>;
}) {
  const user = await requireModuleAccess("inversiones");
  const { q, status, dateFrom, dateTo } = await searchParams;
  const search = q?.trim() || undefined;

  // listInvestmentsForUser scopes both rows AND financial columns for
  // SELLER -- see src/server/services/investment-service.ts. Never trust
  // the listing alone as a security boundary; the detail route re-checks
  // both ownership and field visibility itself too.
  const result = await listInvestmentsForUser(user, { search, status, dateFrom, dateTo });

  const canCreate = user.role === UserRole.ADMIN || user.role === UserRole.SELLER;
  const hasFilters = !!(search || status || dateFrom || dateTo);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Inversiones</h2>
          <p className="text-sm text-muted-foreground">
            Registro y control de inversiones de clientes en los proyectos de la empresa.
          </p>
        </div>
        {canCreate && (
          <Link
            href="/inversiones/nueva"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-dark"
          >
            <Plus className="size-4" aria-hidden />
            Nueva inversión
          </Link>
        )}
      </div>

      <form action="/inversiones" method="GET" className="flex flex-col gap-3">
        <SaleSearch defaultValue={search} placeholder="Buscar por inversionista o vendedor…" />
        <InvestmentFilters
          defaultStatus={status}
          defaultDateFrom={dateFrom}
          defaultDateTo={dateTo}
        />
      </form>

      {result.items.length === 0 ? (
        <InvestmentEmptyState hasQuery={hasFilters} canCreate={canCreate} />
      ) : result.view === "financial" ? (
        <InvestmentTable view="financial" items={result.items} />
      ) : (
        <InvestmentTable view="seller" items={result.items} />
      )}
    </div>
  );
}
