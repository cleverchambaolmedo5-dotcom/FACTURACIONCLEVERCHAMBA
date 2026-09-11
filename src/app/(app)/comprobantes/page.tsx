import type { Metadata } from "next";
import { requireModuleAccess } from "@/lib/auth/guards";
import { UserRole } from "@/generated/prisma/enums";
import {
  listPendingPaymentsForUser,
  listSellersForPaymentFilters,
} from "@/server/services/payment-service";
import { SaleSearch } from "@/components/sales/sale-search";
import { PaymentValidationFilters } from "@/components/payments/payment-validation-filters";
import { PendingPaymentsTable } from "@/components/payments/pending-payments-table";
import { PaymentValidationEmptyState } from "@/components/payments/payment-validation-empty-state";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: `Comprobantes · ${siteConfig.name}` };

export default async function ComprobantesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    sellerId?: string;
  }>;
}) {
  // MODULE_ACCESS in rbac.ts keeps SELLER out of this module entirely --
  // only ADMIN/ACCOUNTANT ever reach this page (see AGENTS.md's "no romper
  // el RBAC existente").
  const user = await requireModuleAccess("comprobantes");
  const { q, status, dateFrom, dateTo, sellerId } = await searchParams;
  const search = q?.trim() || undefined;
  const isAdmin = user.role === UserRole.ADMIN;

  const [payments, sellers] = await Promise.all([
    listPendingPaymentsForUser(user, { search, status, dateFrom, dateTo, sellerId }),
    isAdmin ? listSellersForPaymentFilters() : Promise.resolve(undefined),
  ]);

  const hasFilters = !!(search || status || dateFrom || dateTo || sellerId);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Comprobantes</h2>
        <p className="text-sm text-muted-foreground">
          Pagos registrados con su comprobante, listos para aprobar o rechazar.
        </p>
      </div>

      <form action="/comprobantes" method="GET" className="flex flex-col gap-3">
        <SaleSearch defaultValue={search} />
        <PaymentValidationFilters
          sellers={sellers}
          defaultStatus={status}
          defaultDateFrom={dateFrom}
          defaultDateTo={dateTo}
          defaultSellerId={sellerId}
        />
      </form>

      {payments.length === 0 ? (
        <PaymentValidationEmptyState hasFilters={hasFilters} />
      ) : (
        <PendingPaymentsTable payments={payments} />
      )}
    </div>
  );
}
