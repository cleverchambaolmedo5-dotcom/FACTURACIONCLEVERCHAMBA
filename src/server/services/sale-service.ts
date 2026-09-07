import "server-only";
import { UserRole, SaleStatus, PaymentMethod } from "@/generated/prisma/enums";
import type { PublicUser } from "@/lib/auth/session";
import { isValidUuid } from "@/lib/validation";
import * as saleRepository from "@/server/repositories/sale-repository";
import * as customerRepository from "@/server/repositories/customer-repository";
import * as bankAccountRepository from "@/server/repositories/bank-account-repository";
import * as customerService from "@/server/services/customer-service";
import type { CustomerActionResult, RawCustomerInput } from "@/server/services/customer-service";
import { sumApprovedCents } from "@/server/services/payment-service";
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
    | "bankAccountId"
    // Aggregate mismatch between the sum of installment amounts and the
    // sale's final price -- not tied to any single cuota, hence a flat
    // message rather than a per-index array like installmentAmounts below.
    | "installmentsTotal"
    // Only populated when registerInitialPayment is checked -- see
    // createSaleForUser's initial-payment block below.
    | "initialPaymentAmount"
    | "initialPaymentDate"
    | "initialPaymentMethod"
    | "initialPaymentReceipt",
    string
  >
> & {
  // One entry per installment (aligned by index), rather than a single
  // flat message -- the form needs to point at exactly which cuota's
  // date is invalid.
  installmentDates?: (string | undefined)[];
  // Same per-index shape as installmentDates, for each cuota's manually
  // entered amount.
  installmentAmounts?: (string | undefined)[];
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
  // The bank account the customer is expected to pay into. Required for
  // every new sale -- see the validation in createSaleForUser below.
  bankAccountId?: FormDataEntryValue | null;
  // One value per installment, in installment order (e.g. FormData's
  // getAll("installmentDueDates")).
  installmentDueDates?: FormDataEntryValue[];
  // One manually-entered monetary amount per installment, in installment
  // order (e.g. FormData's getAll("installmentAmounts")). Replaces the
  // old server-computed even split -- see the validation below.
  installmentAmounts?: FormDataEntryValue[];
  // Mandatory -- a Sale can never be created without a receipt attached,
  // see the validation in createSaleForUser below.
  receipt?: FormDataEntryValue | null;
  // --- Initial payment (optional): present only when the customer already
  // paid installment #1 at the moment the sale is registered. Checkbox
  // value is the literal string "on" when checked, absent otherwise --
  // every field below is only validated/required when it is.
  registerInitialPayment?: FormDataEntryValue | null;
  initialPaymentAmount?: FormDataEntryValue | null;
  initialPaymentDate?: FormDataEntryValue | null;
  initialPaymentMethod?: FormDataEntryValue | null;
  initialPaymentReference?: FormDataEntryValue | null;
  initialPaymentNotes?: FormDataEntryValue | null;
  initialPaymentReceipt?: FormDataEntryValue | null;
};

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

