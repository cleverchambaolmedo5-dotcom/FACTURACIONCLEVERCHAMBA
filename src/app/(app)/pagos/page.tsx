import type { Metadata } from "next";
import { requireModuleAccess } from "@/lib/auth/guards";
import { UserRole } from "@/generated/prisma/enums";
import {
  listInstallmentsForUser,
  listProductsForPaymentFilters,
  listSellersForPaymentFilters,
} from "@/server/services/payment-service";
import { SaleSearch } from "@/components/sales/sale-search";
import { PaymentFilters } from "@/components/payments/payment-filters";
import { PaymentTable } from "@/components/payments/payment-table";
import { PaymentEmptyState } from "@/components/payments/payment-empty-state";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: `Pagos · ${siteConfig.name}` };

export default async function PagosPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    productId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    sellerId?: string;
    pago?: string;
  }>;
}) {
  const user = await requireModuleAccess("pagos");
  const { q, productId, status, dateFrom, dateTo, sellerId, pago } = await searchParams;
  const search = q?.trim() || undefined;
  const isAdmin = user.role === UserRole.ADMIN;

  // listInstallmentsForUser scopes to the caller's own sales for SELLER --
  // see src/server/services/payment-service.ts. Never trust the listing
  // alone as a security boundary; the detail route re-checks ownership too.
  const [installments, products, sellers] = await Promise.all([
    listInstallmentsForUser(user, { search, productId, status, dateFrom, dateTo, sellerId }),
    listProductsForPaymentFilters(),
    isAdmin ? listSellersForPaymentFilters() : Promise.resolve(undefined),
  ]);

  const hasFilters = !!(search || productId || status || dateFrom || dateTo || sellerId);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Pagos</h2>
        <p className="text-sm text-muted-foreground">
          Cuotas de ventas, saldos pendientes y registro de pagos.
        </p>
      </div>

      {pago === "registrado" && (
        <p className="rounded-md border border-success/30 bg-success/10 px-4 py-2 text-sm text-success">
          Pago registrado correctamente. Queda pendiente de validación.
        </p>
      )}

      <form action="/pagos" method="GET" className="flex flex-col gap-3">
        <SaleSearch defaultValue={search} />
        <PaymentFilters
          products={products}
          sellers={sellers}
          defaultProductId={productId}
          defaultStatus={status}
          defaultDateFrom={dateFrom}
          defaultDateTo={dateTo}
          defaultSellerId={sellerId}
        />
      </form>

      {installments.length === 0 ? (
        <PaymentEmptyState hasFilters={hasFilters} />
      ) : (
        <PaymentTable installments={installments} />
      )}
    </div>
  );
}
