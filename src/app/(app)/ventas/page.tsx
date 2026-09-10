import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireModuleAccess } from "@/lib/auth/guards";
import { UserRole } from "@/generated/prisma/enums";
import {
  listSalesForUser,
  listProductsForSaleForm,
  listSellersForSaleForm,
} from "@/server/services/sale-service";
import { SaleSearch } from "@/components/sales/sale-search";
import { SaleFilters } from "@/components/sales/sale-filters";
import { SaleTable } from "@/components/sales/sale-table";
import { SaleEmptyState } from "@/components/sales/sale-empty-state";
import { ExportExcelLink } from "@/components/ui/export-excel-link";
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
    sellerId?: string;
  }>;
}) {
  const user = await requireModuleAccess("ventas");
  const { q, productId, status, dateFrom, dateTo, sellerId } = await searchParams;
  const search = q?.trim() || undefined;
  // "Contabilidad" here means the roles that reconcile sales financially --
  // ADMIN and ACCOUNTANT both have "all" access to Ventas (see rbac.ts),
  // and are the only ones who get the "vendedor" filter and the accounting
  // Excel export (a SELLER already only ever sees their own sales, so a
  // seller-scoped export/filter would add nothing).
  const isAccounting = user.role === UserRole.ADMIN || user.role === UserRole.ACCOUNTANT;

  // listSalesForUser scopes to the caller's own sales for SELLER -- see
  // src/server/services/sale-service.ts. Never trust the listing alone as
  // a security boundary; the detail route re-checks ownership itself too.
  const [sales, products, sellers] = await Promise.all([
    listSalesForUser(user, { search, productId, status, dateFrom, dateTo, sellerId }),
    listProductsForSaleForm(),
    isAccounting ? listSellersForSaleForm() : Promise.resolve(undefined),
  ]);

  const canCreate = user.role === UserRole.ADMIN || user.role === UserRole.SELLER;
  const hasFilters = !!(search || productId || status || dateFrom || dateTo || sellerId);

  const exportParams = new URLSearchParams();
  if (search) exportParams.set("q", search);
  if (productId) exportParams.set("productId", productId);
  if (status) exportParams.set("status", status);
  if (dateFrom) exportParams.set("dateFrom", dateFrom);
  if (dateTo) exportParams.set("dateTo", dateTo);
  if (sellerId) exportParams.set("sellerId", sellerId);
  const exportQuery = exportParams.toString();
  const exportHref = `/ventas/export${exportQuery ? `?${exportQuery}` : ""}`;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Ventas</h2>
          <p className="text-sm text-muted-foreground">
            Registro y control de ventas de cursos y asesorías.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAccounting && <ExportExcelLink href={exportHref} label="Exportar ventas a Excel" />}
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
      </div>

      <form action="/ventas" method="GET" className="flex flex-col gap-3">
        <SaleSearch defaultValue={search} />
        <SaleFilters
          products={products}
          sellers={sellers}
          defaultProductId={productId}
          defaultStatus={status}
          defaultDateFrom={dateFrom}
          defaultDateTo={dateTo}
          defaultSellerId={sellerId}
        />
      </form>

      {sales.length === 0 ? (
        <SaleEmptyState hasQuery={hasFilters} canCreate={canCreate} />
      ) : (
        <SaleTable sales={sales} showSeller={isAccounting} />
      )}
    </div>
  );
}
