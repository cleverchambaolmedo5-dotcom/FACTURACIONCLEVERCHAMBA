import "server-only";
import { UserRole, InvestmentStatus } from "@/generated/prisma/enums";
import type { PublicUser } from "@/lib/auth/session";
import { isValidUuid } from "@/lib/validation";
import * as investmentRepository from "@/server/repositories/investment-repository";
import * as customerRepository from "@/server/repositories/customer-repository";
import * as customerService from "@/server/services/customer-service";
import type { CustomerActionResult, RawCustomerInput } from "@/server/services/customer-service";
import {
  MAX_RECEIPT_BYTES,
  deleteReceiptFile,
  saveReceiptFile,
  validateReceiptFile,
} from "@/server/services/receipt-storage";

// All Investment permission logic lives here, not in pages/components/
// actions. Every function takes the authenticated `user` and enforces:
//   1. What the user is allowed to see -- row-level scoping for SELLER
//      (only their own investments), AND field-level scoping (SELLER never
//      receives principalAmount/annualRate, in either the list or the
//      detail view -- see the "SellerView" repository queries this layer
//      calls, which never SELECT those columns in the first place).
//   2. What the user is allowed to write (sellerId/annualRate rules,
//      ACCOUNTANT can't create at all).
//   3. Minimum amount, date derivation, mandatory receipt.
// Callers (Server Actions, pages) must still call requireModuleAccess()
// themselves first -- this layer assumes module-level access already
// passed and only handles record-level/field-level rules.

export const MINIMUM_PRINCIPAL_AMOUNT = 2000;
const MINIMUM_PRINCIPAL_CENTS = MINIMUM_PRINCIPAL_AMOUNT * 100;
const DEFAULT_ANNUAL_RATE = "13.00";
// Sanity bounds for an ADMIN-overridden rate -- generous enough to never
// block a legitimate "caso especial", but rejects obvious data-entry
// mistakes (e.g. a stray extra digit).
const MIN_ANNUAL_RATE = 0.01;
const MAX_ANNUAL_RATE = 100;

export type InvestmentFieldErrors = Partial<
  Record<"customerId" | "startDate" | "principalAmount" | "annualRate" | "sellerId" | "receipt" | "contract", string>
>;

export type InvestmentActionResult =
  | { ok: true; id: string }
  | { ok: false; errors?: InvestmentFieldErrors; formError?: string };

export type RawInvestmentInput = {
  customerId?: FormDataEntryValue | null;
  startDate?: FormDataEntryValue | null;
  principalAmount?: FormDataEntryValue | null;
  // Only ever read for ADMIN -- ignored entirely for SELLER, which always
  // gets DEFAULT_ANNUAL_RATE regardless of what (if anything) was submitted.
  annualRate?: FormDataEntryValue | null;
  sellerId?: FormDataEntryValue | null;
  // Mandatory -- an Investment can never be created without a receipt.
  receipt?: FormDataEntryValue | null;
  // Optional signed contract.
  contract?: FormDataEntryValue | null;
};

