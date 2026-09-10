import "server-only";
import { UserRole, SaleStatus, PaymentMethod } from "@/generated/prisma/enums";
import type { PublicUser } from "@/lib/auth/session";
import { isValidUuid } from "@/lib/validation";
import * as saleRepository from "@/server/repositories/sale-repository";
import type { SaleListItem } from "@/server/repositories/sale-repository";
import * as customerRepository from "@/server/repositories/customer-repository";
import * as bankAccountRepository from "@/server/repositories/bank-account-repository";
import * as customerService from "@/server/services/customer-service";
import type { CustomerActionResult, RawCustomerInput } from "@/server/services/customer-service";
import { sumApprovedCents, computeInstallmentTotals } from "@/server/services/payment-service";
import type { InstallmentWithTotals } from "@/server/services/payment-service";
import {
  MAX_RECEIPT_BYTES,
  deleteReceiptFile,
  saveReceiptFile,
  validateReceiptFile,
} from "@/server/services/receipt-storage";

// All Sale permission logic lives here, not in pages/components/actions.
// Every function takes the authenticated `user` and enforces:
//   1. What the user is allowed to see (row-level scoping for SELLER).
//   2. What the user is allowed to write (sellerId rules, ACCOUNTANT can't
//      create at all).
//   3. Discount validation, installment distribution and due dates.
// Callers (Server Actions, pages) must still call requireModuleAccess()
// themselves first -- this layer assumes module-level access already
// passed and only handles record-level rules.

export type SaleFieldErrors = Partial<
  Record<
    | "customerId"
    | "productId"
    | "saleDate"
    | "discount"
    | "installments"
    | "sellerId"
    | "receipt"
    // The seller-entered amount for installment 1 -- the only cuota amount
    // ever submitted by the client. Installments 2/3 are always computed
    // server-side from this and finalPriceCents (see the validation below),
    // so their sum can never mismatch finalPriceCents and needs no error of
    // its own.
    | "firstInstallmentAmount",
    string
  >
> & {
  // One entry per installment (aligned by index), rather than a single
  // flat message -- the form needs to point at exactly which cuota's
  // date is invalid.
  installmentDates?: (string | undefined)[];
  // --- Per-cuota payments (CUOTA vs. PAGO): a cuota can have one or more
  // Payments, each with its own amount/method/voucher -- see
  // createSaleForUser's per-cuota payment block below. Every array here is
  // 2D, indexed first by installment (0..installmentsCount-1) and then by
  // payment row within that installment (0..MAX_PAYMENTS_PER_INSTALLMENT-1).
  // An installment with no payments yet, or a payment row with no method
  // selected, simply has no entry -- both are entirely optional per index.
  installmentPaymentMethods?: (string | undefined)[][];
  installmentPaymentAmounts?: (string | undefined)[][];
  installmentPaymentReceivedByNames?: (string | undefined)[][];
  installmentPaymentReceipts?: (string | undefined)[][];
  // Only set for a row whose method is BANK_TRANSFER, DEPOSIT or CARD --
  // CASH rows never require a destination account. A CARD row's account is
  // always the fixed one from getCardPaymentBankAccountForSaleForm, never a
  // seller choice (see the validation below).
  installmentPaymentBankAccountIds?: (string | undefined)[][];
  // One entry per installment (not per payment row): set when that cuota's
  // payments sum to more than its own amount.
  installmentPaymentsTotal?: (string | undefined)[];
};

export type SaleActionResult =
  | { ok: true; id: string }
  | { ok: false; errors?: SaleFieldErrors; formError?: string };

export type RawSaleInput = {
  customerId?: FormDataEntryValue | null;
  productId?: FormDataEntryValue | null;
  saleDate?: FormDataEntryValue | null;
  discount?: FormDataEntryValue | null;
  installments?: FormDataEntryValue | null;
  sellerId?: FormDataEntryValue | null;
  // One value per installment, in installment order (e.g. FormData's
  // getAll("installmentDueDates")).
  installmentDueDates?: FormDataEntryValue[];
  // The seller-entered amount for installment 1 only. Installments 2/3 (when
  // present) are never submitted -- they're always computed server-side by
  // splitting the remaining balance evenly (see the validation below), per
  // the "cuota 1 configurable, el resto automático" business rule. Ignored
  // entirely when installments = 1 (that single cuota is always the full
  // finalPriceCents).
  firstInstallmentAmount?: FormDataEntryValue | null;
  // Optional -- the "Nueva venta" flow no longer requires a general
  // receipt; see the validation in createSaleForUser below.
  receipt?: FormDataEntryValue | null;
  // --- Per-cuota payments (CUOTA vs. PAGO, see the validation below): 2D,
  // indexed first by installment then by payment row within it (mirrors
  // ventas/actions.ts's own getIndexed2D/MAX_PAYMENTS_PER_INSTALLMENT,
  // which must stay in sync with this module's own constant of the same
  // name). A payment row with an empty method means "no payment there" --
  // the common case for most rows. Every other field below is only
  // validated/required for a row whose method isn't empty, and
  // installmentPaymentReceivedByNames only applies when that row's method is
  // CASH (installmentPaymentReceipts only when it isn't).
  installmentPaymentMethods?: FormDataEntryValue[][];
  installmentPaymentAmounts?: FormDataEntryValue[][];
  installmentPaymentReceivedByNames?: FormDataEntryValue[][];
  installmentPaymentNotes?: FormDataEntryValue[][];
  installmentPaymentReceipts?: FormDataEntryValue[][];
  // The bank account each BANK_TRANSFER/DEPOSIT payment row lands in -- a
  // sale can mix several payments across different cuotas (or different
  // methods within the same cuota), each into its own account, so this is
  // never a single sale-wide value (see Payment.bankAccountId in
  // schema.prisma). For a CARD row this is expected to already be the fixed
  // account id the form renders as read-only (see
  // getCardPaymentBankAccountForSaleForm) -- the server re-validates that
  // below rather than trusting it. Ignored for CASH rows.
  installmentPaymentBankAccountIds?: FormDataEntryValue[][];
};