/** SELLER sees only their own sales; ADMIN/ACCOUNTANT see all (optionally narrowed to one seller via `filters.sellerId`). */
export function listSalesForUser(
  user: PublicUser,
  filters: {
    search?: string;
    productId?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    sellerId?: string;
  },
) {
  const sellerId = resolveSaleSellerScope(user, filters);
  const status = isValidSaleStatus(filters.status) ? filters.status : undefined;
  const dateFrom = filters.dateFrom ? (parseDateOnly(filters.dateFrom) ?? undefined) : undefined;
  const dateTo = filters.dateTo ? (parseDateOnly(filters.dateTo) ?? undefined) : undefined;

  return saleRepository.listSales({
    sellerId,
    search: filters.search,
    productId: filters.productId && isValidUuid(filters.productId) ? filters.productId : undefined,
    status,
    dateFrom,
    dateTo,
  });
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
 * Active bank accounts, for the sale form's "cuenta bancaria de destino"
 * selector. Available to every role that can reach the sale form (ADMIN,
 * SELLER) -- unlike the /cuentas-bancarias module itself (ADMIN/ACCOUNTANT
 * only, see rbac.ts), a SELLER must be able to pick a destination account
 * when creating a sale without gaining any other access to that module
 * (they still can't view/manage accounts there).
 */
export function listBankAccountsForSaleForm() {
  return bankAccountRepository.listActiveBankAccounts();
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

  // --- Bank account: the sale's payment destination. Must exist and be
  // active, recomputed here from the database -- never trusted from the
  // client. Saved on the sale but never used to touch any balance here;
  // the balance only ever moves once a payment against this sale is
  // approved (see payment-service.ts#approvePaymentForUser).
  const bankAccountId = str(raw.bankAccountId);
  let bankAccount: Awaited<ReturnType<typeof bankAccountRepository.findActiveBankAccountById>> =
    null;
  if (!bankAccountId || !isValidUuid(bankAccountId)) {
    errors.bankAccountId = "Selecciona una cuenta bancaria válida.";
  } else {
    bankAccount = await bankAccountRepository.findActiveBankAccountById(bankAccountId);
    if (!bankAccount) {
      errors.bankAccountId = "Selecciona una cuenta bancaria activa válida.";
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

  // --- Installment amounts: one manually-entered amount per installment,
  // replacing the old server-computed even split. Each must be a valid,
  // non-negative monetary value; client-side totals are never trusted --
  // only re-validated and summed here. Their sum must land exactly on the
  // true finalPriceCents computed above from the database-backed product
  // price and discount (never the client's own displayed total), so every
  // downstream ledger figure that assumes installments == finalPrice
  // (e.g. dashboard-service.ts's collectedCents + pendingToCollectCents)
  // keeps holding.
  const installmentAmountCents: number[] = [];
  if (hasValidInstallmentsCount) {
    const amountErrors: (string | undefined)[] = [];
    const rawAmounts = (raw.installmentAmounts ?? []).map(str);

    for (let index = 0; index < installmentsCount; index += 1) {
      const rawAmount = rawAmounts[index] ?? "";
      const amountValue = Number(rawAmount);
      if (!rawAmount || !Number.isFinite(amountValue)) {
        amountErrors[index] = "El monto de la cuota es obligatorio.";
      } else if (amountValue <= 0) {
        amountErrors[index] = "El monto de la cuota debe ser mayor a cero.";
      } else {
        installmentAmountCents[index] = toCents(amountValue);
      }
    }

    if (amountErrors.some((message) => message !== undefined)) {
      errors.installmentAmounts = amountErrors;
    } else if (product && installmentAmountCents.length === installmentsCount) {
      const totalAmountCents = installmentAmountCents.reduce((sum, cents) => sum + cents, 0);
      const trueFinalPriceCents = originalPriceCents - discountCents;
      if (totalAmountCents > trueFinalPriceCents) {
        errors.installmentsTotal =
          "La suma de las cuotas no puede superar el precio final de la venta.";
      } else if (totalAmountCents < trueFinalPriceCents) {
        errors.installmentsTotal = "La suma de las cuotas debe ser igual al precio final de la venta.";
      }
    }
  }

  // --- Initial payment (optional): if the customer already paid
  // installment #1 at the moment the sale is registered, this block
  // validates that data exactly like registerPaymentForUser validates a
  // manually-registered payment (amount/date/method/receipt), plus one
  // extra rule specific to this entry point: the amount can never exceed
  // installment #1's own amount, since it can only ever pay that one
  // cuota. Entirely opt-in -- skipped whenever the checkbox isn't checked,
  // so existing sales with no initial payment are completely unaffected.
  const registerInitialPayment = str(raw.registerInitialPayment) === "on";
  let initialPaymentAmountCents = 0;
  let initialPaymentDate: Date | null = null;
  let initialPaymentMethod: PaymentMethod | null = null;
  let initialPaymentReceiptFile: File | null = null;

  if (registerInitialPayment) {
    const ipAmountRaw = str(raw.initialPaymentAmount);
    const ipAmountValue = Number(ipAmountRaw);
    if (!ipAmountRaw || !Number.isFinite(ipAmountValue)) {
      errors.initialPaymentAmount = "El monto pagado es obligatorio.";
    } else if (ipAmountValue <= 0) {
      errors.initialPaymentAmount = "El monto pagado debe ser mayor a cero.";
    } else {
      initialPaymentAmountCents = toCents(ipAmountValue);
      if (
        hasValidInstallmentsCount &&
        installmentAmountCents.length === installmentsCount &&
        !errors.installmentAmounts &&
        initialPaymentAmountCents > installmentAmountCents[0]
      ) {
        errors.initialPaymentAmount =
          "El monto pagado no puede superar el valor de la primera cuota.";
      }
    }

    const ipDateRaw = str(raw.initialPaymentDate);
    initialPaymentDate = ipDateRaw ? parseDateOnly(ipDateRaw) : null;
    if (!initialPaymentDate) {
      errors.initialPaymentDate = "La fecha del pago no es válida.";
    }

    const ipMethodRaw = str(raw.initialPaymentMethod);
    if (!ipMethodRaw || !isValidPaymentMethod(ipMethodRaw)) {
      errors.initialPaymentMethod = "Selecciona un método de pago válido.";
    } else {
      initialPaymentMethod = ipMethodRaw;
    }

    const ipReceipt =
      raw.initialPaymentReceipt instanceof File && raw.initialPaymentReceipt.size > 0
        ? raw.initialPaymentReceipt
        : null;
    if (!ipReceipt) {
      errors.initialPaymentReceipt = "Debes adjuntar un comprobante del pago inicial.";
    } else {
      const validationError = validateReceiptFile(ipReceipt);
      if (validationError === "type") {
        errors.initialPaymentReceipt = "Solo se permiten archivos PDF, JPG, JPEG, PNG o WEBP.";
      } else if (validationError === "size") {
        errors.initialPaymentReceipt = `El comprobante no debe superar ${Math.floor(MAX_RECEIPT_BYTES / (1024 * 1024))} MB.`;
      } else {
        initialPaymentReceiptFile = ipReceipt;
      }
    }
  }

  // --- Receipt: mandatory. An empty file input still arrives as a
  // zero-byte File with an empty name -- treat that as "no file selected"
  // and reject it, the same as a missing field entirely. This is the only
  // check that actually stops a Sale from being created without a
  // receipt -- the client-side "required" affordance is a UX hint, never
  // trusted. Type/extension/size are always re-checked here, server-side.
  const receiptFile = raw.receipt instanceof File && raw.receipt.size > 0 ? raw.receipt : null;
  if (!receiptFile) {
    errors.receipt = "Debes adjuntar un comprobante para registrar la venta.";
  } else {
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
    !bankAccount ||
    !saleDate ||
    !sellerId ||
    !hasValidInstallmentsCount ||
    installmentDueDates.length !== installmentsCount ||
    installmentAmountCents.length !== installmentsCount ||
    !receiptFile ||
    (registerInitialPayment &&
      (initialPaymentAmountCents <= 0 ||
        !initialPaymentDate ||
        !initialPaymentMethod ||
        !initialPaymentReceiptFile))
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
  // file with no Sale/SaleReceipt row.
  let savedReceipt: Awaited<ReturnType<typeof saveReceiptFile>>;
  try {
    savedReceipt = await saveReceiptFile(receiptFile, "sale");
  } catch (error) {
    console.error("[sales] Failed to save receipt file:", error);
    return { ok: false, formError: "No se pudo guardar el comprobante. Intenta nuevamente." };
  }

  // Same "save to disk once, up front" treatment as the sale's own receipt
  // above -- its content never depends on the sale/transaction outcome, and
  // on any failure below it's deleted again so a failed registration never
  // leaves an orphaned file with no Payment/PaymentReceipt row.
  let savedInitialPaymentReceipt: Awaited<ReturnType<typeof saveReceiptFile>> | null = null;
  if (registerInitialPayment && initialPaymentReceiptFile) {
    try {
      savedInitialPaymentReceipt = await saveReceiptFile(initialPaymentReceiptFile, "payment");
    } catch (error) {
      console.error("[sales] Failed to save initial payment receipt file:", error);
      await deleteReceiptFile(savedReceipt.fileUrl, "sale");
      return {
        ok: false,
        formError: "No se pudo guardar el comprobante del pago inicial. Intenta nuevamente.",
      };
    }
  }

  try {
    // Sale + Installments + SaleReceipt (+ the initial Payment/
    // PaymentReceipt against installment #1, if provided) are created
    // together in one Prisma transaction (see
    // sale-repository.createSaleWithInstallments) -- a sale can never exist
    // without its installments or its receipt, or vice versa, and it can
    // never report success while "missing" the initial payment it was
    // asked to record.
    const sale = await saleRepository.createSaleWithInstallments({
      customerId: customer.id,
      sellerId,
      productId: product.id,
      bankAccountId: bankAccount.id,
      saleDate,
      originalPrice: centsToDecimalString(originalPriceCents),
      discount: centsToDecimalString(discountCents),
      finalPrice: centsToDecimalString(finalPriceCents),
      installments,
      receipt: {
        fileUrl: savedReceipt.fileUrl,
        fileName: savedReceipt.fileName,
        fileType: savedReceipt.fileType,
        uploadedById: user.id,
      },
      initialPayment:
        registerInitialPayment && initialPaymentDate && initialPaymentMethod && savedInitialPaymentReceipt
          ? {
              amount: centsToDecimalString(initialPaymentAmountCents),
              paymentDate: initialPaymentDate,
              method: initialPaymentMethod,
              reference: str(raw.initialPaymentReference) || undefined,
              notes: str(raw.initialPaymentNotes) || undefined,
              registeredById: user.id,
              receipt: {
                fileUrl: savedInitialPaymentReceipt.fileUrl,
                fileName: savedInitialPaymentReceipt.fileName,
                fileType: savedInitialPaymentReceipt.fileType,
                uploadedById: user.id,
              },
            }
          : undefined,
    });
    return { ok: true, id: sale.id };
  } catch (error) {
    console.error("[sales] Failed to create sale:", error);
    await deleteReceiptFile(savedReceipt.fileUrl, "sale");
    if (savedInitialPaymentReceipt) {
      await deleteReceiptFile(savedInitialPaymentReceipt.fileUrl, "payment");
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