function str(value: FormDataEntryValue | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Parses a "YYYY-MM-DD" <input type="date"> value as UTC midnight -- never through the local timezone, so the calendar day can't shift. */
function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Adds `years` calendar years to `date` using UTC field arithmetic (never
 * local time, matching parseDateOnly). Feb 29 on a leap-year start date
 * that lands on a non-leap year rolls over to Mar 1 -- the standard
 * JS Date behavior -- rather than throwing or silently truncating.
 */
function addYearsUTC(date: Date, years: number): Date {
  const result = new Date(date.getTime());
  result.setUTCFullYear(result.getUTCFullYear() + years);
  return result;
}

function toCents(amount: number): number {
  return Math.round(amount * 100);
}

function centsToDecimalString(cents: number): string {
  return (cents / 100).toFixed(2);
}

function isValidInvestmentStatus(value: string | undefined): value is InvestmentStatus {
  return !!value && (Object.values(InvestmentStatus) as string[]).includes(value);
}

// =========================================================================
// Reading
// =========================================================================

export type InvestmentListResult =
  | { view: "financial"; items: investmentRepository.InvestmentListItem[] }
  | { view: "seller"; items: investmentRepository.InvestmentSellerListItem[] };

/**
 * SELLER sees only their own investments, through a query that never
 * selects financial columns in the first place (see
 * investmentRepository.listInvestmentsForSeller). ADMIN/ACCOUNTANT see all
 * investments with full financial data.
 */
export async function listInvestmentsForUser(
  user: PublicUser,
  filters: { search?: string; status?: string; dateFrom?: string; dateTo?: string },
): Promise<InvestmentListResult> {
  const status = isValidInvestmentStatus(filters.status) ? filters.status : undefined;
  const dateFrom = filters.dateFrom ? (parseDateOnly(filters.dateFrom) ?? undefined) : undefined;
  const dateTo = filters.dateTo ? (parseDateOnly(filters.dateTo) ?? undefined) : undefined;

  if (user.role === UserRole.SELLER) {
    const items = await investmentRepository.listInvestmentsForSeller(user.id, {
      search: filters.search,
      status,
      dateFrom,
      dateTo,
    });
    return { view: "seller", items };
  }

  const items = await investmentRepository.listInvestments({
    search: filters.search,
    status,
    dateFrom,
    dateTo,
  });
  return { view: "financial", items };
}

export type InvestmentDetailResult =
  | { view: "financial"; investment: NonNullable<investmentRepository.InvestmentDetail> }
  | { view: "seller"; investment: NonNullable<investmentRepository.InvestmentSellerDetail> };

/**
 * Fetches one investment, enforcing both record-level ownership AND
 * field-level financial restriction for SELLER in a single step: the
 * "SellerView" repository query is scoped to `sellerId` at the database
 * level and never selects principalAmount/annualRate/etc, so there's no
 * intermediate object holding financial data that this layer would then
 * need to remember to strip. A SELLER requesting a foreign investment id
 * and one that doesn't exist both resolve to `null` -- indistinguishable,
 * so a SELLER can't use this to probe for other sellers' investment ids
 * (the page renders both as a 404, matching Ventas/Clientes).
 */
export async function getInvestmentForUser(
  user: PublicUser,
  id: string,
): Promise<InvestmentDetailResult | null> {
  if (!isValidUuid(id)) {
    return null;
  }

  if (user.role === UserRole.SELLER) {
    const investment = await investmentRepository.findInvestmentForSeller(id, user.id);
    if (!investment) return null;
    return { view: "seller", investment };
  }

  const investment = await investmentRepository.findInvestmentById(id);
  if (!investment) return null;
  return { view: "financial", investment };
}

/** ADMIN-only: the SELLER options for the "vendedor" selector and the quick-create customer modal. */
export function listSellersForInvestmentForm() {
  return customerRepository.listActiveSellers();
}

/**
 * Customer search for the investment form's customer selector, mirroring
 * searchCustomersForSaleForm: a SELLER only ever gets their own assigned
 * customers back. ACCOUNTANT can't create investments, so it never gets
 * results either.
 */
export async function searchCustomersForInvestmentForm(user: PublicUser, query: string) {
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
 * Creates a customer from the "Nueva inversión" screen's quick-create
 * modal. Delegates all field validation and assignedSellerId resolution to
 * the existing Clientes module logic (customer-service.createCustomerForUser)
 * -- this only adds the one rule specific to this entry point: ACCOUNTANT
 * can't create investments, so it can't use this shortcut either.
 */
export async function createCustomerForInvestmentForm(
  user: PublicUser,
  raw: RawCustomerInput,
): Promise<CustomerActionResult> {
  if (user.role === UserRole.ACCOUNTANT) {
    return { ok: false, formError: "No tienes permiso para crear inversiones." };
  }

  return customerService.createCustomerForUser(user, raw);
}

// =========================================================================
// Writing
// =========================================================================

export async function createInvestmentForUser(
  user: PublicUser,
  raw: RawInvestmentInput,
): Promise<InvestmentActionResult> {
  // ACCOUNTANT can view/validate investments but never create them --
  // same split of responsibilities as ACCOUNTANT + Ventas.
  if (user.role === UserRole.ACCOUNTANT) {
    return { ok: false, formError: "No tienes permiso para crear inversiones." };
  }

  const errors: InvestmentFieldErrors = {};

  // --- Customer: SELLER can only register investments for their own
  // assigned customers. A customer that doesn't exist and one that exists
  // but belongs to another seller must produce the exact same error, so a
  // SELLER can't use this form to probe for other sellers' customer ids.
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

  // --- Start date: required, parsed as a plain calendar date (UTC
  // midnight). firstReturnDate/maturityDate are always derived from this,
  // never accepted from the client.
  const startDateRaw = str(raw.startDate);
  const startDate = startDateRaw ? parseDateOnly(startDateRaw) : null;
  if (!startDate) {
    errors.startDate = "La fecha de inicio es obligatoria.";
  }

  // --- Principal amount: required, server-enforced minimum of
  // MINIMUM_PRINCIPAL_AMOUNT (USD 2,000). Computed in cents so rounding
  // never loses or invents a cent, same convention as sale-service.
  const principalRaw = str(raw.principalAmount);
  const principalValue = Number(principalRaw);
  let principalCents = 0;
  if (!principalRaw || !Number.isFinite(principalValue) || principalValue <= 0) {
    errors.principalAmount = "Ingresa un monto válido.";
  } else {
    principalCents = toCents(principalValue);
    if (principalCents < MINIMUM_PRINCIPAL_CENTS) {
      errors.principalAmount = `El monto mínimo de inversión es de $${MINIMUM_PRINCIPAL_AMOUNT.toLocaleString("en-US")}.`;
    }
  }

  // --- Annual rate: SELLER never sees or edits this field -- whatever
  // (if anything) was submitted is ignored, and the company default
  // applies. ADMIN may override it; blank falls back to the default too.
  let annualRate = DEFAULT_ANNUAL_RATE;
  if (user.role === UserRole.ADMIN) {
    const rateRaw = str(raw.annualRate);
    if (rateRaw) {
      const rateValue = Number(rateRaw);
      if (!Number.isFinite(rateValue) || rateValue < MIN_ANNUAL_RATE || rateValue > MAX_ANNUAL_RATE) {
        errors.annualRate = `Ingresa una tasa entre ${MIN_ANNUAL_RATE}% y ${MAX_ANNUAL_RATE}%.`;
      } else {
        annualRate = rateValue.toFixed(2);
      }
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

  // --- Receipt: mandatory. An empty file input still arrives as a
  // zero-byte File with an empty name -- treat that as "no file selected"
  // and reject it, the same as a missing field entirely. Type/extension/
  // size are always re-checked here, server-side.
  const receiptFile = raw.receipt instanceof File && raw.receipt.size > 0 ? raw.receipt : null;
  if (!receiptFile) {
    errors.receipt = "Debes adjuntar el comprobante de ingreso del dinero.";
  } else {
    const validationError = validateReceiptFile(receiptFile);
    if (validationError === "type") {
      errors.receipt = "Solo se permiten archivos PDF, JPG, JPEG, PNG o WEBP.";
    } else if (validationError === "size") {
      errors.receipt = `El comprobante no debe superar ${Math.floor(MAX_RECEIPT_BYTES / (1024 * 1024))} MB.`;
    }
  }

  // --- Contract: optional. Only validated if a real file was attached.
  const contractFile = raw.contract instanceof File && raw.contract.size > 0 ? raw.contract : null;
  if (contractFile) {
    const validationError = validateReceiptFile(contractFile);
    if (validationError === "type") {
      errors.contract = "Solo se permiten archivos PDF, JPG, JPEG, PNG o WEBP.";
    } else if (validationError === "size") {
      errors.contract = `El contrato no debe superar ${Math.floor(MAX_RECEIPT_BYTES / (1024 * 1024))} MB.`;
    }
  }

  if (
    Object.keys(errors).length > 0 ||
    !customer ||
    !startDate ||
    !sellerId ||
    !receiptFile
  ) {
    return { ok: false, errors };
  }

  const firstReturnDate = addYearsUTC(startDate, 1);
  const maturityDate = addYearsUTC(startDate, 2);

  // Files are written to disk once, before the investment is created --
  // on any failure below they're deleted again so a failed registration
  // never leaves an orphaned file with no Investment row.
  let savedReceipt: Awaited<ReturnType<typeof saveReceiptFile>>;
  try {
    savedReceipt = await saveReceiptFile(receiptFile, "investment");
  } catch (error) {
    console.error("[investments] Failed to save receipt file:", error);
    return { ok: false, formError: "No se pudo guardar el comprobante. Intenta nuevamente." };
  }

  let savedContract: Awaited<ReturnType<typeof saveReceiptFile>> | null = null;
  if (contractFile) {
    try {
      savedContract = await saveReceiptFile(contractFile, "investment-contract");
    } catch (error) {
      console.error("[investments] Failed to save contract file:", error);
      await deleteReceiptFile(savedReceipt.fileUrl, "investment");
      return { ok: false, formError: "No se pudo guardar el contrato. Intenta nuevamente." };
    }
  }

  try {
    const investment = await investmentRepository.createInvestmentWithReceipt({
      customerId: customer.id,
      sellerId,
      principalAmount: centsToDecimalString(principalCents),
      annualRate,
      startDate,
      firstReturnDate,
      maturityDate,
      receipt: {
        fileUrl: savedReceipt.fileUrl,
        fileName: savedReceipt.fileName,
        fileType: savedReceipt.fileType,
        uploadedById: user.id,
      },
      ...(savedContract
        ? {
            contract: {
              fileUrl: savedContract.fileUrl,
              fileName: savedContract.fileName,
              fileType: savedContract.fileType,
              uploadedById: user.id,
            },
          }
        : {}),
    });
    return { ok: true, id: investment.id };
  } catch (error) {
    console.error("[investments] Failed to create investment:", error);
    await deleteReceiptFile(savedReceipt.fileUrl, "investment");
    if (savedContract) {
      await deleteReceiptFile(savedContract.fileUrl, "investment-contract");
    }
    return { ok: false, formError: "No se pudo crear la inversión. Intenta nuevamente." };
  }
}

// =========================================================================
// Validation (approve / reject)
// =========================================================================

export type InvestmentValidationResult = { ok: true } | { ok: false; formError: string };

/** Approves a PENDING_VALIDATION investment -- ADMIN/ACCOUNTANT only. */
export async function approveInvestmentForUser(
  user: PublicUser,
  investmentId: string,
): Promise<InvestmentValidationResult> {
  if (user.role !== UserRole.ADMIN && user.role !== UserRole.ACCOUNTANT) {
    return { ok: false, formError: "No tienes permiso para aprobar inversiones." };
  }
  if (!isValidUuid(investmentId)) {
    return { ok: false, formError: "La inversión indicada no es válida." };
  }

  const approved = await investmentRepository.approveInvestment(investmentId, user.id);
  if (!approved) {
    return { ok: false, formError: "Esta inversión ya fue validada o no existe." };
  }
  return { ok: true };
}

export type InvestmentRejectionResult =
  | { ok: true }
  | { ok: false; formError?: string; errors?: { reason?: string } };

/** Rejects a PENDING_VALIDATION investment -- ADMIN/ACCOUNTANT only. A rejection reason is mandatory. */
export async function rejectInvestmentForUser(
  user: PublicUser,
  investmentId: string,
  reasonRaw: FormDataEntryValue | null | undefined,
): Promise<InvestmentRejectionResult> {
  if (user.role !== UserRole.ADMIN && user.role !== UserRole.ACCOUNTANT) {
    return { ok: false, formError: "No tienes permiso para rechazar inversiones." };
  }
  if (!isValidUuid(investmentId)) {
    return { ok: false, formError: "La inversión indicada no es válida." };
  }

  const reason = str(reasonRaw);
  if (!reason) {
    return { ok: false, errors: { reason: "El motivo del rechazo es obligatorio." } };
  }

  const rejected = await investmentRepository.rejectInvestment(investmentId, user.id, reason);
  if (!rejected) {
    return { ok: false, formError: "Esta inversión ya fue validada o no existe." };
  }
  return { ok: true };
}

// =========================================================================
// Early cancellation (ADMIN only)
// =========================================================================

export type InvestmentCancellationResult =
  | { ok: true }
  | { ok: false; formError?: string; errors?: { reason?: string; cancelledAt?: string } };

/**
 * Records an early administrative cancellation of an ACTIVE investment.
 * This phase only records the decision (status, reason, date, responsible
 * user) -- it does not compute or move any settlement amount, which is a
 * later phase.
 */
export async function cancelInvestmentForUser(
  user: PublicUser,
  investmentId: string,
  reasonRaw: FormDataEntryValue | null | undefined,
  cancelledAtRaw: FormDataEntryValue | null | undefined,
): Promise<InvestmentCancellationResult> {
  if (user.role !== UserRole.ADMIN) {
    return { ok: false, formError: "Solo un administrador puede cancelar una inversión." };
  }
  if (!isValidUuid(investmentId)) {
    return { ok: false, formError: "La inversión indicada no es válida." };
  }

  const reason = str(reasonRaw);
  const errors: { reason?: string; cancelledAt?: string } = {};
  if (!reason) {
    errors.reason = "El motivo de la cancelación es obligatorio.";
  }

  const cancelledAtValue = str(cancelledAtRaw);
  const cancelledAt = cancelledAtValue ? parseDateOnly(cancelledAtValue) : null;
  if (!cancelledAt) {
    errors.cancelledAt = "La fecha de cancelación es obligatoria.";
  }

  const existing = await investmentRepository.findInvestmentStatus(investmentId);
  if (!existing) {
    return { ok: false, formError: "La inversión indicada no existe." };
  }
  if (cancelledAt && cancelledAt.getTime() < existing.startDate.getTime()) {
    errors.cancelledAt = "La fecha no puede ser anterior al inicio de la inversión.";
  }

  if (Object.keys(errors).length > 0 || !cancelledAt) {
    return { ok: false, errors };
  }

  const cancelled = await investmentRepository.cancelInvestment(investmentId, user.id, reason, cancelledAt);
  if (!cancelled) {
    return { ok: false, formError: "Solo una inversión activa puede cancelarse." };
  }
  return { ok: true };
}
