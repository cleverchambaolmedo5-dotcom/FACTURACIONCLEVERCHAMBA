import "server-only";
import {
  UserRole,
  InstallmentStatus,
  PaymentMethod,
  PaymentValidationStatus,
  BankTransactionType,
  SaleStatus,
} from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import type { PublicUser } from "@/lib/auth/session";
import { isValidUuid } from "@/lib/validation";
import * as paymentRepository from "@/server/repositories/payment-repository";
import type {
  InstallmentListRow,
  InstallmentDetail,
  PaymentListRow,
  PaymentDetail,
} from "@/server/repositories/payment-repository";
import * as saleRepository from "@/server/repositories/sale-repository";
import * as customerRepository from "@/server/repositories/customer-repository";
import * as bankAccountRepository from "@/server/repositories/bank-account-repository";
import {
  MAX_RECEIPT_BYTES,
  deleteReceiptFile,
  saveReceiptFile,
  validateReceiptFile,
} from "@/server/services/receipt-storage";

// All Payment/Installment permission logic, calculations, and state
// transitions live here, not in pages/components/actions or in the
// repository (which only talks to Prisma). Callers (Server Actions, pages)
// must still call requireModuleAccess() themselves first -- this layer
// assumes module-level access already passed and only handles record-level
// rules and financial correctness.
//
// Design note: Payment.validationStatus/validatedById drive the
// Comprobantes approve/reject workflow. A payment only counts toward an
// installment's paid total (and therefore its balance/effective status)
// once it is APPROVED -- PENDING_VALIDATION and REJECTED payments are
// shown for visibility but never reduce the balance. Payment.bankAccountId
// itself is tied to a not-yet-built "which account did *this specific*
// transfer land in" flow and is left unset regardless of payment method.
//
// Separately, Sale.bankAccountId (the account selected when the sale was
// created) is what actually gets credited: the moment a payment is
// APPROVED here (see approvePaymentForUser), a BankTransaction is created
// for exactly the approved payment's amount and BankAccount.balance is
// incremented by that same amount, atomically in the same transaction. A
// sale created before Sale.bankAccountId existed simply has no account to
// credit -- approval still succeeds, it just never touches any balance.

const PAYMENT_METHOD_VALUES = Object.values(PaymentMethod) as string[];