// A cuota can have several Payments (e.g. part cash, part transfer), but the
// number of rows the form can submit per installment still needs a fixed
// upper bound so the Server Action can read fixed-name indexed fields
// (`installmentPaymentMethod-<i>-<j>`) out of FormData without knowing in
// advance how many rows the client rendered. 5 is a generous ceiling for a
// single cuota's payments in practice. Must match sale-form.tsx's own
// MAX_PAYMENTS_PER_INSTALLMENT and ventas/actions.ts's getIndexed2D bound.
const MAX_PAYMENTS_PER_INSTALLMENT = 5;

function str(value: FormDataEntryValue | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

const ALLOWED_INSTALLMENT_COUNTS = [1, 2, 3] as const;
type InstallmentCount = (typeof ALLOWED_INSTALLMENT_COUNTS)[number];

/** Parses a "YYYY-MM-DD" <input type="date"> value as UTC midnight -- never through the local timezone, so the calendar day can't shift. */
function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toCents(amount: number): number {
  return Math.round(amount * 100);
}

function centsToDecimalString(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Splits `totalCents` into `count` shares that sum exactly back to
 * `totalCents` -- the floor share for the first `count - 1` shares, with the
 * last absorbing whatever rounding remainder is left, so money is never
 * gained or lost to rounding (mirrors sale-form.tsx's own
 * distributeCentsPreview, used there only for the live preview).
 */
function distributeCentsEvenly(totalCents: number, count: number): number[] {
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  const shares = Array<number>(count).fill(base);
  shares[count - 1] += remainder;
  return shares;
}

function isValidSaleStatus(value: string | undefined): value is SaleStatus {
  return !!value && (Object.values(SaleStatus) as string[]).includes(value);
}

/** Mirrors payment-service.ts's own isValidPaymentMethod -- duplicated rather than shared, same pattern as parseDateOnly/toCents above. */
const PAYMENT_METHOD_VALUES = Object.values(PaymentMethod) as string[];
function isValidPaymentMethod(value: string): value is PaymentMethod {
  return PAYMENT_METHOD_VALUES.includes(value);
}

/**
 * Resolves the effective `sellerId` scope for a sales query: SELLER is
 * always forced to their own id (a submitted sellerId is ignored); ADMIN/
 * ACCOUNTANT both have "all" access to Ventas (see rbac.ts) and may
 * additionally narrow the query down to one seller via `filters.sellerId`.
 * Shared by listSalesForUser and listSalesForExportForUser so both apply
 * the exact same scoping rule.
 */
function resolveSaleSellerScope(user: PublicUser, filters: { sellerId?: string }): string | undefined {
  if (user.role === UserRole.SELLER) {
    return user.id;
  }
  if (
    (user.role === UserRole.ADMIN || user.role === UserRole.ACCOUNTANT) &&
    filters.sellerId &&
    isValidUuid(filters.sellerId)
  ) {
    return filters.sellerId;
  }
  return undefined;
}

export type DecoratedSaleInstallment = InstallmentWithTotals<SaleListItem["installments"][number]>;

export type DecoratedSaleListItem = Omit<SaleListItem, "installments"> & {
  // Full agreed price, in cents -- same figure as `finalPrice`, just already
  // converted so the table never re-parses a Decimal string.
  finalPriceCents: number;
  // Sum of APPROVED payments across every installment -- the real "total
  // pagado", never the sum of cuotas (see the module design note in
  // payment-service.ts: an installment's own `amount` is what was agreed,
  // not what was collected).
  paidCents: number;
  // finalPriceCents - paidCents. Computed from real Payments, not just from
  // whichever installments are still PENDING/PARTIALLY_PAID by status.
  balanceCents: number;
  installments: DecoratedSaleInstallment[];
  // The first installment (in installmentNumber order) that still has a
  // balance -- never a fully-paid one, even if a later cuota happens to be
  // unpaid too. Null once every cuota is fully paid.
  nextInstallment: DecoratedSaleInstallment | null;
};

/**
 * Decorates one sale-list row with real paid/pending totals and the "próxima
 * cuota" -- reuses payment-service.ts#computeInstallmentTotals (the exact
 * same APPROVED-only math the sale detail page and Cuotas module already
 * use) rather than re-deriving it from the stored Installment/Sale status
 * columns, which only reflect the ledger as of the last write.
 */
function decorateSaleListItem(sale: SaleListItem, now: Date): DecoratedSaleListItem {
  const installments = sale.installments.map((installment) => computeInstallmentTotals(installment, now));
  const finalPriceCents = toCents(Number(sale.finalPrice));
  const paidCents = installments.reduce((sum, installment) => sum + installment.paidCents, 0);
  const nextInstallment = installments.find((installment) => installment.balanceCents > 0) ?? null;

  return {
    ...sale,
    installments,
    finalPriceCents,
    paidCents,
    balanceCents: finalPriceCents - paidCents,
    nextInstallment,
  };
}

/** SELLER sees only their own sales; ADMIN/ACCOUNTANT see all (optionally narrowed to one seller via `filters.sellerId`). */
export async function listSalesForUser(
  user: PublicUser,
  filters: {
    search?: string;
    productId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    sellerId?: string;
  },
): Promise<DecoratedSaleListItem[]> {
  const sellerId = resolveSaleSellerScope(user, filters);
  const status = isValidSaleStatus(filters.status) ? filters.status : undefined;
  const dateFrom = filters.dateFrom ? (parseDateOnly(filters.dateFrom) ?? undefined) : undefined;
  const dateTo = filters.dateTo ? (parseDateOnly(filters.dateTo) ?? undefined) : undefined;

  const sales = await saleRepository.listSales({
    sellerId,
    search: filters.search,
    productId: filters.productId && isValidUuid(filters.productId) ? filters.productId : undefined,
    status,
    dateFrom,
    dateTo,
  });

  const now = new Date();
  return sales.map((sale) => decorateSaleListItem(sale, now));
}

/**
 * Fetches one sale, enforcing record-level ownership for SELLER. Returns
 * null both when the sale doesn't exist and when a SELLER isn't its
 * seller -- the two cases must look identical so a SELLER can't use this
 * to probe for other sellers' sale IDs.
 */
export async function getSaleForUser(user: PublicUser, id: string) {
  if (!isValidUuid(id)) {
    return null;
  }

  const sale = await saleRepository.findSaleById(id);
  if (!sale) {
    return null;
  }

  if (user.role === UserRole.SELLER && sale.sellerId !== user.id) {
    return null;
  }

  return sale;
}

/** Active products, for both the "producto" filter and the sale form's selector. */
export function listProductsForSaleForm() {
  return saleRepository.listActiveProducts();
}

/**
 * Active bank accounts, for the sale form's per-payment "cuenta bancaria de
 * destino" selector (shown under each BANK_TRANSFER/DEPOSIT forma de pago
 * block, never at the sale level -- a sale's cuotas can each be paid into a
 * different account). Available to every role that can reach the sale form
 * (ADMIN, SELLER) -- unlike the /cuentas-bancarias module itself (ADMIN/
 * ACCOUNTANT only, see rbac.ts), a SELLER must be able to pick a destination
 * account when registering a payment without gaining any other access to
 * that module (they still can't view/manage accounts there).
 */
export function listBankAccountsForSaleForm() {
  return bankAccountRepository.listActiveBankAccounts();
}

/**
 * The single BankAccount every CARD (tarjeta) payment must be credited to --
 * configured once via the CARD_PAYMENT_BANK_ACCOUNT_ID env var, never chosen
 * by the seller. Unlike BANK_TRANSFER/DEPOSIT (any active account works), a
 * CARD payment row is only ever valid against this exact account, since in
 * practice every card terminal settles into the same Banco Guayaquil
 * account. Returns undefined when the env var is unset/blank/not a UUID, or
 * doesn't resolve to a currently-active account -- createSaleForUser then
 * refuses every CARD row with a clear error rather than silently allowing
 * an unconfigured/arbitrary destination.
 */
function cardPaymentBankAccountIdFromEnv(): string | undefined {
  const id = process.env.CARD_PAYMENT_BANK_ACCOUNT_ID?.trim();
  return id && isValidUuid(id) ? id : undefined;
}

/**
 * Resolves the fixed CARD-payment bank account (see
 * cardPaymentBankAccountIdFromEnv above) -- used both by createSaleForUser's
 * validation and by the sale form (to render it as a locked field) so both
 * always agree on exactly the same account.
 */
export async function getCardPaymentBankAccountForSaleForm() {
  const id = cardPaymentBankAccountIdFromEnv();
  if (!id) return null;
  return bankAccountRepository.findActiveBankAccountById(id);
}

/**
 * Customer search for the sale form's customer selector: a SELLER only
 * ever gets their own assigned customers back, matching the scoping rule
 * used everywhere else in the app -- never fetched broadly and filtered
 * client-side. ACCOUNTANT can't create sales, so it never gets results
 * either. Empty/blank queries return no results, to avoid handing back
 * the entire customer table on an empty search.
 */
export async function searchCustomersForSaleForm(user: PublicUser, query: string) {
  if (user.role === UserRole.ACCOUNTANT) {
    return [];
  }

  const trimmed = typeof query === "string" ? query.trim() : "";
  if (!trimmed) {
    return [];
  }

  const sellerId = user.role === UserRole.SELLER ? user.id : undefined;
  return customerRepository.searchCustomers({ sellerId, query: trimmed });
}

/**
 * Creates a customer from the "Nueva venta" screen's quick-create modal.
 * Delegates all field validation and assignedSellerId resolution to the
 * existing Clientes module logic (customer-service.createCustomerForUser)
 * -- this only adds the one rule specific to this entry point: ACCOUNTANT
 * can't create sales, so it can't use this shortcut either.
 */
export async function createCustomerForSaleForm(
  user: PublicUser,
  raw: RawCustomerInput,
): Promise<CustomerActionResult> {
  if (user.role === UserRole.ACCOUNTANT) {
    return { ok: false, formError: "No tienes permiso para crear ventas." };
  }

  return customerService.createCustomerForUser(user, raw);
}

/** The SELLER options for the "vendedor" selector (sale form, quick-create customer modal, and the ADMIN/ACCOUNTANT "vendedor" filter on the Ventas listing/export). */
export function listSellersForSaleForm() {
  return customerRepository.listActiveSellers();
}

export async function createSaleForUser(
  user: PublicUser,
  raw: RawSaleInput,
): Promise<SaleActionResult> {
  // ACCOUNTANT can view sales but never create them. This is the
  // authoritative check -- the page hides/redirects around the form, but
  // this function is what actually enforces it.
  if (user.role === UserRole.ACCOUNTANT) {
    return { ok: false, formError: "No tienes permiso para crear ventas." };
  }

  const errors: SaleFieldErrors = {};

  // --- Customer: SELLER can only sell to their own assigned customers.
  // A customer that doesn't exist and one that exists but belongs to
  // another seller must produce the exact same error, so a SELLER can't
  // use this form to probe for other sellers' customer IDs.
  const customerId = str(raw.customerId);
  let customer: Awaited<ReturnType<typeof customerRepository.findCustomerById>> = null;
  if (!customerId || !isValidUuid(customerId)) {
    errors.customerId = "Selecciona un cliente válido.";
  } else {
    customer = await customerRepository.findCustomerById(customerId);
    if (!customer) {
      errors.customerId = "Selecciona un cliente válido.";
    } else if (user.role === UserRole.SELLER && customer.assignedSellerId !== user.id) {
      errors.customerId = "Selecciona un cliente válido.";
      customer = null;
    }
  }

  // --- Product: must be active. Its officialPrice becomes the snapshot
  // Sale.originalPrice, recomputed here from the database -- never trusted
  // from the client.
  const productId = str(raw.productId);
  let product: Awaited<ReturnType<typeof saleRepository.findActiveProductById>> = null;
  if (!productId || !isValidUuid(productId)) {
    errors.productId = "Selecciona un producto válido.";
  } else {
    product = await saleRepository.findActiveProductById(productId);
    if (!product) {
      errors.productId = "Selecciona un producto activo válido.";
    }
  }

  // --- Sale date: required, parsed as a plain calendar date (UTC
  // midnight) so installment due dates never drift with the server's
  // local timezone.
  const saleDateRaw = str(raw.saleDate);
  const saleDate = saleDateRaw ? parseDateOnly(saleDateRaw) : null;
  if (!saleDate) {
    errors.saleDate = "La fecha de venta es obligatoria.";
  }

  // --- Installments: only 1, 2 or 3 are allowed.
  const installmentsCount = Number(str(raw.installments));
  const hasValidInstallmentsCount = ALLOWED_INSTALLMENT_COUNTS.includes(
    installmentsCount as InstallmentCount,
  );
  if (!hasValidInstallmentsCount) {
    errors.installments = "Selecciona 1, 2 o 3 cuotas.";
  }

  // --- Installment due dates: one manually-chosen date per installment.
  // Never derived automatically (e.g. +30/+60 days) -- the customer can
  // negotiate any date. Each one must exist, parse as a valid calendar
  // date, and not fall before the sale date. Client-side validation is
  // not trusted; this is the authoritative check.
  const installmentDueDates: Date[] = [];
  if (hasValidInstallmentsCount && saleDate) {
    const dateErrors: (string | undefined)[] = [];
    const rawDates = (raw.installmentDueDates ?? []).map(str);

    for (let index = 0; index < installmentsCount; index += 1) {
      const rawDate = rawDates[index] ?? "";
      if (!rawDate) {
        dateErrors[index] = "La fecha de vencimiento es obligatoria.";
        continue;
      }
      const parsed = parseDateOnly(rawDate);
      if (!parsed) {
        dateErrors[index] = "La fecha de vencimiento no es válida.";
        continue;
      }
      if (parsed.getTime() < saleDate.getTime()) {
        dateErrors[index] = "La fecha no puede ser anterior a la fecha de venta.";
        continue;
      }
      installmentDueDates[index] = parsed;
    }

    if (dateErrors.some((message) => message !== undefined)) {
      errors.installmentDates = dateErrors;
    }
  }

  // --- Seller: SELLER is always assigned to themselves, regardless of
  // what (if anything) was submitted in the request -- a manipulated
  // sellerId field is simply ignored. ADMIN must pick an existing, active
  // SELLER.
  let sellerId: string | undefined;
  if (user.role === UserRole.SELLER) {
    sellerId = user.id;
  } else {
    const requestedSellerId = str(raw.sellerId);
    if (!requestedSellerId || !isValidUuid(requestedSellerId)) {
      errors.sellerId = "Selecciona un vendedor válido.";
    } else {
      const seller = await customerRepository.findActiveSellerById(requestedSellerId);
      if (!seller) {
        errors.sellerId = "Selecciona un vendedor activo válido.";
      } else {
        sellerId = seller.id;
      }
    }
  }

  // --- Discount: optional, defaults to 0. Validated against the actual
  // product price fetched above, never against a client-computed value.
  const discountRaw = str(raw.discount) || "0";
  const discountValue = Number(discountRaw);
  let originalPriceCents = 0;
  let discountCents = 0;
  if (product) {
    originalPriceCents = toCents(Number(product.officialPrice));
  }
  if (!Number.isFinite(discountValue) || discountValue < 0) {
    errors.discount = "El descuento no puede ser negativo.";
  } else if (product) {
    discountCents = toCents(discountValue);
    if (discountCents > originalPriceCents) {
      errors.discount = "El descuento no puede superar el precio original.";
    } else if (originalPriceCents - discountCents <= 0) {
      errors.discount = "El descuento no puede dejar el precio final en cero o menos.";
    }
  }

  // --- Installment amounts: CUOTA = the agreed amount the customer owes,
  // never the money actually handed over (that's a Payment, validated
  // separately below). The seller only ever sets installment 1's amount;
  // every other installment is computed here by splitting whatever is left
  // of finalPriceCents evenly across the remaining installments (the last
  // one absorbing any rounding remainder, via distributeCentsEvenly) -- so
  // their sum always lands exactly on finalPriceCents by construction, and
  // every downstream ledger figure that assumes installments == finalPrice
  // (e.g. dashboard-service.ts's collectedCents + pendingToCollectCents)
  // keeps holding. Never trusted from the client beyond the first amount.
  const installmentAmountCents: number[] = [];
  if (hasValidInstallmentsCount && product) {
    const trueFinalPriceCents = originalPriceCents - discountCents;
    if (installmentsCount === 1) {
      // A single cuota is always the full price -- nothing for the seller
      // to configure.
      installmentAmountCents[0] = trueFinalPriceCents;
    } else {
      const firstRaw = str(raw.firstInstallmentAmount);
      const firstValue = Number(firstRaw);
      if (!firstRaw || !Number.isFinite(firstValue)) {
        errors.firstInstallmentAmount = "El monto de la primera cuota es obligatorio.";
      } else if (firstValue <= 0) {
        errors.firstInstallmentAmount = "El monto de la primera cuota debe ser mayor a cero.";
      } else {
        const firstCents = toCents(firstValue);
        const remainingCount = installmentsCount - 1;
        const remainderCents = trueFinalPriceCents - firstCents;
        if (firstCents >= trueFinalPriceCents) {
          errors.firstInstallmentAmount =
            "El monto de la primera cuota debe ser menor al precio final de la venta.";
        } else if (remainderCents < remainingCount) {
          // Not enough left over to give every remaining cuota at least one
          // cent -- an edge case, but the rounding rule below only ever
          // adds whole cents.
          errors.firstInstallmentAmount =
            "El monto de la primera cuota deja un saldo insuficiente para repartir entre las demás cuotas.";
        } else {
          installmentAmountCents[0] = firstCents;
          distributeCentsEvenly(remainderCents, remainingCount).forEach((cents, shareIndex) => {
            installmentAmountCents[1 + shareIndex] = cents;
          });
        }
      }
    }
  }

  // --- Per-cuota payments (CUOTA vs. PAGO vs. FORMA DE PAGO): a cuota can
  // have one or several Payments -- e.g. $100 cash + $200 transfer against
  // the same $300 cuota -- each validated exactly like
  // registerPaymentForUser validates a manually-registered payment
  // (amount/method, plus either "Entregado a" for CASH or a mandatory
  // voucher for every other method). The one extra rule specific to this
  // entry point: the *sum* of a cuota's payments can never exceed that
  // cuota's own amount, checked once per installment after every row is
  // parsed (not per row, since two valid-looking individual amounts can
  // still jointly overpay the cuota). Entirely opt-in per row -- a row with
  // no method selected is skipped entirely, so a cuota can be left
  // unpaid, partially paid, or paid through several rows, all without
  // creating any extra Installment.
  const installmentPaymentMethods: (PaymentMethod | null)[][] = [];
  const installmentPaymentAmountCents: (number | null)[][] = [];
  const installmentPaymentReceivedByNames: (string | undefined)[][] = [];
  const installmentPaymentNotesValues: (string | undefined)[][] = [];
  const installmentPaymentReceiptFiles: (File | null)[][] = [];
  const installmentPaymentBankAccountIds: (string | undefined)[][] = [];

  if (hasValidInstallmentsCount) {
    // Resolved once, outside the per-row loop below, so every CARD row in
    // this submission is checked against the exact same fixed account.
    const fixedCardBankAccount = await getCardPaymentBankAccountForSaleForm();

    const methodErrors: (string | undefined)[][] = [];
    const amountErrors: (string | undefined)[][] = [];
    const receivedByNameErrors: (string | undefined)[][] = [];
    const receiptErrors: (string | undefined)[][] = [];
    const bankAccountErrors: (string | undefined)[][] = [];
    const totalErrors: (string | undefined)[] = [];

    for (let index = 0; index < installmentsCount; index += 1) {
      installmentPaymentMethods[index] = [];
      installmentPaymentAmountCents[index] = [];
      installmentPaymentReceivedByNames[index] = [];
      installmentPaymentNotesValues[index] = [];
      installmentPaymentReceiptFiles[index] = [];
      installmentPaymentBankAccountIds[index] = [];
      methodErrors[index] = [];
      amountErrors[index] = [];
      receivedByNameErrors[index] = [];
      receiptErrors[index] = [];
      bankAccountErrors[index] = [];

      const rawMethods = (raw.installmentPaymentMethods?.[index] ?? []).map(str);
      const rawAmounts = (raw.installmentPaymentAmounts?.[index] ?? []).map(str);
      const rawReceivedByNames = (raw.installmentPaymentReceivedByNames?.[index] ?? []).map(str);
      const rawNotes = (raw.installmentPaymentNotes?.[index] ?? []).map(str);
      const rawReceipts = raw.installmentPaymentReceipts?.[index] ?? [];
      const rawBankAccountIds = (raw.installmentPaymentBankAccountIds?.[index] ?? []).map(str);

      let validPaymentsSumCents = 0;

      for (let row = 0; row < MAX_PAYMENTS_PER_INSTALLMENT; row += 1) {
        const methodRaw = rawMethods[row] ?? "";
        if (!methodRaw) {
          installmentPaymentMethods[index][row] = null;
          continue;
        }
        if (!isValidPaymentMethod(methodRaw)) {
          methodErrors[index][row] = "Selecciona una forma de pago válida.";
          installmentPaymentMethods[index][row] = null;
          continue;
        }
        installmentPaymentMethods[index][row] = methodRaw;

        // --- Bank account: BANK_TRANSFER/DEPOSIT payments land in whichever
        // active account the seller picks; CASH never collects one. A cuota
        // can mix several methods (e.g. part transfer, part cash), and each
        // BANK_TRANSFER/DEPOSIT row keeps its own account rather than
        // sharing a single sale-wide one (see Payment.bankAccountId).
        if (methodRaw === PaymentMethod.BANK_TRANSFER || methodRaw === PaymentMethod.DEPOSIT) {
          const bankAccountIdRaw = rawBankAccountIds[row] ?? "";
          if (!bankAccountIdRaw || !isValidUuid(bankAccountIdRaw)) {
            bankAccountErrors[index][row] = "Selecciona una cuenta bancaria de destino.";
          } else {
            const paymentBankAccount =
              await bankAccountRepository.findActiveBankAccountById(bankAccountIdRaw);
            if (!paymentBankAccount) {
              bankAccountErrors[index][row] = "Selecciona una cuenta bancaria activa válida.";
            } else {
              installmentPaymentBankAccountIds[index][row] = paymentBankAccount.id;
            }
          }
        } else if (methodRaw === PaymentMethod.CARD) {
          // --- CARD always lands in the one fixed account (Banco Guayaquil)
          // every card terminal settles into -- the seller never chooses it,
          // so whatever the form submitted is only ever accepted if it
          // matches that exact account, never merely "any active account".
          if (!fixedCardBankAccount) {
            bankAccountErrors[index][row] =
              "No hay una cuenta bancaria configurada para pagos con tarjeta. Contacta a un administrador.";
          } else {
            const bankAccountIdRaw = rawBankAccountIds[row] ?? "";
            if (bankAccountIdRaw !== fixedCardBankAccount.id) {
              bankAccountErrors[index][row] = "La cuenta bancaria de tarjeta no es válida.";
            } else {
              installmentPaymentBankAccountIds[index][row] = fixedCardBankAccount.id;
            }
          }
        }

        const amountRaw = rawAmounts[row] ?? "";
        const amountValue = Number(amountRaw);
        if (!amountRaw || !Number.isFinite(amountValue)) {
          amountErrors[index][row] = "El monto del pago es obligatorio.";
        } else if (amountValue <= 0) {
          amountErrors[index][row] = "El monto del pago debe ser mayor a cero.";
        } else {
          const cents = toCents(amountValue);
          installmentPaymentAmountCents[index][row] = cents;
          validPaymentsSumCents += cents;
        }

        if (methodRaw === PaymentMethod.CASH) {
          const receivedByName = rawReceivedByNames[row] ?? "";
          if (!receivedByName) {
            receivedByNameErrors[index][row] = "Indica quién recibió el pago.";
          } else {
            installmentPaymentReceivedByNames[index][row] = receivedByName;
          }
        } else {
          const receiptEntry = rawReceipts[row];
          const receiptFile =
            receiptEntry instanceof File && receiptEntry.size > 0 ? receiptEntry : null;
          if (!receiptFile) {
            receiptErrors[index][row] = "Debes adjuntar el voucher del pago.";
          } else {
            const validationError = validateReceiptFile(receiptFile);
            if (validationError === "type") {
              receiptErrors[index][row] = "Solo se permiten archivos PDF, JPG, JPEG, PNG o WEBP.";
            } else if (validationError === "size") {
              receiptErrors[index][row] =
                `El voucher no debe superar ${Math.floor(MAX_RECEIPT_BYTES / (1024 * 1024))} MB.`;
            } else {
              installmentPaymentReceiptFiles[index][row] = receiptFile;
            }
          }
        }

        installmentPaymentNotesValues[index][row] = rawNotes[row] || undefined;
      }

      if (
        installmentAmountCents.length === installmentsCount &&
        !errors.firstInstallmentAmount &&
        validPaymentsSumCents > installmentAmountCents[index]
      ) {
        totalErrors[index] = "La suma de los pagos supera el monto de la cuota.";
      }
    }

    if (methodErrors.some((row) => row.some((message) => message !== undefined))) {
      errors.installmentPaymentMethods = methodErrors;
    }
    if (amountErrors.some((row) => row.some((message) => message !== undefined))) {
      errors.installmentPaymentAmounts = amountErrors;
    }
    if (receivedByNameErrors.some((row) => row.some((message) => message !== undefined))) {
      errors.installmentPaymentReceivedByNames = receivedByNameErrors;
    }
    if (receiptErrors.some((row) => row.some((message) => message !== undefined))) {
      errors.installmentPaymentReceipts = receiptErrors;
    }
    if (bankAccountErrors.some((row) => row.some((message) => message !== undefined))) {
      errors.installmentPaymentBankAccountIds = bankAccountErrors;
    }
    if (totalErrors.some((message) => message !== undefined)) {
      errors.installmentPaymentsTotal = totalErrors;
    }
  }

  // --- Sale-level receipt: optional. The "Nueva venta" flow no longer
  // requires a general comprobante -- the sale is already backed by each
  // installment's own payment record (CASH's "Entregado a" or a voucher
  // for every other method, both validated per-cuota above). Only
  // validated when actually provided (e.g. a future entry point that still
  // sends one); a missing/empty file is simply treated as "no receipt".
  const receiptFile = raw.receipt instanceof File && raw.receipt.size > 0 ? raw.receipt : null;
  if (receiptFile) {
    const validationError = validateReceiptFile(receiptFile);
    if (validationError === "type") {
      errors.receipt = "Solo se permiten archivos PDF, JPG, JPEG, PNG o WEBP.";
    } else if (validationError === "size") {
      errors.receipt = `El comprobante no debe superar ${Math.floor(MAX_RECEIPT_BYTES / (1024 * 1024))} MB.`;
    }
  }

  if (
    Object.keys(errors).length > 0 ||
    !customer ||
    !product ||
    !saleDate ||
    !sellerId ||
    !hasValidInstallmentsCount ||
    installmentDueDates.length !== installmentsCount ||
    installmentAmountCents.length !== installmentsCount
  ) {
    return { ok: false, errors };
  }

  // --- Final price and installment amounts: the final price is computed
  // server-side from cents (never trusted from the client); the amounts
  // themselves are the user-entered, per-cuota values validated above,
  // whose sum was already confirmed to equal finalPriceCents exactly. Due
  // dates come from the validated user input above -- never recalculated
  // automatically here.
  const finalPriceCents = originalPriceCents - discountCents;
  const amounts = installmentAmountCents;
  const installments = amounts.map((cents, index) => ({
    installmentNumber: index + 1,
    amount: centsToDecimalString(cents),
    dueDate: installmentDueDates[index],
  }));

  // The file is written to disk once, before the sale is created (its
  // content never depends on the sale outcome) -- on any failure below
  // it's deleted again so a failed registration never leaves an orphaned
  // file with no Sale/SaleReceipt row. Skipped entirely when no sale-level
  // receipt was provided, since it's no longer required by this flow.
  let savedReceipt: Awaited<ReturnType<typeof saveReceiptFile>> | null = null;
  if (receiptFile) {
    try {
      savedReceipt = await saveReceiptFile(receiptFile, "sale");
    } catch (error) {
      console.error("[sales] Failed to save receipt file:", error);
      return { ok: false, formError: "No se pudo guardar el comprobante. Intenta nuevamente." };
    }
  }

  // Same "save to disk once, up front" treatment as the sale's own receipt
  // above -- each voucher's content never depends on the sale/transaction
  // outcome, and on any failure below every already-saved voucher is
  // deleted again so a failed registration never leaves an orphaned file
  // with no Payment/PaymentReceipt row. 2D, mirroring
  // installmentPaymentReceiptFiles above -- null wherever that payment row
  // has no method, is CASH (never collects a voucher), or doesn't exist.
  const savedInstallmentReceipts: (Awaited<ReturnType<typeof saveReceiptFile>> | null)[][] = [];
  for (let index = 0; index < installmentsCount; index += 1) {
    savedInstallmentReceipts[index] = [];
    for (let row = 0; row < MAX_PAYMENTS_PER_INSTALLMENT; row += 1) {
      const file = installmentPaymentReceiptFiles[index]?.[row];
      if (!file) {
        savedInstallmentReceipts[index][row] = null;
        continue;
      }
      try {
        savedInstallmentReceipts[index][row] = await saveReceiptFile(file, "payment");
      } catch (error) {
        console.error("[sales] Failed to save cuota payment voucher file:", error);
        if (savedReceipt) await deleteReceiptFile(savedReceipt.fileUrl, "sale");
        for (const rowReceipts of savedInstallmentReceipts) {
          for (const saved of rowReceipts) {
            if (saved) await deleteReceiptFile(saved.fileUrl, "payment");
          }
        }
        return {
          ok: false,
          formError: "No se pudo guardar el voucher de uno de los pagos. Intenta nuevamente.",
        };
      }
    }
  }

  const installmentPayments = installmentPaymentMethods.flatMap((methodsForInstallment, index) =>
    methodsForInstallment
      .map((method, row) => {
        if (!method) return null;
        const savedReceiptForRow = savedInstallmentReceipts[index]?.[row];
        return {
          installmentNumber: index + 1,
          amount: centsToDecimalString(installmentPaymentAmountCents[index][row]!),
          paymentDate: saleDate,
          method,
          notes: installmentPaymentNotesValues[index][row],
          receivedByName: installmentPaymentReceivedByNames[index][row],
          bankAccountId: installmentPaymentBankAccountIds[index]?.[row],
          registeredById: user.id,
          receipt: savedReceiptForRow
            ? {
                fileUrl: savedReceiptForRow.fileUrl,
                fileName: savedReceiptForRow.fileName,
                fileType: savedReceiptForRow.fileType,
                uploadedById: user.id,
              }
            : undefined,
        };
      })
      .filter((payment): payment is NonNullable<typeof payment> => payment !== null),
  );

  try {
    // Sale + Installments (+ SaleReceipt, only when a sale-level receipt
    // was actually provided) (+ one Payment/PaymentReceipt per cuota that
    // already had a forma de pago selected) are created together in one
    // Prisma transaction (see sale-repository.createSaleWithInstallments)
    // -- a sale can never exist without its installments, or with a
    // partially-created receipt, and it can never report success while
    // "missing" a cuota payment it was asked to record.
    const sale = await saleRepository.createSaleWithInstallments({
      customerId: customer.id,
      sellerId,
      productId: product.id,
      saleDate,
      originalPrice: centsToDecimalString(originalPriceCents),
      discount: centsToDecimalString(discountCents),
      finalPrice: centsToDecimalString(finalPriceCents),
      installments,
      receipt: savedReceipt
        ? {
            fileUrl: savedReceipt.fileUrl,
            fileName: savedReceipt.fileName,
            fileType: savedReceipt.fileType,
            uploadedById: user.id,
          }
        : undefined,
      installmentPayments,
    });
    return { ok: true, id: sale.id };
  } catch (error) {
    console.error("[sales] Failed to create sale:", error);
    if (savedReceipt) await deleteReceiptFile(savedReceipt.fileUrl, "sale");
    for (const rowReceipts of savedInstallmentReceipts) {
      for (const saved of rowReceipts) {
        if (saved) await deleteReceiptFile(saved.fileUrl, "payment");
      }
    }
    return { ok: false, formError: "No se pudo crear la venta. Intenta nuevamente." };
  }
}

// ---------------------------------------------------------------------
// Exportar ventas a Excel: ADMIN/ACCOUNTANT only -- a SELLER can already
// see their own sales in the Ventas listing, but the accounting export
// (with paid/pending totals) is reserved for the roles that actually
// reconcile that data, mirroring the /cuentas-bancarias export.
// ---------------------------------------------------------------------

export type SaleExportRow = {
  id: string;
  saleDate: Date;
  customerName: string;
  productName: string;
  sellerName: string;
  finalPriceCents: number;
  // Sum of APPROVED payments only, across every installment of the sale --
  // the same figure payment-service.ts's computeInstallmentTotals uses
  // everywhere else, via the shared sumApprovedCents helper. A
  // PENDING_VALIDATION or REJECTED payment never counts as "pagado" here.
  paidCents: number;
  balanceCents: number;
  status: SaleStatus;
};

/**
 * Sale-level rows for the Ventas Excel export, decorated with real paid/
 * pending totals -- ADMIN/ACCOUNTANT only. Reuses the exact same
 * sellerId/product/status/date scoping as listSalesForUser (via
 * resolveSaleSellerScope) so the exported file always matches whatever the
 * caller could already see on the Ventas listing page.
 */
export async function listSalesForExportForUser(
  user: PublicUser,
  filters: {
    search?: string;
    productId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    sellerId?: string;
  },
): Promise<SaleExportRow[]> {
  if (user.role !== UserRole.ADMIN && user.role !== UserRole.ACCOUNTANT) {
    return [];
  }

  const sellerId = resolveSaleSellerScope(user, filters);
  const status = isValidSaleStatus(filters.status) ? filters.status : undefined;
  const dateFrom = filters.dateFrom ? (parseDateOnly(filters.dateFrom) ?? undefined) : undefined;
  const dateTo = filters.dateTo ? (parseDateOnly(filters.dateTo) ?? undefined) : undefined;

  const rows = await saleRepository.listSalesForExport({
    sellerId,
    search: filters.search,
    productId: filters.productId && isValidUuid(filters.productId) ? filters.productId : undefined,
    status,
    dateFrom,
    dateTo,
  });

  return rows.map((sale) => {
    const finalPriceCents = toCents(Number(sale.finalPrice));
    const paidCents = sumApprovedCents(sale.installments.flatMap((installment) => installment.payments));
    return {
      id: sale.id,
      saleDate: sale.saleDate,
      customerName: sale.customer.fullName,
      productName: sale.product.name,
      sellerName: sale.seller.name,
      finalPriceCents,
      paidCents,
      balanceCents: finalPriceCents - paidCents,
      status: sale.status,
    };
  });
}
