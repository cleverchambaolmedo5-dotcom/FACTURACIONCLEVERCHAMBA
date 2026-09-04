import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireModuleAccess } from "@/lib/auth/guards";
import { listProductsForAdmin, type ProductStatusFilter } from "@/server/services/product-service";
import { ProductSearch } from "@/components/products/product-search";
import { ProductFilters } from "@/components/products/product-filters";
import { ProductTable } from "@/components/products/product-table";
import { ProductEmptyState } from "@/components/products/product-empty-state";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: `Productos · ${siteConfig.name}` };

function isProductStatusFilter(value: string): value is ProductStatusFilter {
  return value === "active" || value === "inactive";
}

// requireModuleAccess("productos") is the only page-level check needed
// here -- MODULE_ACCESS.productos in rbac.ts already restricts this
// module to ADMIN only (ACCOUNTANT/SELLER get "none"), and
// listProductsForAdmin/createProductForAdmin/updateProductForAdmin/
// toggleProductStatusForAdmin/deleteProductForAdmin (product-service.ts)
// each re-check actingUser.role === ADMIN again on their own, as defense
// in depth. SELLER's ability to pick ACTIVE products in "Nueva venta" is
// unrelated -- that's served by sale-repository.ts's listActiveProducts,
// scoped under the "ventas" module instead.
export default async function ProductosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const user = await requireModuleAccess("productos");
  const { q, status: statusRaw } = await searchParams;
  const search = q?.trim() || undefined;
  const status = statusRaw && isProductStatusFilter(statusRaw) ? statusRaw : "all";

  const products = await listProductsForAdmin(user, { search, status });
  const hasFilters = !!(search || status !== "all");

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Productos</h2>
          <p className="text-sm text-muted-foreground">
            Gestiona el catálogo de cursos, mentorías y asesorías.
          </p>
        </div>
        <Link
          href="/productos/nuevo"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-dark"
        >
          <Plus className="size-4" aria-hidden />
          Nuevo producto
        </Link>
      </div>

      <form action="/productos" method="GET" className="flex flex-col gap-3">
        <ProductSearch defaultValue={search} />
        <ProductFilters defaultStatus={status === "all" ? undefined : status} />
      </form>

      {products.length === 0 ? (
        <ProductEmptyState hasQuery={hasFilters} canCreate />
      ) : (
        <ProductTable products={products} />
      )}
    </div>
  );
}