function str(value: FormDataEntryValue | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Parses a "YYYY-MM-DD" <input type="date"> value as UTC midnight -- never through the local timezone, so the calendar day can't shift. Mirrors sale-service.ts. */
function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toCents(amount: number | Prisma.Decimal | string): number {
  return Math.round(Number(amount) * 100);
}

/** Mirrors sale-service.ts's centsToDecimalString -- cents are the source of truth, never the raw float. */
function centsToDecimalString(cents: number): string {
  return (cents / 100).toFixed(2);
}

function isValidInstallmentStatus(value: string | undefined): value is InstallmentStatus {
  return !!value && (Object.values(InstallmentStatus) as string[]).includes(value);
}

function isValidPaymentMethod(value: string): value is PaymentMethod {
  return PAYMENT_METHOD_VALUES.includes(value);
}

/**
 * The authoritative installment status, computed from real amounts and the
 * real due date -- never trusted from the frontend and never left to
 * whatever was last persisted, since PENDING/PARTIALLY_PAID can silently
 * become OVERDUE just by the due date passing, with no payment involved.
 */
export function computeInstallmentStatus(
  totalCents: number,
  paidCents: number,
  dueDate: Date,
  now: Date,
): InstallmentStatus {
  if (paidCents >= totalCents) return InstallmentStatus.PAID;
  if (dueDate.getTime() < now.getTime()) return InstallmentStatus.OVERDUE;
  if (paidCents > 0) return InstallmentStatus.PARTIALLY_PAID;
  return InstallmentStatus.PENDING;
}

/**
 * A sale's status only ever reflects its APPROVED-payments total against
 * finalPrice -- the same "only APPROVED counts" rule as
 * computeInstallmentStatus above. Never derived from due dates (a sale has
 * no single due date of its own) and never manually set for these three
 * values -- see recomputeSaleStatus, the only writer.
 */
export function computeSaleStatus(finalPriceCents: number, approvedCents: number): SaleStatus {
  if (approvedCents >= finalPriceCents) return SaleStatus.PAID;
  if (approvedCents > 0) return SaleStatus.PARTIALLY_PAID;
  return SaleStatus.ACTIVE;
}

// A sale sitting in one of these statuses is owned by this recompute --
// CANCELLED (no cancellation flow exists yet, but never resurrect one if it
// ever lands) and OVERDUE (not yet computed for sales anywhere, reserved
// for a future due-date-based rule like Installment's) are left untouched.
const SALE_STATUSES_OWNED_BY_PAYMENT_RECOMPUTE: readonly SaleStatus[] = [
  SaleStatus.ACTIVE,
  SaleStatus.PARTIALLY_PAID,
  SaleStatus.PAID,
];

/**
 * Recomputes and persists one sale's status from its real payment ledger --
 * called after any change to a sale's APPROVED total (today, only a
 * payment approval; see approvePaymentForUser). Must run inside the same
 * transaction as that change so the sale's status is never observed
 * out-of-sync with the payments it's derived from.
 */
async function recomputeSaleStatus(tx: Prisma.TransactionClient, saleId: string): Promise<void> {
  const sale = await paymentRepository.findSaleForStatusRecompute(saleId, tx);
  if (!sale || !(SALE_STATUSES_OWNED_BY_PAYMENT_RECOMPUTE as string[]).includes(sale.status)) {
    return;
  }

  const approvedCents = sumApprovedCents(sale.installments.flatMap((installment) => installment.payments));
  const newStatus = computeSaleStatus(toCents(sale.finalPrice), approvedCents);

  if (newStatus !== sale.status) {
    await paymentRepository.updateSaleStatus(tx, saleId, newStatus);
  }
}

type PaymentAmountAndStatus = {
  amount: Prisma.Decimal | number | string;
  validationStatus: PaymentValidationStatus;
};

function sumPaymentsCents(payments: { amount: Prisma.Decimal | number | string }[]): number {
  return payments.reduce((sum, payment) => sum + toCents(payment.amount), 0);
}

/**
 * Only APPROVED payments ever count toward a paid/balance calculation --
 * see the design note above. Exported so other modules that need the
 * exact same "money actually collected" figure (e.g.
 * sale-service.ts#listSalesForExportForUser, for the Ventas Excel export)
 * reuse this instead of re-implementing the APPROVED-only filter.
 */
export function sumApprovedCents(payments: PaymentAmountAndStatus[]): number {
  return sumPaymentsCents(
    payments.filter((payment) => payment.validationStatus === PaymentValidationStatus.APPROVED),
  );
}

/** PENDING_VALIDATION payments, shown informationally but never subtracted from the balance. */
function sumPendingCents(payments: PaymentAmountAndStatus[]): number {
  return sumPaymentsCents(
    payments.filter(
      (payment) => payment.validationStatus === PaymentValidationStatus.PENDING_VALIDATION,
    ),
  );
}

export type InstallmentWithTotals<T> = T & {
  totalCents: number;
  // Sum of APPROVED payments only -- the only amount that reduces balance.
  paidCents: number;
  // Sum of PENDING_VALIDATION payments -- informational, never affects balanceCents/effectiveStatus.
  pendingCents: number;
  balanceCents: number;
  effectiveStatus: InstallmentStatus;
};

/**
 * Decorates any installment-shaped record with its real totals and
 * effective status, for display. Exported so other modules (the sale
 * detail page's cuotas section) can show the same numbers without
 * duplicating the calculation -- this is read-only arithmetic, not a
 * mutation; only registerPaymentForUser/approvePaymentForUser/
 * rejectPaymentForUser persist a status change.
 *
 * `balanceCents` and `effectiveStatus` are derived from APPROVED payments
 * only -- a PENDING_VALIDATION or REJECTED payment never reduces the
 * balance or advances the installment status (see the module design note).
 */
export function computeInstallmentTotals<
  T extends { amount: Prisma.Decimal; dueDate: Date; payments: PaymentAmountAndStatus[] },
>(installment: T, now: Date): InstallmentWithTotals<T> {
  const totalCents = toCents(installment.amount);
  const paidCents = sumApprovedCents(installment.payments);
  const pendingCents = sumPendingCents(installment.payments);
  return {
    ...installment,
    totalCents,
    paidCents,
    pendingCents,
    balanceCents: totalCents - paidCents,
    effectiveStatus: computeInstallmentStatus(totalCents, paidCents, installment.dueDate, now),
  };
}

export type DecoratedInstallmentListRow = InstallmentWithTotals<InstallmentListRow>;

/**
 * SELLER sees only installments on their own sales; ADMIN/ACCOUNTANT see
 * all (ADMIN can additionally filter down to one seller). `status` is
 * matched against the computed effective status (see computeInstallmentStatus),
 * not the possibly-stale stored column, so an installment that just became
 * overdue by date is filtered correctly without waiting for a write.
 */
export async function listInstallmentsForUser(
  user: PublicUser,
  filters: {
    search?: string;
    productId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    sellerId?: string;
  },
): Promise<DecoratedInstallmentListRow[]> {
  let sellerId: string | undefined;
  if (user.role === UserRole.SELLER) {
    sellerId = user.id;
  } else if (user.role === UserRole.ADMIN && filters.sellerId && isValidUuid(filters.sellerId)) {
    sellerId = filters.sellerId;
  }

  const dateFrom = filters.dateFrom ? (parseDateOnly(filters.dateFrom) ?? undefined) : undefined;
  const dateTo = filters.dateTo ? (parseDateOnly(filters.dateTo) ?? undefined) : undefined;

  const rows = await paymentRepository.listInstallments({
    sellerId,
    productId: filters.productId && isValidUuid(filters.productId) ? filters.productId : undefined,
    search: filters.search,
    dateFrom,
    dateTo,
  });

  const now = new Date();
  const decorated = rows.map((row) => computeInstallmentTotals(row, now));

  const status = isValidInstallmentStatus(filters.status) ? filters.status : undefined;
  return status ? decorated.filter((row) => row.effectiveStatus === status) : decorated;
}

export type DecoratedInstallmentDetail = InstallmentWithTotals<NonNullable<InstallmentDetail>>;

/**
 * Fetches one installment with its full payment history, enforcing
 * record-level ownership for SELLER. Returns null both when the
 * installment doesn't exist and when a SELLER isn't the sale's seller --
 * the two cases must look identical, mirroring getSaleForUser, so a
 * SELLER can't use this to probe for other sellers' installment IDs.
 */
export async function getInstallmentForUser(
  user: PublicUser,
  id: string,
): Promise<DecoratedInstallmentDetail | null> {
  if (!isValidUuid(id)) {
    return null;
  }

  const installment = await paymentRepository.findInstallmentById(id);
  if (!installment) {
    return null;
  }

  if (user.role === UserRole.SELLER && installment.sale.sellerId !== user.id) {
    return null;
  }

  return computeInstallmentTotals(installment, new Date());
}

// ---------------------------------------------------------------------
// Cuotas: read-only dashboard/listing over the same Installment rows
// Pagos already uses. No new state, no new writes, no new status --
// PENDING/PARTIALLY_PAID are both grouped under one "PENDING" bucket
// here purely for display (the Cuotas module only shows three badge
// colors: pendiente/pagada/vencida), while the underlying
// effectiveStatus/InstallmentStatus computed by computeInstallmentTotals
// above remains the single source of truth. "Próxima a vencer" is a
// pure, non-persisted, in-memory classification (due within the next
// CUOTA_UPCOMING_WINDOW_DAYS days and not yet paid/overdue) -- it's
// never written back to the database.
// ---------------------------------------------------------------------

export type CuotaBucket = "PENDING" | "PAID" | "OVERDUE";

function toCuotaBucket(status: InstallmentStatus): CuotaBucket {
  if (status === InstallmentStatus.PAID) return "PAID";
  if (status === InstallmentStatus.OVERDUE) return "OVERDUE";
  return "PENDING"; // PENDING or PARTIALLY_PAID
}

const CUOTA_UPCOMING_WINDOW_DAYS = 7;

function isUpcomingCuota(effectiveStatus: InstallmentStatus, dueDate: Date, now: Date): boolean {
  if (
    effectiveStatus !== InstallmentStatus.PENDING &&
    effectiveStatus !== InstallmentStatus.PARTIALLY_PAID
  ) {
    return false;
  }
  const msUntilDue = dueDate.getTime() - now.getTime();
  return msUntilDue >= 0 && msUntilDue <= CUOTA_UPCOMING_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

export type DecoratedCuotaRow = DecoratedInstallmentListRow & {
  bucket: CuotaBucket;
  isUpcoming: boolean;
};

function decorateCuota(row: InstallmentListRow, now: Date): DecoratedCuotaRow {
  const totals = computeInstallmentTotals(row, now);
  return {
    ...totals,
    bucket: toCuotaBucket(totals.effectiveStatus),
    isUpcoming: isUpcomingCuota(totals.effectiveStatus, totals.dueDate, now),
  };
}

export type CuotasStats = {
  totalCount: number;
  pendingCount: number;
  paidCount: number;
  overdueCount: number;
  // Sum of the real remaining balance (not the full cuota amount) across
  // every PENDING/OVERDUE cuota -- mirrors
  // dashboard-service.ts#getFinancialSummaryForUser's pendingToCollectCents.
  pendingAmountCents: number;
};

function computeCuotasStats(rows: DecoratedCuotaRow[]): CuotasStats {
  return {
    totalCount: rows.length,
    pendingCount: rows.filter((row) => row.bucket === "PENDING").length,
    paidCount: rows.filter((row) => row.bucket === "PAID").length,
    overdueCount: rows.filter((row) => row.bucket === "OVERDUE").length,
    pendingAmountCents: rows
      .filter((row) => row.bucket === "PENDING" || row.bucket === "OVERDUE")
      .reduce((sum, row) => sum + row.balanceCents, 0),
  };
}

const CUOTA_FILTER_STATUSES = ["PENDING", "PAID", "OVERDUE", "UPCOMING"] as const;
export type CuotaFilterStatus = (typeof CUOTA_FILTER_STATUSES)[number];

function isValidCuotaFilterStatus(value: string | undefined): value is CuotaFilterStatus {
  return !!value && (CUOTA_FILTER_STATUSES as readonly string[]).includes(value);
}

/** Mirrors the repository's own `search` matching (customer name or product name, case-insensitive). */
function matchesCuotaSearch(row: DecoratedCuotaRow, search: string): boolean {
  const needle = search.toLowerCase();
  return (
    row.sale.customer.fullName.toLowerCase().includes(needle) ||
    row.sale.product.name.toLowerCase().includes(needle)
  );
}

/** Vencidas primero, luego próximas a vencer, luego pendientes, luego pagadas; dentro de cada grupo, por fecha de vencimiento ascendente. */
function cuotaSortPriority(row: DecoratedCuotaRow): number {
  if (row.bucket === "OVERDUE") return 0;
  if (row.isUpcoming) return 1;
  if (row.bucket === "PENDING") return 2;
  return 3; // PAID
}

function compareCuotas(a: DecoratedCuotaRow, b: DecoratedCuotaRow): number {
  const priorityDiff = cuotaSortPriority(a) - cuotaSortPriority(b);
  if (priorityDiff !== 0) return priorityDiff;
  return a.dueDate.getTime() - b.dueDate.getTime();
}

export type CuotasListData = {
  stats: CuotasStats;
  installments: DecoratedCuotaRow[];
};

/**
 * Read-only aggregation for the Cuotas module. Cuotas are never created
 * here (or anywhere outside sale-service.ts#createSaleForUser) -- this
 * only lists/filters/summarizes the same Installment rows Pagos already
 * shows, reusing the identical row-level scoping rule (SELLER sees only
 * installments on their own sales; ADMIN/ACCOUNTANT see all -- see
 * listInstallmentsForUser above) and the same computeInstallmentTotals
 * math for every amount/status shown.
 *
 * The full scoped set is fetched once and `stats` is computed from it
 * before search/status are applied, so the summary cards always reflect
 * every cuota the user is allowed to see -- `installments` is what
 * search/status narrow that same set down to for the table.
 */
export async function listCuotasForUser(
  user: PublicUser,
  filters: { search?: string; status?: string },
): Promise<CuotasListData> {
  const sellerId = user.role === UserRole.SELLER ? user.id : undefined;
  const rows = await paymentRepository.listInstallments({ sellerId });

  const now = new Date();
  const decorated = rows.map((row) => decorateCuota(row, now));
  const stats = computeCuotasStats(decorated);

  const search = filters.search?.trim();
  const searched = search ? decorated.filter((row) => matchesCuotaSearch(row, search)) : decorated;

  const status = isValidCuotaFilterStatus(filters.status) ? filters.status : undefined;
  const filtered = status
    ? searched.filter((row) => (status === "UPCOMING" ? row.isUpcoming : row.bucket === status))
    : searched;

  return { stats, installments: [...filtered].sort(compareCuotas) };
}

/** Active products, for the "producto" filter -- reused as-is from the sales module. */
export function listProductsForPaymentFilters() {
  return saleRepository.listActiveProducts();
}

/** ADMIN-only "vendedor" filter options -- reused as-is from the sales module. */
export function listSellersForPaymentFilters() {
  return customerRepository.listActiveSellers();
}

export type PaymentFieldErrors = Partial<
  Record<"amount" | "paymentDate" | "method" | "reference" | "notes" | "receipt", string>
>;

export type RegisterPaymentResult =
  | { ok: true; installmentId: string }
  | { ok: false; errors?: PaymentFieldErrors; formError?: string };

export type RawPaymentInput = {
  amount?: FormDataEntryValue | null;
  paymentDate?: FormDataEntryValue | null;
  method?: FormDataEntryValue | null;
  reference?: FormDataEntryValue | null;
  notes?: FormDataEntryValue | null;
  // Mandatory -- a Payment can never be created without a receipt attached,
  // see the validation in registerPaymentForUser below.
  receipt?: FormDataEntryValue | null;
};

const MAX_SERIALIZATION_RETRIES = 3;

/**
 * Registers a payment against one installment. `user.id` (from the server
 * session) is always the payment's registeredById -- a submitted userId is
 * never read or trusted (there isn't one). SELLER ownership of the sale is
 * re-checked here from the database, ignoring anything about the sale/
 * customer/installment the client might have implied -- the only trusted
 * input is `installmentId` and the form fields, and even installmentId
 * only matters insofar as it resolves to a real, owned installment.
 *
 * The pending balance is re-read from the database inside a SERIALIZABLE
 * transaction and the new Payment + updated Installment.status are written
 * in that same transaction, so two concurrent requests against the same
 * installment can never jointly overpay it (see payment-repository.ts).
 */
export async function registerPaymentForUser(
  user: PublicUser,
  installmentId: string,
  raw: RawPaymentInput,
): Promise<RegisterPaymentResult> {
  if (!isValidUuid(installmentId)) {
    return { ok: false, formError: "La cuota indicada no es válida." };
  }

  const installment = await paymentRepository.findInstallmentById(installmentId);
  if (!installment) {
    return { ok: false, formError: "La cuota indicada no existe." };
  }
  if (user.role === UserRole.SELLER && installment.sale.sellerId !== user.id) {
    return { ok: false, formError: "No tienes permiso para registrar pagos en esta venta." };
  }

  const errors: PaymentFieldErrors = {};

  // --- Amount: must be a positive number. Compared against the real
  // pending balance later, inside the transaction -- never against a
  // client-supplied "saldo pendiente".
  const amountRaw = str(raw.amount);
  const amountValue = Number(amountRaw);
  let amountCents = 0;
  if (!amountRaw || !Number.isFinite(amountValue)) {
    errors.amount = "El monto es obligatorio.";
  } else if (amountValue <= 0) {
    errors.amount = "El monto debe ser mayor a cero.";
  } else {
    amountCents = toCents(amountValue);
  }

  // --- Payment date: required, parsed as a plain calendar date (UTC
  // midnight), same convention as Sale/Installment dates.
  const paymentDateRaw = str(raw.paymentDate);
  const paymentDate = paymentDateRaw ? parseDateOnly(paymentDateRaw) : null;
  if (!paymentDate) {
    errors.paymentDate = "La fecha del pago no es válida.";
  }

  // --- Method.
  const methodRaw = str(raw.method);
  if (!methodRaw || !isValidPaymentMethod(methodRaw)) {
    errors.method = "Selecciona un método de pago válido.";
  }

  // --- Reference / notes: optional free text.
  const reference = str(raw.reference) || undefined;
  const notes = str(raw.notes) || undefined;

  // --- Receipt: mandatory. An empty file input still arrives as a
  // zero-byte File with an empty name -- treat that as "no file selected"
  // and reject it, the same as a missing field entirely. This is the only
  // check that actually stops a Payment from being created without a
  // receipt -- the client-side "required" affordance is a UX hint, never
  // trusted. Type/extension/size are always re-checked here, server-side --
  // the <input accept> attribute on the client is only a UX hint too.
  const receiptFile =
    raw.receipt instanceof File && raw.receipt.size > 0 ? raw.receipt : null;
  if (!receiptFile) {
    errors.receipt = "Debes adjuntar un comprobante para registrar el pago.";
  } else {
    const validationError = validateReceiptFile(receiptFile);
    if (validationError === "type") {
      errors.receipt = "Solo se permiten archivos PDF, JPG, JPEG, PNG o WEBP.";
    } else if (validationError === "size") {
      errors.receipt = `El comprobante no debe superar ${Math.floor(MAX_RECEIPT_BYTES / (1024 * 1024))} MB.`;
    }
  }

  if (Object.keys(errors).length > 0 || !paymentDate || !isValidPaymentMethod(methodRaw)) {
    return { ok: false, errors };
  }
  const method: PaymentMethod = methodRaw;

  // The file is written to disk once, before the transaction retry loop
  // (its content never depends on the transaction outcome) -- on any
  // failure below it's deleted again so a rejected/errored registration
  // never leaves an orphaned file with no Payment/PaymentReceipt row.
  let savedReceipt: Awaited<ReturnType<typeof saveReceiptFile>> | null = null;
  if (receiptFile) {
    try {
      savedReceipt = await saveReceiptFile(receiptFile, "payment");
    } catch (error) {
      console.error("[payments] Failed to save receipt file:", error);
      return { ok: false, formError: "No se pudo guardar el comprobante. Intenta nuevamente." };
    }
  }

  async function fail(formError: string): Promise<RegisterPaymentResult> {
    if (savedReceipt) {
      await deleteReceiptFile(savedReceipt.fileUrl, "payment");
    }
    return { ok: false, formError };
  }

  for (let attempt = 0; attempt < MAX_SERIALIZATION_RETRIES; attempt += 1) {
    try {
      await paymentRepository.runSerializable(async (tx) => {
        const fresh = await paymentRepository.findInstallmentById(installmentId, tx);
        if (!fresh) {
          throw new PaymentValidationError("La cuota indicada no existe.");
        }

        const totalCents = toCents(fresh.amount);
        // Only APPROVED payments reduce the balance -- a pending or
        // rejected payment must never block (or falsely permit) a new
        // registration. The newly-created payment starts PENDING_VALIDATION
        // and therefore never affects this balance itself.
        const approvedCents = sumApprovedCents(fresh.payments);
        const balanceCents = totalCents - approvedCents;

        if (balanceCents <= 0) {
          throw new PaymentValidationError("Esta cuota ya está completamente pagada.");
        }
        if (amountCents > balanceCents) {
          throw new PaymentValidationError("El monto supera el saldo pendiente de la cuota.");
        }

        const payment = await paymentRepository.createPayment(tx, {
          installmentId,
          amount: centsToDecimalString(amountCents),
          paymentDate,
          method,
          reference,
          notes,
          registeredById: user.id,
        });

        if (savedReceipt) {
          await paymentRepository.createPaymentReceipt(tx, {
            paymentId: payment.id,
            fileUrl: savedReceipt.fileUrl,
            fileName: savedReceipt.fileName,
            fileType: savedReceipt.fileType,
            uploadedById: user.id,
          });
        }

        // The new payment is PENDING_VALIDATION, so it never changes
        // approvedCents -- this only re-evaluates a date-based transition
        // (e.g. PENDING -> OVERDUE) against the unchanged approved total.
        const newStatus = computeInstallmentStatus(totalCents, approvedCents, fresh.dueDate, new Date());
        await paymentRepository.updateInstallmentStatus(tx, installmentId, newStatus);
      });

      return { ok: true, installmentId };
    } catch (error) {
      if (error instanceof PaymentValidationError) {
        return fail(error.message);
      }
      if (isSerializationFailure(error) && attempt < MAX_SERIALIZATION_RETRIES - 1) {
        continue;
      }
      console.error("[payments] Failed to register payment:", error);
      return fail("No se pudo registrar el pago. Intenta nuevamente.");
    }
  }

  return fail("No se pudo registrar el pago. Intenta nuevamente.");
}

// ---------------------------------------------------------------------
// Comprobantes: listing, single-payment detail, approve/reject
// ---------------------------------------------------------------------

function isValidPaymentValidationStatus(
  value: string | undefined,
): value is PaymentValidationStatus {
  return !!value && (Object.values(PaymentValidationStatus) as string[]).includes(value);
}

export type DecoratedPaymentListRow = PaymentListRow;

/**
 * Lists individual payments (not installments) for the Comprobantes
 * validation panel. The module itself is ADMIN/ACCOUNTANT-only (see
 * MODULE_ACCESS in rbac.ts, enforced by requireModuleAccess("comprobantes")
 * in the caller) so both roles see every payment; `sellerId` scoping is
 * kept here anyway as defense in depth, mirroring listInstallmentsForUser.
 */
export async function listPendingPaymentsForUser(
  user: PublicUser,
  filters: {
    search?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    sellerId?: string;
  },
): Promise<DecoratedPaymentListRow[]> {
  let sellerId: string | undefined;
  if (user.role === UserRole.SELLER) {
    sellerId = user.id;
  } else if (user.role === UserRole.ADMIN && filters.sellerId && isValidUuid(filters.sellerId)) {
    sellerId = filters.sellerId;
  }

  const status = isValidPaymentValidationStatus(filters.status) ? filters.status : undefined;
  const dateFrom = filters.dateFrom ? (parseDateOnly(filters.dateFrom) ?? undefined) : undefined;
  const dateTo = filters.dateTo ? (parseDateOnly(filters.dateTo) ?? undefined) : undefined;

  return paymentRepository.listPayments({
    sellerId,
    status,
    search: filters.search,
    dateFrom,
    dateTo,
  });
}

export type DecoratedPaymentDetail = NonNullable<PaymentDetail> & {
  installmentTotalCents: number;
  installmentApprovedCents: number;
  installmentBalanceCents: number;
};

/**
 * Fetches one payment with everything the Comprobantes detail page needs,
 * enforcing record-level ownership for SELLER (a SELLER can only ever
 * reach this through a direct URL, since the module itself is closed to
 * them -- kept for defense in depth). A payment that doesn't exist and one
 * that exists but isn't the SELLER's look identical, mirroring
 * getInstallmentForUser.
 */
export async function getPaymentForUser(
  user: PublicUser,
  id: string,
): Promise<DecoratedPaymentDetail | null> {
  if (!isValidUuid(id)) {
    return null;
  }

  const payment = await paymentRepository.findPaymentById(id);
  if (!payment) {
    return null;
  }

  if (user.role === UserRole.SELLER && payment.installment.sale.sellerId !== user.id) {
    return null;
  }

  const installmentTotalCents = toCents(payment.installment.amount);
  const installmentApprovedCents = sumApprovedCents(payment.installment.payments);

  return {
    ...payment,
    installmentTotalCents,
    installmentApprovedCents,
    installmentBalanceCents: installmentTotalCents - installmentApprovedCents,
  };
}

export type PaymentValidationResult = { ok: true } | { ok: false; formError: string };

/**
 * Approves a pending payment -- ADMIN/ACCOUNTANT only. Re-reads the
 * payment and its installment's approved total inside a SERIALIZABLE
 * transaction and re-validates every business rule against that fresh
 * read, never against anything computed earlier or passed in:
 *   1. The payment still exists and is still PENDING_VALIDATION (it can't
 *      be approved/rejected twice, including by two concurrent requests).
 *   2. Approving it would not push the installment's approved total past
 *      its amount (no overpayment), which is the scenario two concurrent
 *      approvals on different pending payments must never both succeed
 *      past -- PostgreSQL's serializable isolation aborts the losing
 *      transaction with a serialization failure, retried below.
 */
export async function approvePaymentForUser(
  user: PublicUser,
  paymentId: string,
): Promise<PaymentValidationResult> {
  if (user.role !== UserRole.ADMIN && user.role !== UserRole.ACCOUNTANT) {
    return { ok: false, formError: "No tienes permiso para aprobar pagos." };
  }
  if (!isValidUuid(paymentId)) {
    return { ok: false, formError: "El pago indicado no es válido." };
  }

  for (let attempt = 0; attempt < MAX_SERIALIZATION_RETRIES; attempt += 1) {
    try {
      await paymentRepository.runSerializable(async (tx) => {
        const payment = await paymentRepository.findPaymentById(paymentId, tx);
        if (!payment) {
          throw new PaymentValidationError("El pago indicado no existe.");
        }
        if (payment.validationStatus !== PaymentValidationStatus.PENDING_VALIDATION) {
          throw new PaymentValidationError("Este pago ya fue validado.");
        }

        const totalCents = toCents(payment.installment.amount);
        const approvedElsewhereCents = sumApprovedCents(
          payment.installment.payments.filter((p) => p.id !== payment.id),
        );
        const thisAmountCents = toCents(payment.amount);
        const newApprovedCents = approvedElsewhereCents + thisAmountCents;

        if (newApprovedCents > totalCents) {
          throw new PaymentValidationError(
            "Aprobar este pago superaría el valor total de la cuota.",
          );
        }

        await paymentRepository.approvePayment(tx, { paymentId, validatedById: user.id });

        const newStatus = computeInstallmentStatus(
          totalCents,
          newApprovedCents,
          payment.installment.dueDate,
          new Date(),
        );
        await paymentRepository.updateInstallmentStatus(tx, payment.installmentId, newStatus);

        // --- Credit the sale's bank account, only now that the payment is
        // definitively approved, and only for exactly this payment's real
        // amount (never the sale's total/finalPrice) -- see the module
        // design note above.
        const sale = payment.installment.sale;
        if (sale.bankAccountId) {
          // Defense in depth: BankTransaction.paymentId is `@unique` in the
          // schema, so a duplicate insert below would fail on its own --
          // this pre-check just turns that into a clear early exit instead
          // of relying solely on the database catching it. Both run inside
          // this same SERIALIZABLE transaction, so a concurrent duplicate
          // attempt still can't slip through between the two.
          const existingTransaction = await bankAccountRepository.findBankTransactionByPaymentId(
            paymentId,
            tx,
          );
          if (existingTransaction) {
            throw new PaymentValidationError(
              "Este pago ya generó un movimiento bancario. No se puede duplicar.",
            );
          }

          const approvedAmount = centsToDecimalString(thisAmountCents);
          await bankAccountRepository.createBankTransaction(tx, {
            bankAccountId: sale.bankAccountId,
            saleId: sale.id,
            paymentId,
            amount: approvedAmount,
            type: BankTransactionType.INCOME,
            description: `Ingreso - ${sale.product.name} - Cuota ${payment.installment.installmentNumber}`,
          });
          await bankAccountRepository.incrementBankAccountBalance(
            tx,
            sale.bankAccountId,
            approvedAmount,
          );
        }

        // --- Recompute the sale's own status from its full payment ledger
        // now that this approval changed its APPROVED total -- see the
        // module design note and recomputeSaleStatus above.
        await recomputeSaleStatus(tx, sale.id);
      });

      return { ok: true };
    } catch (error) {
      if (error instanceof PaymentValidationError) {
        return { ok: false, formError: error.message };
      }
      if (isSerializationFailure(error) && attempt < MAX_SERIALIZATION_RETRIES - 1) {
        continue;
      }
      console.error("[payments] Failed to approve payment:", error);
      return { ok: false, formError: "No se pudo aprobar el pago. Intenta nuevamente." };
    }
  }

  return { ok: false, formError: "No se pudo aprobar el pago. Intenta nuevamente." };
}

export type RejectPaymentResult =
  | { ok: true }
  | { ok: false; formError?: string; errors?: { reason?: string } };

/**
 * Rejects a pending payment -- ADMIN/ACCOUNTANT only. A rejection reason
 * is mandatory and validated here, never trusted from the client beyond
 * that. Rejecting never changes any approved total or installment status
 * arithmetic (a REJECTED payment never counted toward the balance in the
 * first place) -- the installment status is still recomputed in case its
 * due date crossed into OVERDUE in the meantime.
 */
export async function rejectPaymentForUser(
  user: PublicUser,
  paymentId: string,
  reasonRaw: FormDataEntryValue | null | undefined,
): Promise<RejectPaymentResult> {
  if (user.role !== UserRole.ADMIN && user.role !== UserRole.ACCOUNTANT) {
    return { ok: false, formError: "No tienes permiso para rechazar pagos." };
  }
  if (!isValidUuid(paymentId)) {
    return { ok: false, formError: "El pago indicado no es válido." };
  }

  const reason = str(reasonRaw);
  if (!reason) {
    return { ok: false, errors: { reason: "El motivo del rechazo es obligatorio." } };
  }

  for (let attempt = 0; attempt < MAX_SERIALIZATION_RETRIES; attempt += 1) {
    try {
      await paymentRepository.runSerializable(async (tx) => {
        const payment = await paymentRepository.findPaymentById(paymentId, tx);
        if (!payment) {
          throw new PaymentValidationError("El pago indicado no existe.");
        }
        if (payment.validationStatus !== PaymentValidationStatus.PENDING_VALIDATION) {
          throw new PaymentValidationError("Este pago ya fue validado.");
        }

        await paymentRepository.rejectPayment(tx, {
          paymentId,
          validatedById: user.id,
          rejectionReason: reason,
        });

        const totalCents = toCents(payment.installment.amount);
        const approvedCents = sumApprovedCents(payment.installment.payments);
        const newStatus = computeInstallmentStatus(
          totalCents,
          approvedCents,
          payment.installment.dueDate,
          new Date(),
        );
        await paymentRepository.updateInstallmentStatus(tx, payment.installmentId, newStatus);
      });

      return { ok: true };
    } catch (error) {
      if (error instanceof PaymentValidationError) {
        return { ok: false, formError: error.message };
      }
      if (isSerializationFailure(error) && attempt < MAX_SERIALIZATION_RETRIES - 1) {
        continue;
      }
      console.error("[payments] Failed to reject payment:", error);
      return { ok: false, formError: "No se pudo rechazar el pago. Intenta nuevamente." };
    }
  }

  return { ok: false, formError: "No se pudo rechazar el pago. Intenta nuevamente." };
}

class PaymentValidationError extends Error {}

/** Postgres SQLSTATE 40001 (serialization_failure), as Prisma's P2034. */
function isSerializationFailure(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
}
