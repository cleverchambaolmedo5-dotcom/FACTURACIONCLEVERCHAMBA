import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireModuleAccess } from "@/lib/auth/guards";
import { UserRole } from "@/generated/prisma/enums";
import { listSalesForUser, listProductsForSaleForm } from "@/server/services/sale-service";
import { SaleSearch } from "@/components/sales/sale-search";
import { SaleFilters } from "@/components/sales/sale-filters";
import { SaleTable } from "@/components/sales/sale-table";
import { SaleEmptyState } from "@/components/sales/sale-empty-state";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: `Ventas · ${siteConfig.name}` };

export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    productId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  }>;
}) {
  const user = await requireModuleAccess("ventas");
  const { q, productId, status, dateFrom, dateTo } = await searchParams;
  const search = q?.trim() || undefined;

  // listSalesForUser scopes to the caller's own sales for SELLER -- see
  // src/server/services/sale-service.ts. Never trust the listing alone as
  // a security boundary; the detail route re-checks ownership itself too.
  const [sales, products] = await Promise.all([
    listSalesForUser(user, { search, productId, status, dateFrom, dateTo }),
    listProductsForSaleForm(),
  ]);

  const canCreate = user.role === UserRole.ADMIN || user.role === UserRole.SELLER;
  const hasFilters = !!(search || productId || status || dateFrom || dateTo);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Ventas</h2>
          <p className="text-sm text-muted-foreground">
            Registro y control de ventas de cursos y asesorías.
          </p>
        </div>
        {canCreate && (
          <Link
            href="/ventas/nueva"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-dark"
          >
            <Plus className="size-4" aria-hidden />
            Nueva venta
          </Link>
        )}
      </div>

      <form action="/ventas" method="GET" className="flex flex-col gap-3">
        <SaleSearch defaultValue={search} />
        <SaleFilters
          products={products}
          defaultProductId={productId}
          defaultStatus={status}
          defaultDateFrom={dateFrom}
          defaultDateTo={dateTo}
        />
      </form>

      {sales.length === 0 ? (
        <SaleEmptyState hasQuery={hasFilters} canCreate={canCreate} />
      ) : (
        <SaleTable sales={sales} />
      )}
    </div>
  );
}
