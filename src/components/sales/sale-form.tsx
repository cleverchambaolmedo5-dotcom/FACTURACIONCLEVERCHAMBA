"use client";

import { useActionState, useMemo, useRef, useState, type FormEvent } from "react";
import { PaymentMethod, UserRole } from "@/generated/prisma/enums";
import type { SaleFormState } from "@/app/(app)/ventas/actions";
import { StatusBadge } from "@/components/ui/status-badge";
import { CustomerSelector, type CustomerSearchResult } from "./customer-selector";
import type { NewCustomerAction } from "./customer-create-modal";

// Mirrors payment-form.tsx's own METHOD_LABELS -- duplicated rather than
// shared since these are two separate client components in different
// modules, same pattern as the small server-side helpers duplicated
// between sale-service.ts and payment-service.ts.
const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  BANK_TRANSFER: "Transferencia",
  DEPOSIT: "Depósito",
  CARD: "Tarjeta",
  OTHER: "Otro",
};

// The only forma-de-pago options selectable per cuota (plus "Mixto", a
// client-only combination of two or more of these) -- OTHER stays a valid
// PaymentMethod value elsewhere (e.g. a manually-registered payment via
// payment-form.tsx) but is intentionally not offered here.
const PAYMENT_METHODS = [
  PaymentMethod.CASH,
  PaymentMethod.BANK_TRANSFER,
  PaymentMethod.DEPOSIT,
  PaymentMethod.CARD,
] as const;

// Client-only sentinel for the "Mixto" forma de pago -- never submitted as
// a PaymentMethod itself. When selected, each checked method in
// CuotaPaymentState.mixedMethods becomes its own Payment row underneath,
// using the exact same indexed fields (installmentPaymentMethod-<i>-<row>,
// etc.) the server already reads for "several payments per cuota" -- see
// sale-service.ts#createSaleForUser. Mixto is purely a friendlier way to
// fill those same rows, not a new server concept.
const MIXED = "MIXED" as const;

// A cuota can have at most one row per base method (Efectivo, Transferencia,
// Depósito, Tarjeta) -- well within the MAX_PAYMENTS_PER_INSTALLMENT (5)
// that sale-service.ts and ventas/actions.ts both bound their indexed
// field-reading to, so every Mixto combination always fits.

// Business rule: no more than 3 cuotas per sale (matches
// sale-service.ts's ALLOWED_INSTALLMENT_COUNTS).
const MAX_INSTALLMENTS = 3;

// Options for the "Número de cuotas" selector -- mirrors
// sale-service.ts's ALLOWED_INSTALLMENT_COUNTS exactly (1 through
// MAX_INSTALLMENTS), so the selector can never offer a value the server
// would reject.
const INSTALLMENT_COUNT_OPTIONS = Array.from({ length: MAX_INSTALLMENTS }, (_, i) => i + 1);

export type SaleFormAction = (
  state: SaleFormState,
  formData: FormData,
) => Promise<SaleFormState>;

export type SaleFormProduct = { id: string; name: string; officialPrice: number };
export type SaleFormSeller = { id: string; name: string };
export type SaleFormBankAccount = {
  id: string;
  bankName: string;
  alias: string;
  accountHolder: string;
  accountNumber: string;
};

// Only ever used to pre-fill the due date inputs with a reasonable
// starting point -- every date remains fully editable, and the server
// validates whatever is actually submitted rather than recomputing these.
const INSTALLMENT_OFFSET_DAYS = [0, 30, 60] as const;

const currencyFormatter = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

function fieldClass(hasError: boolean) {
  return `w-full rounded-md border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:ring-1 ${
    hasError
      ? "border-error focus:border-error focus:ring-error"
      : "border-border focus:border-primary focus:ring-primary"
  }`;
}

function toCents(amount: number): number {
  return Math.round(amount * 100);
}

function centsToAmountInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Splits `totalCents` into `count` shares that sum exactly back to
 * `totalCents` -- the first `count - 1` get the floor share, the last
 * absorbs the rounding remainder. Used both for the very first cuota-1
 * suggestion and to preview cuotas 2/3 (a plain remaining-balance split) --
 * the server (sale-service.ts's distributeCentsEvenly) recomputes the exact
 * same thing from the submitted amount, so this is purely a live preview,
 * never trusted on its own.
 */
function distributeCentsPreview(totalCents: number, count: number): number[] {
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  const amounts = Array<number>(count).fill(base);
  amounts[count - 1] += remainder;
  return amounts;
}

/** Masks everything but the last 4 characters (e.g. "••••••1234") -- mirrors bank-account-table.tsx's maskAccountNumber, so a SELLER never sees a full account number in this selector either. */
function maskAccountNumber(accountNumber: string): string {
  const visible = accountNumber.slice(-4);
  const hiddenLength = accountNumber.length - visible.length;
  if (hiddenLength <= 0) return accountNumber;
  return "•".repeat(hiddenLength) + visible;
}

/** Adds `days` to a "YYYY-MM-DD" date-input value using UTC calendar arithmetic, returning the same format. */
function addDaysToDateInput(base: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(base);
  if (!match) return "";
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** `fill` receives the new element's index (not just the final length) so a direct jump (e.g. 1 -> 3 cuotas via the "Número de cuotas" selector) fills each new slot correctly, not just a single-step +1. */
function resizeArray<T>(previous: T[], count: number, fill: (index: number) => T): T[] {
  const next = previous.slice(0, count);
  while (next.length < count) next.push(fill(next.length));
  return next;
}

/** Returns a shallow copy of `record` with `key` removed -- used when unchecking a Mixto method to drop its draft/error entry entirely. */
function omitKey<T>(record: Partial<Record<PaymentMethod, T>>, key: PaymentMethod): Partial<Record<PaymentMethod, T>> {
  const next = { ...record };
  delete next[key];
  return next;
}

// CUOTA = the agreed amount the customer owes for that installment.
// PAGO = money the customer has actually handed over against one cuota.
// A cuota's forma de pago is either a single method, or "Mixto" -- an
// explicit combination of two or more methods the seller checks off, each
// becoming its own Payment row (MethodDraft) underneath. `drafts` only ever
// holds entries for methods that are actually active (the selected single
// method, or the currently-checked mixedMethods) so switching forma de pago
// never leaves stale data from a previously-selected method behind.
type MethodDraft = { amount: string; receivedByName: string; notes: string; bankAccountId: string };
type MethodFieldErrors = { receivedByName: string | null; receipt: string | null; bankAccountId: string | null };

/** Every forma-de-pago except CASH lands in a specific bank account -- BANK_TRANSFER/DEPOSIT let the seller pick one, CARD always uses the fixed account below (see isFixedBankAccountMethod). */
function methodRequiresBankAccount(method: PaymentMethod): boolean {
  return (
    method === PaymentMethod.BANK_TRANSFER ||
    method === PaymentMethod.DEPOSIT ||
    method === PaymentMethod.CARD
  );
}

/** CARD's destination account is never a seller choice -- it's always the one fixed account configured for card payments (see cardBankAccount below), rendered read-only instead of the BANK_TRANSFER/DEPOSIT selector. */
function isFixedBankAccountMethod(method: PaymentMethod): boolean {
  return method === PaymentMethod.CARD;
}
type CuotaPaymentState = {
  mode: "" | PaymentMethod | typeof MIXED;
  // Only meaningful while mode === MIXED. Kept in PAYMENT_METHODS order so
  // the blocks below the checkboxes render in a stable, predictable order.
  mixedMethods: PaymentMethod[];
  drafts: Partial<Record<PaymentMethod, MethodDraft>>;
  errors: Partial<Record<PaymentMethod, MethodFieldErrors>>;
};

function emptyCuotaPaymentState(): CuotaPaymentState {
  return { mode: "", mixedMethods: [], drafts: {}, errors: {} };
}

function emptyMethodDraft(): MethodDraft {
  return { amount: "", receivedByName: "", notes: "", bankAccountId: "" };
}

export function SaleForm({
  action,
  role,
  currentUserName,
  products,
  sellers,
  bankAccounts,
  cardBankAccount,
  defaultSaleDate,
  searchCustomersAction,
  createCustomerAction,
}: {
  action: SaleFormAction;
  role: UserRole;
  currentUserName: string;
  products: SaleFormProduct[];
  sellers: SaleFormSeller[];
  bankAccounts: SaleFormBankAccount[];
  // The one fixed BankAccount every CARD payment is credited to -- null
  // when CARD_PAYMENT_BANK_ACCOUNT_ID isn't configured, in which case a
  // seller can still pick "Tarjeta" but submission is blocked until an
  // admin configures it (see the CARD block in renderMethodBlock below).
  cardBankAccount: Pick<SaleFormBankAccount, "id" | "bankName" | "alias" | "accountNumber"> | null;
  defaultSaleDate: string;
  searchCustomersAction: (query: string) => Promise<CustomerSearchResult[]>;
  createCustomerAction: NewCustomerAction;
}) {
  const [state, formAction, pending] = useActionState<SaleFormState, FormData>(action, undefined);
  const errors = state && !state.ok ? state.errors : undefined;
  const formError = state && !state.ok ? state.formError : undefined;
  const canPickSeller = role !== UserRole.SELLER;

  // Client-side state only drives the live preview below -- the actual
  // originalPrice/finalPrice/dueDate/installment-amount values are always
  // recomputed and validated on the server from the submitted fields, never
  // trusted from here.
  const [productId, setProductId] = useState("");
  const [discount, setDiscount] = useState("0");
  const [saleDate, setSaleDate] = useState(defaultSaleDate);

  // --- Cuotas: the seller first decides how many cuotas the sale was
  // agreed in, via the "Número de cuotas" selector (1 to MAX_INSTALLMENTS).
  // Changing it resizes every per-cuota array below to match -- cuotas are
  // never created automatically just because a balance would be left
  // pending.
  const [installmentsCount, setInstallmentsCount] = useState<number>(1);
  const [dueDates, setDueDates] = useState<string[]>([defaultSaleDate]);
  // Tracks which due-date inputs the user has hand-edited, so changing
  // the sale date only refreshes still-default (untouched) cuotas.
  const [touched, setTouched] = useState<boolean[]>([false]);

  // --- Cuota amounts: only cuota 1's amount is ever entered by the seller
  // -- cuotas 2/3 are always the remaining balance split evenly (see
  // installmentAmountCentsPreview below), matching sale-service.ts's own
  // server-side computation exactly. `firstInstallmentTouched` mirrors the
  // old per-cuota "touched" pattern: while untouched, the field keeps
  // tracking an even-split suggestion as the product/discount/installments
  // change; once hand-edited it's left alone.
  const [firstInstallmentAmount, setFirstInstallmentAmount] = useState("0.00");
  const [firstInstallmentTouched, setFirstInstallmentTouched] = useState(false);
  const [firstInstallmentClientError, setFirstInstallmentClientError] = useState<string | null>(
    null,
  );

  // --- Forma de pago per cuota (CUOTA vs. PAGO vs. FORMA DE PAGO): each
  // cuota independently holds either nothing yet, one method, or a Mixto
  // combination -- see the "Forma de pago" section rendered per cuota
  // below. `mode === ""` means "no payment registered yet for this cuota",
  // the common case for a newly-added installment.
  const [cuotaPayments, setCuotaPayments] = useState<CuotaPaymentState[]>([emptyCuotaPaymentState()]);
  const paymentReceiptRefs = useRef<(HTMLInputElement | null)[][]>([[]]);

  // --- Pricing, derived from the selected product/discount -- declared
  // before any handler that closes over them (handleSubmit,
  // handleModeChange, ...) so their value is unambiguous at every read
  // site. The actual originalPrice/finalPrice are always recomputed and
  // validated on the server; these only drive the live preview.
  const selectedProduct = useMemo(
    () => products.find((product) => product.id === productId),
    [products, productId],
  );
  const originalPrice = selectedProduct?.officialPrice ?? 0;
  const discountValue = Number(discount) || 0;
  const finalPrice = Math.max(originalPrice - discountValue, 0);
  const finalPriceCents = Math.max(toCents(originalPrice) - toCents(discountValue), 0);

  /** The methods with an active payment block for a given cuota, in stable PAYMENT_METHODS order -- also the row order used for the indexed form fields. */
  function activeMethods(cuotaIndex: number): PaymentMethod[] {
    const cuota = cuotaPayments[cuotaIndex];
    if (!cuota || !cuota.mode) return [];
    return cuota.mode === MIXED ? cuota.mixedMethods : [cuota.mode];
  }

  function draftFor(cuotaIndex: number, method: PaymentMethod): MethodDraft {
    return cuotaPayments[cuotaIndex]?.drafts[method] ?? emptyMethodDraft();
  }

  /** CARD's draft always starts pre-filled with the fixed card account (never blank, since the seller never picks it); every other method starts with no account selected. */
  function defaultBankAccountIdFor(method: PaymentMethod): string {
    return isFixedBankAccountMethod(method) ? (cardBankAccount?.id ?? "") : "";
  }

  /** Default suggestion for cuota 1 while untouched: an even split across every cuota, mirroring the old all-cuotas-even-split starting point. */
  function defaultFirstInstallmentAmount(newFinalPriceCents: number, count: number): string {
    return centsToAmountInput(distributeCentsPreview(newFinalPriceCents, count)[0] ?? 0);
  }

  // --- Live preview of every cuota's amount: cuota 1 is whatever the
  // seller typed, cuotas 2+ are the remaining balance split evenly (last
  // one absorbing the rounding remainder) -- exactly mirrors
  // sale-service.ts's distributeCentsEvenly. Purely for display; the server
  // is the only source of truth.
  const installmentAmountCentsPreview = useMemo(() => {
    if (installmentsCount === 1) return [finalPriceCents];
    const firstCents = Math.max(toCents(Number(firstInstallmentAmount) || 0), 0);
    const remainderCents = Math.max(finalPriceCents - firstCents, 0);
    const shares = distributeCentsPreview(remainderCents, installmentsCount - 1);
    return [firstCents, ...shares];
  }, [installmentsCount, finalPriceCents, firstInstallmentAmount]);

  /** Sum of a cuota's currently-entered payment amounts across its active methods -- used only for the live "pagado/pendiente" preview. */
  function paidCentsForInstallment(installmentIndex: number): number {
    return activeMethods(installmentIndex).reduce(
      (sum, method) => sum + Math.max(toCents(Number(draftFor(installmentIndex, method).amount) || 0), 0),
      0,
    );
  }

  const installmentPaymentsExceedCuota = Array.from({ length: installmentsCount }, (_, i) => {
    const cuotaCents = installmentAmountCentsPreview[i] ?? 0;
    return paidCentsForInstallment(i) > cuotaCents;
  });

  const totalPaidCents = Array.from({ length: installmentsCount }, (_, i) => paidCentsForInstallment(i)).reduce(
    (sum, cents) => sum + cents,
    0,
  );
  const saleBalanceCents = Math.max(finalPriceCents - totalPaidCents, 0);

  const firstInstallmentError =
    errors?.firstInstallmentAmount ?? firstInstallmentClientError ?? undefined;

  function updateDraft(
    cuotaIndex: number,
    method: PaymentMethod,
    patch: Partial<MethodDraft>,
  ) {
    setCuotaPayments((previous) =>
      previous.map((cuota, i) =>
        i === cuotaIndex
          ? { ...cuota, drafts: { ...cuota.drafts, [method]: { ...draftFor(i, method), ...patch } } }
          : cuota,
      ),
    );
  }

  function clearMethodError(cuotaIndex: number, method: PaymentMethod, patch: Partial<MethodFieldErrors>) {
    setCuotaPayments((previous) =>
      previous.map((cuota, i) =>
        i === cuotaIndex
          ? {
              ...cuota,
              errors: {
                ...cuota.errors,
                [method]: { ...(cuota.errors[method] ?? { receivedByName: null, receipt: null }), ...patch },
              },
            }
          : cuota,
      ),
    );
  }

  /** Selecting a single forma de pago defaults its "Monto" to the full cuota amount, the same convenience the old per-payment selector offered. Choosing "Mixto" only switches the mode -- the seller then checks off which methods compose it. */
  function handleModeChange(cuotaIndex: number, value: string) {
    setCuotaPayments((previous) =>
      previous.map((cuota, i) => {
        if (i !== cuotaIndex) return cuota;
        if (value === MIXED) {
          return { mode: MIXED, mixedMethods: [], drafts: {}, errors: {} };
        }
        if (!value) {
          return emptyCuotaPaymentState();
        }
        const method = value as PaymentMethod;
        const cuotaCents = installmentAmountCentsPreview[cuotaIndex] ?? 0;
        return {
          mode: method,
          mixedMethods: [],
          drafts: {
            [method]: {
              ...emptyMethodDraft(),
              amount: centsToAmountInput(Math.max(cuotaCents, 0)),
              bankAccountId: defaultBankAccountIdFor(method),
            },
          },
          errors: {},
        };
      }),
    );
    paymentReceiptRefs.current[cuotaIndex] = [];
  }

  /** Checking a method under "Mixto" adds its block, defaulting its amount to whatever is still pending against the other checked methods; unchecking removes the block and its data entirely. */
  function toggleMixedMethod(cuotaIndex: number, method: PaymentMethod, checked: boolean) {
    setCuotaPayments((previous) =>
      previous.map((cuota, i) => {
        if (i !== cuotaIndex) return cuota;
        if (checked) {
          const alreadyCents = cuota.mixedMethods.reduce(
            (sum, m) => sum + Math.max(toCents(Number(cuota.drafts[m]?.amount) || 0), 0),
            0,
          );
          const cuotaCents = installmentAmountCentsPreview[cuotaIndex] ?? 0;
          const pendingCents = Math.max(cuotaCents - alreadyCents, 0);
          const nextMixedMethods = PAYMENT_METHODS.filter(
            (m) => m === method || cuota.mixedMethods.includes(m),
          );
          return {
            ...cuota,
            mixedMethods: nextMixedMethods,
            drafts: {
              ...cuota.drafts,
              [method]: cuota.drafts[method] ?? {
                ...emptyMethodDraft(),
                amount: centsToAmountInput(pendingCents),
                bankAccountId: defaultBankAccountIdFor(method),
              },
            },
          };
        }
        return {
          ...cuota,
          mixedMethods: cuota.mixedMethods.filter((m) => m !== method),
          drafts: omitKey(cuota.drafts, method),
          errors: omitKey(cuota.errors, method),
        };
      }),
    );
  }

  // Belt-and-suspenders: the actual, unbypassable rule lives in
  // createSaleForUser (server-side) -- this only blocks the obvious cases
  // (an invalid/missing cuota-1 amount, a payment missing its "Entregado
  // a"/voucher, a cuota's payments exceeding its own amount) without a
  // round trip. There is no sale-level receipt requirement in this flow --
  // each payment's own record (below) is what backs the sale.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    let hasBlockingError = false;

    if (installmentsCount > 1) {
      const firstCents = toCents(Number(firstInstallmentAmount) || 0);
      const remainingCount = installmentsCount - 1;
      const remainderCents = finalPriceCents - firstCents;
      if (firstCents <= 0) {
        setFirstInstallmentClientError("El monto de la primera cuota debe ser mayor a cero.");
        hasBlockingError = true;
      } else if (firstCents >= finalPriceCents) {
        setFirstInstallmentClientError(
          "El monto de la primera cuota debe ser menor al precio final de la venta.",
        );
        hasBlockingError = true;
      } else if (remainderCents < remainingCount) {
        setFirstInstallmentClientError(
          "El monto de la primera cuota deja un saldo insuficiente para repartir entre las demás cuotas.",
        );
        hasBlockingError = true;
      } else {
        setFirstInstallmentClientError(null);
      }
    } else {
      setFirstInstallmentClientError(null);
    }

    const nextCuotaPayments = cuotaPayments.map((cuota) => ({ ...cuota, errors: { ...cuota.errors } }));

    for (let i = 0; i < installmentsCount; i += 1) {
      const methods = activeMethods(i);
      methods.forEach((method, row) => {
        const draft = draftFor(i, method);
        if (method === PaymentMethod.CASH) {
          if (!draft.receivedByName.trim()) {
            nextCuotaPayments[i].errors[method] = {
              receivedByName: "Indica quién recibió el pago.",
              receipt: null,
              bankAccountId: null,
            };
            hasBlockingError = true;
          } else {
            nextCuotaPayments[i].errors[method] = { receivedByName: null, receipt: null, bankAccountId: null };
          }
        } else {
          const hasVoucher = !!paymentReceiptRefs.current[i]?.[row]?.files?.length;
          const bankAccountMissing = methodRequiresBankAccount(method) && !draft.bankAccountId;
          if (!hasVoucher || bankAccountMissing) {
            hasBlockingError = true;
          }
          nextCuotaPayments[i].errors[method] = {
            receivedByName: null,
            receipt: hasVoucher ? null : "Debes adjuntar el voucher del pago.",
            bankAccountId: bankAccountMissing ? "Selecciona una cuenta bancaria de destino." : null,
          };
        }
      });
    }
    setCuotaPayments(nextCuotaPayments);

    if (installmentPaymentsExceedCuota.some(Boolean)) {
      hasBlockingError = true;
    }

    if (hasBlockingError) {
      event.preventDefault();
    }
  }

/** Handles the "Número de cuotas" selector -- can jump directly between any two counts (e.g. 1 -> 3), not just +/-1, so every derived array is resized (grown or shrunk) to the new count in one step. */
  function handleInstallmentsCountChange(rawValue: string) {
    const nextCount = Number(rawValue);
    if (!INSTALLMENT_COUNT_OPTIONS.includes(nextCount) || nextCount === installmentsCount) return;

    setInstallmentsCount(nextCount);
    setDueDates((previous) =>
      resizeArray(previous, nextCount, (index) => addDaysToDateInput(saleDate, INSTALLMENT_OFFSET_DAYS[index])),
    );
    setTouched((previous) => resizeArray(previous, nextCount, () => false));
    setCuotaPayments((previous) => resizeArray(previous, nextCount, () => emptyCuotaPaymentState()));
    paymentReceiptRefs.current = resizeArray(paymentReceiptRefs.current, nextCount, () => []);

    if (!firstInstallmentTouched) {
      setFirstInstallmentAmount(defaultFirstInstallmentAmount(finalPriceCents, nextCount));
    }
  }

  function handleSaleDateChange(value: string) {
    setSaleDate(value);
    setDueDates((previous) =>
      previous.map((date, index) =>
        touched[index] ? date : addDaysToDateInput(value, INSTALLMENT_OFFSET_DAYS[index]),
      ),
    );
  }

  function handleDueDateChange(index: number, value: string) {
    setDueDates((previous) => previous.map((date, i) => (i === index ? value : date)));
    setTouched((previous) => previous.map((flag, i) => (i === index ? true : flag)));
  }

  function handleProductChange(value: string) {
    setProductId(value);
    const newOriginalPrice = products.find((product) => product.id === value)?.officialPrice ?? 0;
    const newFinalPriceCents = Math.max(toCents(newOriginalPrice) - toCents(discountValue), 0);
    if (!firstInstallmentTouched) {
      setFirstInstallmentAmount(defaultFirstInstallmentAmount(newFinalPriceCents, installmentsCount));
    }
  }

  function handleDiscountChange(value: string) {
    setDiscount(value);
    const newDiscountValue = Number(value) || 0;
    const newFinalPriceCents = Math.max(toCents(originalPrice) - toCents(newDiscountValue), 0);
    if (!firstInstallmentTouched) {
      setFirstInstallmentAmount(defaultFirstInstallmentAmount(newFinalPriceCents, installmentsCount));
    }
  }

  function handleFirstInstallmentAmountChange(value: string) {
    setFirstInstallmentAmount(value);
    setFirstInstallmentTouched(true);
    setFirstInstallmentClientError(null);
  }

  /** Renders one method's Monto / Entregado a (or Voucher) / Observación block -- shared by the single-method case (no header) and each checked method under Mixto (with a header naming the method). */
  function renderMethodBlock(cuotaIndex: number, method: PaymentMethod, row: number, showHeader: boolean) {
    const draft = draftFor(cuotaIndex, method);
    const fieldErrors = cuotaPayments[cuotaIndex]?.errors[method];
    const receivedByNameError =
      errors?.installmentPaymentReceivedByNames?.[cuotaIndex]?.[row] ?? fieldErrors?.receivedByName ?? undefined;
    const receiptError =
      errors?.installmentPaymentReceipts?.[cuotaIndex]?.[row] ?? fieldErrors?.receipt ?? undefined;
    const amountError = errors?.installmentPaymentAmounts?.[cuotaIndex]?.[row];
    const bankAccountError =
      errors?.installmentPaymentBankAccountIds?.[cuotaIndex]?.[row] ?? fieldErrors?.bankAccountId ?? undefined;
    const idPrefix = `installmentPayment-${cuotaIndex}-${method}`;

    return (
      <div key={method} className="space-y-3 rounded-md border border-border bg-black/[0.02] p-3">
        <input type="hidden" name={`installmentPaymentMethod-${cuotaIndex}-${row}`} value={method} />
        {showHeader && (
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {METHOD_LABELS[method]}
          </p>
        )}

        <div className="space-y-1">
          <label htmlFor={`${idPrefix}-amount`} className="text-sm font-medium text-foreground">
            Monto
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
              $
            </span>
            <input
              id={`${idPrefix}-amount`}
              name={`installmentPaymentAmount-${cuotaIndex}-${row}`}
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={draft.amount}
              onChange={(event) => updateDraft(cuotaIndex, method, { amount: event.target.value })}
              disabled={pending}
              className={`${fieldClass(!!amountError)} pl-6`}
            />
          </div>
          {amountError && <p className="text-sm text-error">{amountError}</p>}
        </div>

        {methodRequiresBankAccount(method) && (
          <div className="space-y-1">
            <label htmlFor={`${idPrefix}-bankAccount`} className="text-sm font-medium text-foreground">
              Cuenta bancaria de destino *
            </label>
            {isFixedBankAccountMethod(method) ? (
              cardBankAccount ? (
                <>
                  <input
                    type="hidden"
                    name={`installmentPaymentBankAccountId-${cuotaIndex}-${row}`}
                    value={cardBankAccount.id}
                  />
                  <p
                    id={`${idPrefix}-bankAccount`}
                    className="rounded-md border border-border bg-black/[0.02] px-3 py-2 text-sm text-foreground"
                  >
                    {cardBankAccount.bankName} — {cardBankAccount.alias} (
                    {maskAccountNumber(cardBankAccount.accountNumber)})
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Los pagos con tarjeta siempre se acreditan a esta cuenta.
                  </p>
                </>
              ) : (
                <p id={`${idPrefix}-bankAccount`} className={fieldClass(true)}>
                  No hay una cuenta bancaria configurada para pagos con tarjeta. Contacta a un
                  administrador.
                </p>
              )
            ) : (
              <select
                id={`${idPrefix}-bankAccount`}
                name={`installmentPaymentBankAccountId-${cuotaIndex}-${row}`}
                value={draft.bankAccountId}
                onChange={(event) => {
                  updateDraft(cuotaIndex, method, { bankAccountId: event.target.value });
                  clearMethodError(cuotaIndex, method, { bankAccountId: null });
                }}
                disabled={pending}
                className={fieldClass(!!bankAccountError)}
              >
                <option value="" disabled>
                  Selecciona una cuenta bancaria…
                </option>
                {bankAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.bankName} — {account.alias} ({maskAccountNumber(account.accountNumber)})
                  </option>
                ))}
              </select>
            )}
            {bankAccountError && <p className="text-sm text-error">{bankAccountError}</p>}
          </div>
        )}

        {method === PaymentMethod.CASH ? (
          <div className="space-y-1">
            <label htmlFor={`${idPrefix}-receivedBy`} className="text-sm font-medium text-foreground">
              Entregado a *
            </label>
            <input
              id={`${idPrefix}-receivedBy`}
              name={`installmentPaymentReceivedByName-${cuotaIndex}-${row}`}
              value={draft.receivedByName}
              onChange={(event) => {
                updateDraft(cuotaIndex, method, { receivedByName: event.target.value });
                clearMethodError(cuotaIndex, method, { receivedByName: null });
              }}
              disabled={pending}
              className={fieldClass(!!receivedByNameError)}
            />
            {receivedByNameError && <p className="text-sm text-error">{receivedByNameError}</p>}
          </div>
        ) : (
          <div className="space-y-1">
            <label htmlFor={`${idPrefix}-receipt`} className="text-sm font-medium text-foreground">
              Voucher *
            </label>
            <input
              ref={(el) => {
                if (!paymentReceiptRefs.current[cuotaIndex]) paymentReceiptRefs.current[cuotaIndex] = [];
                paymentReceiptRefs.current[cuotaIndex][row] = el;
              }}
              id={`${idPrefix}-receipt`}
              name={`installmentPaymentReceipt-${cuotaIndex}-${row}`}
              type="file"
              accept="application/pdf,image/jpeg,image/jpg,image/png,image/webp"
              disabled={pending}
              onChange={() => clearMethodError(cuotaIndex, method, { receipt: null })}
              className={fieldClass(!!receiptError)}
            />
            <p className="text-xs text-muted-foreground">PDF, JPG, PNG o WEBP. Máximo 5 MB.</p>
            {receiptError && <p className="text-sm text-error">{receiptError}</p>}
          </div>
        )}

        <div className="space-y-1">
          <label htmlFor={`${idPrefix}-notes`} className="text-sm font-medium text-foreground">
            Observación <span className="font-normal text-muted-foreground">(opcional)</span>
          </label>
          <textarea
            id={`${idPrefix}-notes`}
            name={`installmentPaymentNotes-${cuotaIndex}-${row}`}
            rows={2}
            value={draft.notes}
            onChange={(event) => updateDraft(cuotaIndex, method, { notes: event.target.value })}
            disabled={pending}
            className={fieldClass(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      onSubmit={handleSubmit}
      className="max-w-2xl space-y-6"
      noValidate
    >
      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">Cliente</label>
        <CustomerSelector
          error={errors?.customerId}
          searchAction={searchCustomersAction}
          createAction={createCustomerAction}
          role={role}
          sellers={sellers}
          currentUserName={currentUserName}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="productId" className="text-sm font-medium text-foreground">
          Producto
        </label>
        <select
          id="productId"
          name="productId"
          value={productId}
          onChange={(event) => handleProductChange(event.target.value)}
          disabled={pending}
          className={fieldClass(!!errors?.productId)}
        >
          <option value="" disabled>
            Selecciona un producto…
          </option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name} — {currencyFormatter.format(product.officialPrice)}
            </option>
          ))}
        </select>
        {errors?.productId && <p className="text-sm text-error">{errors.productId}</p>}
      </div>

      <div className="space-y-1">
        <label htmlFor="saleDate" className="text-sm font-medium text-foreground">
          Fecha de venta
        </label>
        <input
          id="saleDate"
          name="saleDate"
          type="date"
          value={saleDate}
          onChange={(event) => handleSaleDateChange(event.target.value)}
          disabled={pending}
          className={fieldClass(!!errors?.saleDate)}
        />
        {errors?.saleDate && <p className="text-sm text-error">{errors.saleDate}</p>}
      </div>

      <div className="space-y-1">
        <label htmlFor="discount" className="text-sm font-medium text-foreground">
          Descuento <span className="font-normal text-muted-foreground">(opcional)</span>
        </label>
        <input
          id="discount"
          name="discount"
          type="number"
          min="0"
          step="0.01"
          value={discount}
          onChange={(event) => handleDiscountChange(event.target.value)}
          disabled={pending}
          className={fieldClass(!!errors?.discount)}
        />
        {errors?.discount && <p className="text-sm text-error">{errors.discount}</p>}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">Vendedor</label>
        {canPickSeller ? (
          <>
            <select
              name="sellerId"
              defaultValue=""
              disabled={pending}
              className={fieldClass(!!errors?.sellerId)}
            >
              <option value="" disabled>
                Selecciona un vendedor…
              </option>
              {sellers.map((seller) => (
                <option key={seller.id} value={seller.id}>
                  {seller.name}
                </option>
              ))}
            </select>
            {errors?.sellerId && <p className="text-sm text-error">{errors.sellerId}</p>}
          </>
        ) : (
          <p className="rounded-md border border-border bg-black/[0.02] px-3 py-2 text-sm text-muted-foreground">
            Se te asignará automáticamente a ti ({currentUserName}).
          </p>
        )}
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <label htmlFor="installmentsCount" className="text-sm font-medium text-foreground">
            Número de cuotas
          </label>
          <input type="hidden" name="installments" value={installmentsCount} />
          <select
            id="installmentsCount"
            value={installmentsCount}
            onChange={(event) => handleInstallmentsCountChange(event.target.value)}
            disabled={pending}
            className={fieldClass(!!errors?.installments)}
          >
            {INSTALLMENT_COUNT_OPTIONS.map((count) => (
              <option key={count} value={count}>
                {count} {count === 1 ? "cuota" : "cuotas"}
              </option>
            ))}
          </select>
          {errors?.installments && <p className="text-sm text-error">{errors.installments}</p>}
        </div>
        <div className="space-y-3">
          {Array.from({ length: installmentsCount }).map((_, index) => {
            const cuotaAmountCents = installmentAmountCentsPreview[index] ?? 0;
            const cuotaPaidCents = paidCentsForInstallment(index);
            const cuotaPendingCents = Math.max(cuotaAmountCents - cuotaPaidCents, 0);
            const cuotaExceeds = installmentPaymentsExceedCuota[index];
            const cuota = cuotaPayments[index] ?? emptyCuotaPaymentState();
            const methods = activeMethods(index);

            return (
              <div key={index} className="rounded-lg border border-border bg-surface p-4">
                <p className="text-sm font-semibold text-foreground">Cuota {index + 1}</p>

                {index === 0 ? (
                  <div className="mt-2 space-y-1">
                    <label
                      htmlFor="firstInstallmentAmount"
                      className="text-sm font-medium text-foreground"
                    >
                      {installmentsCount === 1 ? "Monto acordado" : "Primera cuota acordada"}
                    </label>
                    {installmentsCount === 1 ? (
                      <p className="rounded-md border border-border bg-black/[0.02] px-3 py-2 text-sm text-foreground">
                        {currencyFormatter.format(cuotaAmountCents / 100)}
                      </p>
                    ) : (
                      <>
                        <div className="relative">
                          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                            $
                          </span>
                          <input
                            id="firstInstallmentAmount"
                            name="firstInstallmentAmount"
                            type="number"
                            min="0.01"
                            step="0.01"
                            inputMode="decimal"
                            value={firstInstallmentAmount}
                            onChange={(event) => handleFirstInstallmentAmountChange(event.target.value)}
                            disabled={pending}
                            className={`${fieldClass(!!firstInstallmentError)} pl-6`}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          El saldo restante se reparte automáticamente en partes iguales entre las
                          demás cuotas.
                        </p>
                      </>
                    )}
                    {firstInstallmentError && (
                      <p className="text-sm text-error">{firstInstallmentError}</p>
                    )}
                  </div>
                ) : (
                  <div className="mt-2 space-y-1">
                    <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                      Monto acordado
                      <StatusBadge tone="neutral">Automático</StatusBadge>
                    </span>
                    <p className="rounded-md border border-dashed border-border bg-black/[0.02] px-3 py-2 text-sm text-foreground">
                      {currencyFormatter.format(cuotaAmountCents / 100)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Calculado automáticamente a partir del saldo restante.
                    </p>
                  </div>
                )}

                <div className="mt-2 space-y-1">
                  <label
                    htmlFor={`installmentDueDate-${index}`}
                    className="text-sm font-medium text-foreground"
                  >
                    Fecha de vencimiento
                  </label>
                  <input
                    id={`installmentDueDate-${index}`}
                    name="installmentDueDates"
                    type="date"
                    value={dueDates[index] ?? ""}
                    onChange={(event) => handleDueDateChange(index, event.target.value)}
                    disabled={pending}
                    className={fieldClass(!!errors?.installmentDates?.[index])}
                  />
                  {errors?.installmentDates?.[index] && (
                    <p className="text-sm text-error">{errors.installmentDates[index]}</p>
                  )}
                </div>

                <div className="mt-3 space-y-3">
                  <div className="space-y-1">
                    <label
                      htmlFor={`cuotaMode-${index}`}
                      className="text-sm font-medium text-foreground"
                    >
                      Forma de pago
                    </label>
                    <select
                      id={`cuotaMode-${index}`}
                      value={cuota.mode}
                      onChange={(event) => handleModeChange(index, event.target.value)}
                      disabled={pending}
                      className={fieldClass(false)}
                    >
                      <option value="">Sin pago registrado todavía</option>
                      {PAYMENT_METHODS.map((method) => (
                        <option key={method} value={method}>
                          {METHOD_LABELS[method]}
                        </option>
                      ))}
                      <option value={MIXED}>Mixto</option>
                    </select>
                  </div>

                  {cuota.mode === MIXED && (
                    <div className="space-y-2 rounded-md border border-border bg-black/[0.02] p-3">
                      <p className="text-sm font-medium text-foreground">Selecciona las formas de pago</p>
                      <div className="grid grid-cols-2 gap-2">
                        {PAYMENT_METHODS.map((method) => (
                          <label
                            key={method}
                            className="flex items-center gap-2 text-sm text-foreground"
                          >
                            <input
                              type="checkbox"
                              checked={cuota.mixedMethods.includes(method)}
                              onChange={(event) => toggleMixedMethod(index, method, event.target.checked)}
                              disabled={pending}
                              className="h-4 w-4 rounded border-border"
                            />
                            {METHOD_LABELS[method]}
                          </label>
                        ))}
                      </div>
                      {cuota.mixedMethods.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          Marca al menos una forma de pago para registrar el pago mixto.
                        </p>
                      )}
                    </div>
                  )}

                  {methods.map((method, row) =>
                    renderMethodBlock(index, method, row, cuota.mode === MIXED),
                  )}

                  {methods.length === 0 && cuota.mode !== MIXED && (
                    <p className="text-xs text-muted-foreground">Sin pagos registrados todavía.</p>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
                  <span className="text-muted-foreground">
                    Pagado:{" "}
                    <span className="font-medium text-foreground">
                      {currencyFormatter.format(cuotaPaidCents / 100)}
                    </span>
                  </span>
                  <span className="text-muted-foreground">
                    Pendiente:{" "}
                    <span className="font-medium text-foreground">
                      {currencyFormatter.format(cuotaPendingCents / 100)}
                    </span>
                  </span>
                </div>
                {(errors?.installmentPaymentsTotal?.[index] || cuotaExceeds) && (
                  <p className="mt-1 text-sm text-error">
                    {errors?.installmentPaymentsTotal?.[index] ??
                      "La suma de los pagos supera el monto de la cuota."}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-black/[0.02] p-4">
        <dl className="grid grid-cols-2 gap-y-2 text-sm sm:grid-cols-3">
          <dt className="text-muted-foreground">Precio original</dt>
          <dd className="col-span-1 text-right font-medium text-foreground sm:col-span-2">
            {currencyFormatter.format(originalPrice)}
          </dd>
          <dt className="text-muted-foreground">Descuento</dt>
          <dd className="col-span-1 text-right font-medium text-foreground sm:col-span-2">
            {currencyFormatter.format(discountValue)}
          </dd>
          <dt className="font-semibold text-foreground">Precio final</dt>
          <dd className="col-span-1 text-right text-lg font-bold text-primary sm:col-span-2">
            {currencyFormatter.format(finalPrice)}
          </dd>
          <dt className="text-muted-foreground">Total pagado</dt>
          <dd className="col-span-1 text-right font-medium text-foreground sm:col-span-2">
            {currencyFormatter.format(totalPaidCents / 100)}
          </dd>
          <dt className="font-semibold text-foreground">Saldo pendiente</dt>
          <dd className="col-span-1 text-right text-lg font-bold text-primary sm:col-span-2">
            {currencyFormatter.format(saleBalanceCents / 100)}
          </dd>
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">
          El precio final y el monto de cada cuota se recalculan y validan en el servidor; esta
          vista es solo una referencia.
        </p>
      </div>

      {formError && <p className="text-sm text-error">{formError}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-dark disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Registrar venta"}
      </button>
    </form>
  );
}
