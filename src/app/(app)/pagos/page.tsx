import type { Metadata } from "next";
import Link from "next/link";
import { CreditCard } from "lucide-react";
import { requireModuleAccess } from "@/lib/auth/guards";
import { UserRole } from "@/generated/prisma/enums";
import {
  listPendingPaymentsForUser,
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

  // listPendingPaymentsForUser scopes to the caller's own sales for SELLER
  // -- see src/server/services/payment-service.ts. One row is always one
  // real Payment (never grouped by cuota), which is what tells Pagos apart
  // from the per-cuota Cuotas listing. Never trust the listing alone as a
  // security boundary; the detail route re-checks ownership too.
  const [payments, products, sellers] = await Promise.all([
    listPendingPaymentsForUser(user, { search, productId, status, dateFrom, dateTo, sellerId }),
    listProductsForPaymentFilters(),
    isAdmin ? listSellersForPaymentFilters() : Promise.resolve(undefined),
  ]);

  const hasFilters = !!(search || productId || status || dateFrom || dateTo || sellerId);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Pagos</h2>
          <p className="text-sm text-muted-foreground">
            Pagos individuales registrados contra las cuotas de una venta, con su forma de pago y estado de
            aprobación.
          </p>
        </div>
        <Link
          href="/cuotas"
          className="inline-flex w-fit items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-dark"
        >
          <CreditCard className="size-3.5" aria-hidden />
          Registrar pago
        </Link>
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

      {payments.length === 0 ? (
        <PaymentEmptyState hasFilters={hasFilters} />
      ) : (
        <PaymentTable payments={payments} />
      )}
    </div>
  );
}
