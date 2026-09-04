"use client";

import { useActionState, useMemo, useRef, useState, type FormEvent } from "react";
import { UserRole } from "@/generated/prisma/enums";
import type { SaleFormState } from "@/app/(app)/ventas/actions";
import { CustomerSelector, type CustomerSearchResult } from "./customer-selector";
import type { NewCustomerAction } from "./customer-create-modal";

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

/**
 * Splits `totalCents` into `count` shares that sum exactly back to
 * `totalCents` -- mirrors sale-service.distributeCents() so the preview
 * shown here matches what the server will actually charge. Purely
 * visual: the server recomputes and validates this independently.
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

  // Belt-and-suspenders: the actual, unbypassable rule lives in
  // createSaleForUser (server-side) -- this only blocks the obvious case
  // of submitting with no file chosen, without a round trip.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const hasFile = !!receiptInputRef.current?.files?.length;
    if (!hasFile) {
      event.preventDefault();
      setReceiptClientError("Debes adjuntar un comprobante para registrar la venta.");
      return;
    }
    setReceiptClientError(null);
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

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === productId),
    [products, productId],
  );
  const originalPrice = selectedProduct?.officialPrice ?? 0;
  const discountValue = Number(discount) || 0;
  const finalPrice = Math.max(originalPrice - discountValue, 0);
  const finalPriceCents = Math.max(toCents(originalPrice) - toCents(discountValue), 0);
  const installmentAmountsCents = useMemo(
    () => distributeCentsPreview(finalPriceCents, installmentsCount),
    [finalPriceCents, installmentsCount],
  );

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
          onChange={(event) => setProductId(event.target.value)}
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
          onChange={(event) => setDiscount(event.target.value)}
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
              <p className="mt-1 text-sm text-muted-foreground">
                Monto: {currencyFormatter.format((installmentAmountsCents[index] ?? 0) / 100)}
              </p>
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
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">
          El precio final se recalcula y valida en el servidor; esta vista es solo una referencia.
        </p>
      </div>

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
