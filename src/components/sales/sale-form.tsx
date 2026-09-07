"use client";

import { useActionState, useMemo, useRef, useState, type FormEvent } from "react";
import { PaymentMethod, UserRole } from "@/generated/prisma/enums";
import type { SaleFormState } from "@/app/(app)/ventas/actions";
import { CustomerSelector, type CustomerSearchResult } from "./customer-selector";
import type { NewCustomerAction } from "./customer-create-modal";

// Mirrors payment-form.tsx's own METHOD_LABELS -- duplicated rather than
// shared since these are two separate client components in different
// modules, same pattern as the small server-side helpers duplicated
// between sale-service.ts and payment-service.ts.
const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  BANK_TRANSFER: "Transferencia",
  CARD: "Tarjeta",
  OTHER: "Otro",
};

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

const INSTALLMENT_OPTIONS = [1, 2, 3] as const;
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
 * `totalCents` -- used only to suggest a starting amount for each cuota
 * input (the first `count - 1` get the floor share, the last absorbs the
 * rounding remainder). Every cuota amount remains fully editable, and the
 * server re-validates whatever is actually submitted.
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

export function SaleForm({
  action,
  role,
  currentUserName,
  products,
  sellers,
  bankAccounts,
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
  defaultSaleDate: string;
  searchCustomersAction: (query: string) => Promise<CustomerSearchResult[]>;
  createCustomerAction: NewCustomerAction;
}) {
  const [state, formAction, pending] = useActionState<SaleFormState, FormData>(action, undefined);
  const errors = state && !state.ok ? state.errors : undefined;
  const formError = state && !state.ok ? state.formError : undefined;
  const canPickSeller = role !== UserRole.SELLER;

  const receiptInputRef = useRef<HTMLInputElement>(null);
  const [receiptClientError, setReceiptClientError] = useState<string | null>(null);
  const receiptError = errors?.receipt ?? receiptClientError ?? undefined;
  const [installmentsTotalClientError, setInstallmentsTotalClientError] = useState<string | null>(
    null,
  );

  // --- Initial payment (optional): "el cliente ya pagó la Cuota 1". When
  // checked, creates a Payment (PENDING_VALIDATION) against installment #1
  // together with the sale itself -- see sale-service.ts#createSaleForUser.
  const [hasInitialPayment, setHasInitialPayment] = useState(false);
  const [initialPaymentAmount, setInitialPaymentAmount] = useState("0.00");
  const [initialPaymentDate, setInitialPaymentDate] = useState(defaultSaleDate);
  const initialPaymentReceiptRef = useRef<HTMLInputElement>(null);
  const [initialPaymentReceiptClientError, setInitialPaymentReceiptClientError] = useState<
    string | null
  >(null);
  // Merges errors.receipt in too: while hasInitialPayment is checked, the
  // single file the user attaches here is mirrored into the hidden
  // `receipt` input (see handleInitialPaymentReceiptChange) and backs both
  // records server-side, so a rejection of either one must surface here --
  // the separate "Adjuntar comprobante" field isn't rendered in that case.
  const initialPaymentReceiptError =
    errors?.initialPaymentReceipt ?? errors?.receipt ?? initialPaymentReceiptClientError ?? undefined;

  function handleToggleInitialPayment(checked: boolean) {
    setHasInitialPayment(checked);
    if (checked) {
      setInitialPaymentAmount(installmentAmounts[0] ?? "0.00");
      setInitialPaymentDate(saleDate);
    }
  }

  /**
   * Mirrors the single comprobante file into the hidden `receipt` input
   * (via DataTransfer) whenever "ya pagó la Cuota 1" is checked -- the user
   * uploads one file, but it ends up backing both the SaleReceipt and the
   * initial Payment's PaymentReceipt server-side, exactly as if they'd
   * uploaded it twice into the two separate fields this replaces.
   */
  function handleInitialPaymentReceiptChange(file: File | null) {
    setInitialPaymentReceiptClientError(null);
    if (file && receiptInputRef.current) {
      const transfer = new DataTransfer();
      transfer.items.add(file);
      receiptInputRef.current.files = transfer.files;
    }
  }

  // Belt-and-suspenders: the actual, unbypassable rule lives in
  // createSaleForUser (server-side) -- this only blocks the obvious cases
  // (no file chosen, cuotas that don't add up to the final price) without
  // a round trip.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (hasInitialPayment) {
      const hasInitialPaymentFile = !!initialPaymentReceiptRef.current?.files?.length;
      if (!hasInitialPaymentFile) {
        event.preventDefault();
        setInitialPaymentReceiptClientError("Debes adjuntar un comprobante de pago.");
        return;
      }
      setInitialPaymentReceiptClientError(null);
      setReceiptClientError(null);
    } else {
      const hasFile = !!receiptInputRef.current?.files?.length;
      if (!hasFile) {
        event.preventDefault();
        setReceiptClientError("Debes adjuntar un comprobante para registrar la venta.");
        return;
      }
      setReceiptClientError(null);
    }

    const installmentsTotalMessage = installmentsExceedFinalPrice
      ? "La suma de las cuotas no puede superar el precio final de la venta."
      : installmentsHaveZeroAmount
        ? "Cada cuota debe ser mayor a cero."
        : installmentsMismatchFinalPrice
          ? "La suma de las cuotas debe ser igual al precio final de la venta."
          : null;
    if (installmentsTotalMessage) {
      event.preventDefault();
      setInstallmentsTotalClientError(installmentsTotalMessage);
      return;
    }
    setInstallmentsTotalClientError(null);
  }

  // Client-side state only drives the live preview below -- the actual
  // originalPrice/finalPrice/dueDate values are always recomputed and
  // validated on the server from the submitted fields, never trusted
  // from here.
  const [productId, setProductId] = useState("");
  const [bankAccountId, setBankAccountId] = useState("");
  const [discount, setDiscount] = useState("0");
  const [saleDate, setSaleDate] = useState(defaultSaleDate);
  const [installmentsCount, setInstallmentsCount] = useState<number>(1);
  const [dueDates, setDueDates] = useState<string[]>([defaultSaleDate]);
  // Tracks which due-date inputs the user has hand-edited, so changing
  // the sale date only refreshes still-default (untouched) cuotas.
  const [touched, setTouched] = useState<boolean[]>([false]);
  // The cuota amounts are now user-editable (see handleInstallmentAmountChange
  // below), not purely derived. `amountsTouched` mirrors the due-date
  // `touched` pattern: an untouched cuota keeps tracking the even-split
  // suggestion as the product/discount/count change, while a hand-edited
  // one is left alone until the user clears the form.
  const [installmentAmounts, setInstallmentAmounts] = useState<string[]>(["0.00"]);
  const [amountsTouched, setAmountsTouched] = useState<boolean[]>([false]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === productId),
    [products, productId],
  );
  const originalPrice = selectedProduct?.officialPrice ?? 0;
  const discountValue = Number(discount) || 0;
  const finalPrice = Math.max(originalPrice - discountValue, 0);
  const finalPriceCents = Math.max(toCents(originalPrice) - toCents(discountValue), 0);

  const installmentAmountCents = installmentAmounts
    .slice(0, installmentsCount)
    .map((amount) => Math.max(toCents(Number(amount) || 0), 0));
  const totalInstallmentsCents = installmentAmountCents.reduce((sum, cents) => sum + cents, 0);
  const remainingBalanceCents = Math.max(finalPriceCents - totalInstallmentsCents, 0);
  const installmentsExceedFinalPrice = totalInstallmentsCents > finalPriceCents;
  const installmentsMismatchFinalPrice = totalInstallmentsCents !== finalPriceCents;
  const installmentsHaveZeroAmount = installmentAmountCents.some((cents) => cents <= 0);
  const installmentsTotalError =
    errors?.installmentsTotal ?? installmentsTotalClientError ?? undefined;

  /**
   * Recomputes every untouched cuota so that, together, they cover exactly
   * what's left after subtracting the hand-edited (touched) cuotas from
   * `newFinalPriceCents` -- e.g. with 2 cuotas and $300 typed into cuota 1,
   * cuota 2 becomes `newFinalPriceCents - 300` automatically, updating live
   * as cuota 1 changes. A touched cuota's own value is always left exactly
   * as the user entered it. The remaining balance is floor-split across the
   * untouched cuotas, with the rounding remainder absorbed by the last
   * untouched one -- the same rule `distributeCentsPreview` already uses
   * for the very first suggestion.
   */
  function computeUntouchedDistribution(
    previousAmounts: string[],
    previousTouched: boolean[],
    newFinalPriceCents: number,
    count: number,
  ): string[] {
    const untouchedIndices: number[] = [];
    let touchedSumCents = 0;
    for (let index = 0; index < count; index += 1) {
      if (previousTouched[index]) {
        touchedSumCents += Math.max(toCents(Number(previousAmounts[index]) || 0), 0);
      } else {
        untouchedIndices.push(index);
      }
    }

    const result = Array.from({ length: count }, (_, index) => previousAmounts[index] ?? "0.00");
    if (untouchedIndices.length === 0) return result;

    const remainingCents = Math.max(newFinalPriceCents - touchedSumCents, 0);
    const shares = distributeCentsPreview(remainingCents, untouchedIndices.length);
    untouchedIndices.forEach((index, shareIndex) => {
      result[index] = centsToAmountInput(shares[shareIndex]);
    });
    return result;
  }

  function handleInstallmentsCountChange(count: number) {
    setInstallmentsCount(count);
    setDueDates((previous) => {
      const next = previous.slice(0, count);
      while (next.length < count) {
        next.push(addDaysToDateInput(saleDate, INSTALLMENT_OFFSET_DAYS[next.length]));
      }
      return next;
    });
    setTouched((previous) => {
      const next = previous.slice(0, count);
      while (next.length < count) next.push(false);
      return next;
    });
    const nextAmountsTouched = amountsTouched.slice(0, count);
    while (nextAmountsTouched.length < count) nextAmountsTouched.push(false);
    setInstallmentAmounts((previous) =>
      computeUntouchedDistribution(previous, nextAmountsTouched, finalPriceCents, count),
    );
    setAmountsTouched(nextAmountsTouched);
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
    setInstallmentAmounts((previous) =>
      computeUntouchedDistribution(previous, amountsTouched, newFinalPriceCents, installmentsCount),
    );
  }

  function handleDiscountChange(value: string) {
    setDiscount(value);
    const newDiscountValue = Number(value) || 0;
    const newFinalPriceCents = Math.max(toCents(originalPrice) - toCents(newDiscountValue), 0);
    setInstallmentAmounts((previous) =>
      computeUntouchedDistribution(previous, amountsTouched, newFinalPriceCents, installmentsCount),
    );
  }

  function handleInstallmentAmountChange(index: number, value: string) {
    const nextTouched = amountsTouched.map((flag, i) => (i === index ? true : flag));
    setInstallmentAmounts((previous) => {
      const updated = previous.map((amount, i) => (i === index ? value : amount));
      return computeUntouchedDistribution(updated, nextTouched, finalPriceCents, installmentsCount);
    });
    setAmountsTouched(nextTouched);
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

      <div className="grid gap-4 sm:grid-cols-2">
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
          <label htmlFor="installments" className="text-sm font-medium text-foreground">
            Número de cuotas
          </label>
          <select
            id="installments"
            name="installments"
            value={installmentsCount}
            onChange={(event) => handleInstallmentsCountChange(Number(event.target.value))}
            disabled={pending}
            className={fieldClass(!!errors?.installments)}
          >
            {INSTALLMENT_OPTIONS.map((count) => (
              <option key={count} value={count}>
                {count} {count === 1 ? "cuota" : "cuotas"}
              </option>
            ))}
          </select>
          {errors?.installments && <p className="text-sm text-error">{errors.installments}</p>}
        </div>
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

      <div className="space-y-1">
        <label htmlFor="bankAccountId" className="text-sm font-medium text-foreground">
          Cuenta bancaria de destino
        </label>
        <select
          id="bankAccountId"
          name="bankAccountId"
          value={bankAccountId}
          onChange={(event) => setBankAccountId(event.target.value)}
          disabled={pending}
          className={fieldClass(!!errors?.bankAccountId)}
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
        <p className="text-xs text-muted-foreground">
          Cuenta donde se espera recibir el pago de esta venta. El saldo solo se actualiza cuando
          Contabilidad aprueba cada pago.
        </p>
        {errors?.bankAccountId && <p className="text-sm text-error">{errors.bankAccountId}</p>}
      </div>

      <div className="space-y-3">
        <label className="text-sm font-medium text-foreground">Cuotas</label>
        <div className="space-y-3">
          {Array.from({ length: installmentsCount }).map((_, index) => (
            <div key={index} className="rounded-lg border border-border bg-surface p-4">
              <p className="text-sm font-semibold text-foreground">Cuota {index + 1}</p>
              <div className="mt-2 space-y-1">
                <label
                  htmlFor={`installmentAmount-${index}`}
                  className="text-sm font-medium text-foreground"
                >
                  Monto
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
                    $
                  </span>
                  <input
                    id={`installmentAmount-${index}`}
                    name="installmentAmounts"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={installmentAmounts[index] ?? ""}
                    onChange={(event) => handleInstallmentAmountChange(index, event.target.value)}
                    disabled={pending}
                    className={`${fieldClass(!!errors?.installmentAmounts?.[index])} pl-6`}
                  />
                </div>
                {errors?.installmentAmounts?.[index] && (
                  <p className="text-sm text-error">{errors.installmentAmounts[index]}</p>
                )}
              </div>
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
            </div>
          ))}
        </div>
        {installmentsTotalError && <p className="text-sm text-error">{installmentsTotalError}</p>}
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
          <dt className="text-muted-foreground">Total en cuotas</dt>
          <dd className="col-span-1 text-right font-medium text-foreground sm:col-span-2">
            {currencyFormatter.format(totalInstallmentsCents / 100)}
          </dd>
          <dt className="font-semibold text-foreground">Saldo pendiente</dt>
          <dd
            className={`col-span-1 text-right text-lg font-bold sm:col-span-2 ${
              installmentsMismatchFinalPrice ? "text-error" : "text-primary"
            }`}
          >
            {currencyFormatter.format(remainingBalanceCents / 100)}
          </dd>
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">
          El precio final se recalcula y valida en el servidor; esta vista es solo una referencia.
          La suma de las cuotas debe coincidir exactamente con el precio final.
        </p>
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
        <label className="flex items-center gap-2 text-sm font-medium text-foreground">
          <input
            type="checkbox"
            checked={hasInitialPayment}
            onChange={(event) => handleToggleInitialPayment(event.target.checked)}
            disabled={pending}
            className="h-4 w-4 rounded border-border"
          />
          El cliente ya pagó la Cuota 1 al momento de esta venta
        </label>

        {hasInitialPayment && (
          <div className="space-y-4 pt-2">
            <input type="hidden" name="registerInitialPayment" value="on" />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label
                  htmlFor="initialPaymentAmount"
                  className="text-sm font-medium text-foreground"
                >
                  Monto pagado
                </label>
                <input
                  id="initialPaymentAmount"
                  name="initialPaymentAmount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={initialPaymentAmount}
                  onChange={(event) => setInitialPaymentAmount(event.target.value)}
                  disabled={pending}
                  className={fieldClass(!!errors?.initialPaymentAmount)}
                />
                {errors?.initialPaymentAmount && (
                  <p className="text-sm text-error">{errors.initialPaymentAmount}</p>
                )}
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="initialPaymentDate"
                  className="text-sm font-medium text-foreground"
                >
                  Fecha del pago
                </label>
                <input
                  id="initialPaymentDate"
                  name="initialPaymentDate"
                  type="date"
                  value={initialPaymentDate}
                  onChange={(event) => setInitialPaymentDate(event.target.value)}
                  disabled={pending}
                  className={fieldClass(!!errors?.initialPaymentDate)}
                />
                {errors?.initialPaymentDate && (
                  <p className="text-sm text-error">{errors.initialPaymentDate}</p>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="initialPaymentMethod" className="text-sm font-medium text-foreground">
                Método de pago
              </label>
              <select
                id="initialPaymentMethod"
                name="initialPaymentMethod"
                defaultValue=""
                disabled={pending}
                className={fieldClass(!!errors?.initialPaymentMethod)}
              >
                <option value="" disabled>
                  Selecciona un método…
                </option>
                {Object.values(PaymentMethod).map((method) => (
                  <option key={method} value={method}>
                    {METHOD_LABELS[method]}
                  </option>
                ))}
              </select>
              {errors?.initialPaymentMethod && (
                <p className="text-sm text-error">{errors.initialPaymentMethod}</p>
              )}
            </div>

            <div className="space-y-1">
              <label
                htmlFor="initialPaymentReference"
                className="text-sm font-medium text-foreground"
              >
                Referencia <span className="font-normal text-muted-foreground">(opcional)</span>
              </label>
              <input
                id="initialPaymentReference"
                name="initialPaymentReference"
                disabled={pending}
                className={fieldClass(false)}
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="initialPaymentNotes" className="text-sm font-medium text-foreground">
                Observaciones <span className="font-normal text-muted-foreground">(opcional)</span>
              </label>
              <textarea
                id="initialPaymentNotes"
                name="initialPaymentNotes"
                rows={2}
                disabled={pending}
                className={fieldClass(false)}
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="initialPaymentReceipt"
                className="text-sm font-medium text-foreground"
              >
                Comprobante de pago *
              </label>
              <input
                ref={initialPaymentReceiptRef}
                id="initialPaymentReceipt"
                name="initialPaymentReceipt"
                type="file"
                accept="application/pdf,image/jpeg,image/jpg,image/png,image/webp"
                disabled={pending}
                onChange={(event) =>
                  handleInitialPaymentReceiptChange(event.target.files?.[0] ?? null)
                }
                className={fieldClass(!!initialPaymentReceiptError)}
              />
              {/* Mirrors the same file into the sale's own `receipt` field
                  (see handleInitialPaymentReceiptChange) so it backs both
                  the SaleReceipt and this initial Payment's PaymentReceipt
                  without asking the user to upload it twice. */}
              <input ref={receiptInputRef} type="file" name="receipt" hidden disabled={pending} />
              <p className="text-xs text-muted-foreground">PDF, JPG, PNG o WEBP. Máximo 5 MB.</p>
              {initialPaymentReceiptError && (
                <p className="text-sm text-error">{initialPaymentReceiptError}</p>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Este comprobante se usará tanto para el pago inicial como para el registro de la
              venta, y quedará pendiente de validación en Contabilidad → Comprobantes.
            </p>
          </div>
        )}
      </div>

      {!hasInitialPayment && (
        <div className="space-y-1">
          <label htmlFor="receipt" className="text-sm font-medium text-foreground">
            Adjuntar comprobante *
          </label>
          <input
            ref={receiptInputRef}
            id="receipt"
            name="receipt"
            type="file"
            accept="application/pdf,image/jpeg,image/jpg,image/png,image/webp"
            required
            disabled={pending}
            onChange={() => setReceiptClientError(null)}
            className={fieldClass(!!receiptError)}
          />
          <p className="text-xs text-muted-foreground">PDF, JPG, PNG o WEBP. Máximo 5 MB.</p>
          {receiptError && <p className="text-sm text-error">{receiptError}</p>}
        </div>
      )}

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
