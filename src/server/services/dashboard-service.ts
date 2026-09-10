import "server-only";
import { InstallmentStatus, InvestmentStatus, SaleStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import type { PublicUser } from "@/lib/auth/session";
import { listInvestmentsForUser } from "@/server/services/investment-service";
import type {
  InvestmentListItem,
  InvestmentSellerListItem,
} from "@/server/repositories/investment-repository";
import { listSalesForUser } from "@/server/services/sale-service";
import type { DecoratedSaleListItem } from "@/server/services/sale-service";
import {
  listPendingPaymentsForUser,
  listInstallmentsForUser,
  listRejectedPaymentsNeedingCorrectionForUser,
} from "@/server/services/payment-service";
import type {
  DecoratedPaymentListRow,
  DecoratedInstallmentListRow,
  RejectedPaymentAlert,
} from "@/server/services/payment-service";
import { listBankAccountsForUser } from "@/server/services/bank-account-service";
import type { BankAccountListItem } from "@/server/repositories/bank-account-repository";

// Dashboard read-model for both authenticated modules -- Ventas and
// Inversiones each get their own section below (separated by the banner
// comments), and neither ever reads or aggregates the other's data: the
// Ventas dashboard is derived only from listSalesForUser/
// listPendingPaymentsForUser (sale-service.ts/payment-service.ts), the
// Inversiones dashboard only from listInvestmentsForUser
// (investment-service.ts). Deliberately has no dashboard-repository.ts and
// issues no Prisma queries of its own: every number/list here is derived,
// in memory, from rows those existing, already-scoped service functions
// fetch -- the same calls that back the /ventas and /inversiones listing
// pages. Row-level scoping for SELLER (own records only) and, for
// Inversiones, field-level scoping (SELLER's rows never carry
// principalAmount/annualRate in the first place -- see
// investment-repository.ts) are both already enforced by those functions,
// so this layer never re-implements or duplicates that filtering -- it
// only aggregates.

const RECENT_LIMIT = 5;

function toCents(amount: number | string | Prisma.Decimal): number {
  return Math.round(Number(amount) * 100);
}

/**
 * "Aprobada" = a status only ever reached after ADMIN/ACCOUNTANT
 * validation and still in force: ACTIVE, MATURED, COMPLETED. CANCELLED is
 * deliberately excluded from financial totals -- an early cancellation
 * means that principal was returned and is no longer actually held, the
 * same reasoning SOLD_STATUSES below uses to exclude CANCELLED sales from
 * "Total vendido".
 */
const APPROVED_STATUSES: readonly InvestmentStatus[] = [
  InvestmentStatus.ACTIVE,
  InvestmentStatus.MATURED,
  InvestmentStatus.COMPLETED,
];

function isApproved(status: InvestmentStatus): boolean {
  return (APPROVED_STATUSES as string[]).includes(status);
}

function byDateAsc(a: Date, b: Date): number {
  return a.getTime() - b.getTime();
}

/** Soonest-first firstReturnDate/maturityDate among ACTIVE investments -- MATURED/COMPLETED/CANCELLED/REJECTED are never "próximas", they've already resolved one way or another. */
function upcomingBy<T extends { status: InvestmentStatus; firstReturnDate: Date; maturityDate: Date }>(
  items: T[],
  field: "firstReturnDate" | "maturityDate",
): T[] {
  return items
    .filter((item) => item.status === InvestmentStatus.ACTIVE)
    .sort((a, b) => byDateAsc(a[field], b[field]))
    .slice(0, RECENT_LIMIT);
}

// =========================================================================
// VENTAS module
// =========================================================================
//
// "Vendida" total = sum of finalPrice across every sale except CANCELLED --
// an early cancellation means that sale never actually settled, the same
// reasoning APPROVED_STATUSES below excludes CANCELLED investments from
// "Capital total aprobado".

const SOLD_STATUSES: readonly SaleStatus[] = [
  SaleStatus.ACTIVE,
  SaleStatus.PARTIALLY_PAID,
  SaleStatus.PAID,
  SaleStatus.OVERDUE,
];

function countsAsSold(status: SaleStatus): boolean {
  return (SOLD_STATUSES as string[]).includes(status);
}

export type SalesDashboardStats = {
  totalCount: number;
  // "Pendiente" in every visible label (see sale-table.tsx's own
  // relabeling) -- named activeCount here only because it counts
  // SaleStatus.ACTIVE rows; never rendered as "Activa".
  activeCount: number;
  partiallyPaidCount: number;
  paidCount: number;
  overdueCount: number;
  cancelledCount: number;
  totalSoldCents: number;
};

export type SalesDashboardData = {
  stats: SalesDashboardStats;
  overdueSales: DecoratedSaleListItem[];
  recentSales: DecoratedSaleListItem[];
};

/**
 * Pure aggregation step, shared by every role's dashboard
 * (getSellerSalesDashboardData/getFinancialSalesDashboardData below) so
 * each only fetches `sales` (via listSalesForUser) once and reuses it here,
 * rather than issuing a second, identical query just to get these totals.
 */
function buildSalesDashboardData(sales: DecoratedSaleListItem[]): SalesDashboardData {
  const active = sales.filter((sale) => sale.status === SaleStatus.ACTIVE);
  const partiallyPaid = sales.filter((sale) => sale.status === SaleStatus.PARTIALLY_PAID);
  const paid = sales.filter((sale) => sale.status === SaleStatus.PAID);
  const overdue = sales.filter((sale) => sale.status === SaleStatus.OVERDUE);
  const cancelled = sales.filter((sale) => sale.status === SaleStatus.CANCELLED);
  const sold = sales.filter((sale) => countsAsSold(sale.status));

  return {
    stats: {
      totalCount: sales.length,
      activeCount: active.length,
      partiallyPaidCount: partiallyPaid.length,
      paidCount: paid.length,
      overdueCount: overdue.length,
      cancelledCount: cancelled.length,
      totalSoldCents: sold.reduce((sum, sale) => sum + toCents(sale.finalPrice), 0),
    },
    overdueSales: overdue.slice(0, RECENT_LIMIT),
    recentSales: sales.slice(0, RECENT_LIMIT), // already saleDate desc -- see saleRepository.listSales
  };
}

export type FinancialSummary = {
  collectedCents: number;
  pendingToCollectCents: number;
};

export type OverdueInstallmentItem = {
  id: string;
  saleId: string;
  customerName: string;
  productName: string;
  installmentNumber: number;
  balanceCents: number;
  dueDate: Date;
  daysOverdue: number;
};

/**
 * "Dinero cobrado" = the sum, across every installment on a sold sale (see
 * countsAsSold), of its APPROVED-payments-only paidCents -- exactly the
 * same figure computeInstallmentTotals already uses everywhere else
 * (payment-service.ts) to decide an installment's real balance, so a
 * PENDING_VALIDATION or REJECTED payment can never inflate it. "Pendiente
 * por cobrar" is the complementary balanceCents for those same
 * installments. Because the sum of a sale's installment amounts is always
 * required to equal its finalPrice exactly (enforced in
 * sale-service.ts#createSaleForUser), collectedCents + pendingToCollectCents
 * always equals totalSoldCents --
 * this never re-sums sale totals on its own (which would double count
 * against the payment ledger), it only partitions the same ledger already
 * used for the Comprobantes/Cuotas modules.
 *
 * Pure aggregation step, split out the same way buildSalesDashboardData is
 * above: getFinancialSalesDashboardData already has `sales` and
 * `installments` in hand (fetched once for the whole dashboard) and passes
 * them straight in here instead of triggering a second listSalesForUser/
 * listInstallmentsForUser round-trip for the exact same rows.
 */
function buildFinancialSummary(
  sales: DecoratedSaleListItem[],
  installments: DecoratedInstallmentListRow[],
): FinancialSummary {
  const soldSaleIds = new Set(
    sales.filter((sale) => countsAsSold(sale.status)).map((sale) => sale.id),
  );
  const relevant = installments.filter((installment) => soldSaleIds.has(installment.sale.id));

  return {
    collectedCents: relevant.reduce((sum, installment) => sum + installment.paidCents, 0),
    pendingToCollectCents: relevant.reduce((sum, installment) => sum + installment.balanceCents, 0),
  };
}

export type SellerSalesDashboardData = SalesDashboardData & {
  financialSummary: FinancialSummary;
  // Payments Contabilidad rejected whose installment still needs a
  // corrected re-registration -- see
  // payment-service.ts#listRejectedPaymentsNeedingCorrectionForUser. Never
  // shown on the ADMIN/ACCOUNTANT dashboards (SalesDashboardData itself is
  // unchanged for them), only added here for the seller-facing "requiere
  // corrección" alert.
  rejectedPayments: RejectedPaymentAlert[];
};

/**
 * SELLER dashboard: their own sales only. Adds financialSummary (via the
 * same buildFinancialSummary used by the ADMIN/ACCOUNTANT view below) so a
 * seller can answer "¿cuánto he vendido? ¿cuánto he cobrado? ¿cuánto me
 * falta cobrar?" from this one dashboard -- Sale amounts are never
 * field-restricted for SELLER (unlike Inversiones), so there is no
 * permission reason to withhold it here.
 */
export async function getSellerSalesDashboardData(user: PublicUser): Promise<SellerSalesDashboardData> {
  const [sales, installments, rejectedPayments] = await Promise.all([
    listSalesForUser(user, {}),
    listInstallmentsForUser(user, {}),
    listRejectedPaymentsNeedingCorrectionForUser(user),
  ]);

  const base = buildSalesDashboardData(sales);
  const financialSummary = buildFinancialSummary(sales, installments);

  return { ...base, financialSummary, rejectedPayments };
}

function toOverdueInstallmentItem(
  row: DecoratedInstallmentListRow,
  now: Date,
): OverdueInstallmentItem {
  const daysOverdue = Math.max(
    0,
    Math.floor((now.getTime() - row.dueDate.getTime()) / (24 * 60 * 60 * 1000)),
  );
  return {
    id: row.id,
    saleId: row.sale.id,
    customerName: row.sale.customer.fullName,
    productName: row.sale.product.name,
    installmentNumber: row.installmentNumber,
    balanceCents: row.balanceCents,
    dueDate: row.dueDate,
    daysOverdue,
  };
}

export type FinancialSalesDashboardData = SalesDashboardData & {
  pendingPayments: DecoratedPaymentListRow[];
  // Full counts across every Payment the caller can see (never sliced to
  // RECENT_LIMIT, unlike `pendingPayments` above) -- "Pagos pendientes de
  // aprobación"/"Pagos aprobados"/"Pagos rechazados" for the Contabilidad/
  // ADMIN stat cards.
  pendingPaymentsCount: number;
  approvedPaymentsCount: number;
  rejectedPaymentsCount: number;
  financialSummary: FinancialSummary;
  overdueInstallments: OverdueInstallmentItem[];
  // Full count of cuotas whose effective status is OVERDUE (never sliced),
  // distinct from `stats.overdueCount` (sale-level: a sale with any overdue
  // cuota) -- "Cuotas vencidas" for the Contabilidad/ADMIN stat cards.
  overdueInstallmentsCount: number;
};

/**
 * ADMIN/ACCOUNTANT dashboard: full sales visibility plus the Comprobantes
 * queue (payments awaiting approval/rejection) -- both roles get the exact
 * same shape here, mirroring getFinancialInvestmentDashboardData below.
 * Never called for SELLER, who has no access to comprobantes at all (see
 * MODULE_ACCESS in rbac.ts).
 */
export async function getFinancialSalesDashboardData(
  user: PublicUser,
): Promise<FinancialSalesDashboardData> {
  // `sales` and `installments` each back two of the sections below (base
  // stats + financial summary, and financial summary + overdue list,
  // respectively) -- fetched once here and reused via the pure builders
  // above instead of issuing each of those two queries twice with the same
  // effective result (listInstallmentsForUser's `status` filter is applied
  // in-memory downstream of an otherwise identical, unfiltered query -- see
  // payment-service.ts#listInstallmentsForUser).
  const [sales, installments, allPayments] = await Promise.all([
    listSalesForUser(user, {}),
    listInstallmentsForUser(user, {}),
    // Unfiltered (every validationStatus) so pending/approved/rejected
    // counts below all come from this one fetch -- see the module design
    // note in payment-service.ts (only APPROVED ever counts toward money
    // collected, but every status is shown here for visibility).
    listPendingPaymentsForUser(user, {}),
  ]);

  const base = buildSalesDashboardData(sales);
  const financialSummary = buildFinancialSummary(sales, installments);

  const pendingPayments = allPayments.filter((p) => p.validationStatus === "PENDING_VALIDATION");
  const approvedPayments = allPayments.filter((p) => p.validationStatus === "APPROVED");
  const rejectedPayments = allPayments.filter((p) => p.validationStatus === "REJECTED");

  const now = new Date();
  const allOverdueInstallments = installments.filter(
    (row) => row.effectiveStatus === InstallmentStatus.OVERDUE,
  );
  const overdueInstallments = allOverdueInstallments
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
    .slice(0, RECENT_LIMIT)
    .map((row) => toOverdueInstallmentItem(row, now));

  return {
    ...base,
    pendingPayments: pendingPayments.slice(0, RECENT_LIMIT),
    pendingPaymentsCount: pendingPayments.length,
    approvedPaymentsCount: approvedPayments.length,
    rejectedPaymentsCount: rejectedPayments.length,
    financialSummary,
    overdueInstallments,
    overdueInstallmentsCount: allOverdueInstallments.length,
  };
}

// =========================================================================
// INVERSIONES module
// =========================================================================

// =========================================================================
// Financial view -- ADMIN / ACCOUNTANT
// =========================================================================

export type InvestmentDashboardStats = {
  totalCount: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  approvedPrincipalCents: number;
};

export type FinancialInvestmentDashboardData = {
  stats: InvestmentDashboardStats;
  pendingInvestments: InvestmentListItem[];
  recentInvestments: InvestmentListItem[];
  upcomingAnniversaries: InvestmentListItem[];
  upcomingMaturities: InvestmentListItem[];
};

/**
 * ADMIN/ACCOUNTANT dashboard: full financial visibility. Both roles get the
 * exact same data shape here -- the RBAC split between them is over who can
 * create/validate/cancel investments, not over who can see the numbers, so
 * there's no separate ADMIN-only dashboard query.
 */
export async function getFinancialInvestmentDashboardData(
  user: PublicUser,
): Promise<FinancialInvestmentDashboardData> {
  const result = await listInvestmentsForUser(user, {});
  // Guards against ever computing financial totals from a "seller" view
  // result -- can only happen if this is ever called for a SELLER, which
  // it never is (see dashboard page.tsx), but keeps this function honest
  // on its own rather than trusting the caller alone.
  const items = result.view === "financial" ? result.items : [];

  const pending = items.filter((item) => item.status === InvestmentStatus.PENDING_VALIDATION);
  const approved = items.filter((item) => isApproved(item.status));
  const rejected = items.filter((item) => item.status === InvestmentStatus.REJECTED);

  return {
    stats: {
      totalCount: items.length,
      pendingCount: pending.length,
      approvedCount: approved.length,
      rejectedCount: rejected.length,
      approvedPrincipalCents: approved.reduce((sum, item) => sum + toCents(item.principalAmount), 0),
    },
    pendingInvestments: pending.slice(0, RECENT_LIMIT),
    recentInvestments: items.slice(0, RECENT_LIMIT), // already createdAt desc -- see investmentRepository.listInvestments
    upcomingAnniversaries: upcomingBy(items, "firstReturnDate"),
    upcomingMaturities: upcomingBy(items, "maturityDate"),
  };
}

// =========================================================================
// Operational view -- SELLER
// =========================================================================

export type SellerInvestmentDashboardStats = {
  totalCount: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
};

export type SellerInvestmentDashboardData = {
  stats: SellerInvestmentDashboardStats;
  pendingInvestments: InvestmentSellerListItem[];
  recentInvestments: InvestmentSellerListItem[];
  upcomingAnniversaries: InvestmentSellerListItem[];
  upcomingMaturities: InvestmentSellerListItem[];
};

/**
 * SELLER dashboard: only the investments they registered, and never a
 * financial figure -- listInvestmentsForUser returns the "seller" view for
 * this role, whose underlying query never SELECTs principalAmount/
 * annualRate in the first place (see investment-repository.ts), so there
 * is no monto/tasa/ganancia value here that could ever reach the client.
 */
export async function getSellerInvestmentDashboardData(
  user: PublicUser,
): Promise<SellerInvestmentDashboardData> {
  const result = await listInvestmentsForUser(user, {});
  const items = result.view === "seller" ? result.items : [];

  const pending = items.filter((item) => item.status === InvestmentStatus.PENDING_VALIDATION);
  const approved = items.filter((item) => isApproved(item.status));
  const rejected = items.filter((item) => item.status === InvestmentStatus.REJECTED);

  return {
    stats: {
      totalCount: items.length,
      pendingCount: pending.length,
      approvedCount: approved.length,
      rejectedCount: rejected.length,
    },
    pendingInvestments: pending.slice(0, RECENT_LIMIT),
    recentInvestments: items.slice(0, RECENT_LIMIT),
    upcomingAnniversaries: upcomingBy(items, "firstReturnDate"),
    upcomingMaturities: upcomingBy(items, "maturityDate"),
  };
}

// =========================================================================
// CUENTAS BANCARIAS summary -- ACCOUNTANT sales dashboard only
// =========================================================================
//
// Not part of the Ventas or Inversiones sections above -- this reads
// through bank-account-service.listBankAccountsForUser (the same
// ADMIN/ACCOUNTANT-only, read-scoped function backing the /cuentas-bancarias
// listing page), so RBAC and field selection stay owned by that service.
// Only called from the ACCOUNTANT branch of dashboard-ventas/page.tsx.

export type BankAccountSummaryItem = {
  id: string;
  bankName: string;
  accountName: string;
  balance: Prisma.Decimal;
  currency: string;
  movementCount: number;
  active: boolean;
};

function toBankAccountSummary(account: BankAccountListItem): BankAccountSummaryItem {
  return {
    id: account.id,
    bankName: account.bankName,
    accountName: account.alias,
    balance: account.balance,
    currency: account.currency,
    // From the same query via Prisma's _count -- no separate aggregate
    // query per account (no N+1).
    movementCount: account._count.transactions,
    active: account.active,
  };
}

/**
 * Active accounts only (per-account balance/movement counts, for the
 * dashboard summary cards) -- inactive accounts are left out of this view,
 * mirroring the "cuenta de destino" selector in
 * bank-account-repository.listActiveBankAccounts. Sorted by bank name for
 * a stable, scannable grid.
 */
export async function getBankAccountsSummaryForUser(
  user: PublicUser,
): Promise<BankAccountSummaryItem[]> {
  const accounts = await listBankAccountsForUser(user, { status: "active" });
  return accounts.map(toBankAccountSummary).sort((a, b) => a.bankName.localeCompare(b.bankName));
}
