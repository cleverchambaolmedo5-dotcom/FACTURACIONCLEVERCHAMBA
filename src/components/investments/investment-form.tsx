"use client";

import { useActionState, useMemo, useRef, useState, type FormEvent } from "react";
import { UserRole } from "@/generated/prisma/enums";
import type { InvestmentFormState } from "@/app/(app)/inversiones/actions";
import { CustomerSelector, type CustomerSearchResult } from "@/components/sales/customer-selector";
import type { NewCustomerAction } from "@/components/sales/customer-create-modal";

export type InvestmentFormAction = (
  state: InvestmentFormState,
  formData: FormData,
) => Promise<InvestmentFormState>;

export type InvestmentFormSeller = { id: string; name: string };

const DEFAULT_ANNUAL_RATE = "13.00";
const MINIMUM_PRINCIPAL_AMOUNT = 2000;

const dateFormatter = new Intl.DateTimeFormat("es-EC", { dateStyle: "long", timeZone: "UTC" });
const currencyFormatter = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

function fieldClass(hasError: boolean) {
  return `w-full rounded-md border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:ring-1 ${
    hasError
      ? "border-error focus:border-error focus:ring-error"
      : "border-border focus:border-primary focus:ring-primary"
  }`;
}

/** Mirrors investment-service.ts#addYearsUTC -- purely for the on-screen preview; the server recomputes and validates this independently. */
function addYearsToDateInput(base: string, years: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(base);
  if (!match) return "";
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return date.toISOString().slice(0, 10);
}

function parseDateInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
}

export function InvestmentForm({
  action,
  role,
  currentUserName,
  sellers,
  defaultStartDate,
  searchCustomersAction,
  createCustomerAction,
}: {
  action: InvestmentFormAction;
  role: UserRole;
  currentUserName: string;
  sellers: InvestmentFormSeller[];
  defaultStartDate: string;
  searchCustomersAction: (query: string) => Promise<CustomerSearchResult[]>;
  createCustomerAction: NewCustomerAction;
}) {
  const [state, formAction, pending] = useActionState<InvestmentFormState, FormData>(
    action,
    undefined,
  );
  const errors = state && !state.ok ? state.errors : undefined;
  const formError = state && !state.ok ? state.formError : undefined;
  const canPickSeller = role !== UserRole.SELLER;
  const canSeeRate = role === UserRole.ADMIN;

  const receiptInputRef = useRef<HTMLInputElement>(null);
  const [receiptClientError, setReceiptClientError] = useState<string | null>(null);
  // `errors?.receipt` reflects the last server response, not live client
  // state -- once the user has changed the file since that response, keep
  // it dismissed so a stale "Solo se permiten archivos..." from a previous
  // (now-replaced) file doesn't linger and read as if the new selection
  // didn't take. Mirrors the `error && !selected` fix in CustomerSelector.
  const [receiptServerErrorDismissed, setReceiptServerErrorDismissed] = useState(false);
  const receiptError = receiptClientError ?? (receiptServerErrorDismissed ? undefined : errors?.receipt);

  // Belt-and-suspenders: the actual, unbypassable rule lives in
  // createInvestmentForUser (server-side) -- this only blocks the obvious
  // case of submitting with no file chosen, without a round trip.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const hasFile = !!receiptInputRef.current?.files?.length;
    if (!hasFile) {
      event.preventDefault();
      setReceiptClientError("Debes adjuntar el comprobante de ingreso del dinero.");
      return;
    }
    setReceiptClientError(null);
    // A real submission is going through -- let whatever the server
    // returns for `receipt` this time (a new error, or none) be
    // authoritative again, rather than staying dismissed forever.
    setReceiptServerErrorDismissed(false);
  }

  const [startDate, setStartDate] = useState(defaultStartDate);
  const [principalAmount, setPrincipalAmount] = useState("");

  const firstReturnDate = useMemo(() => addYearsToDateInput(startDate, 1), [startDate]);
  const maturityDate = useMemo(() => addYearsToDateInput(startDate, 2), [startDate]);
  const parsedStartDate = useMemo(() => parseDateInput(startDate), [startDate]);
  const parsedFirstReturn = useMemo(() => parseDateInput(firstReturnDate), [firstReturnDate]);
  const parsedMaturity = useMemo(() => parseDateInput(maturityDate), [maturityDate]);

  return (
    <form
      action={formAction}
      onSubmit={handleSubmit}
      encType="multipart/form-data"
      className="max-w-2xl space-y-6"
      noValidate
    >
      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">Cliente / Inversionista</label>
        <CustomerSelector
          error={errors?.customerId}
          searchAction={searchCustomersAction}
          createAction={createCustomerAction}
          role={role}
          sellers={sellers}
          currentUserName={currentUserName}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="startDate" className="text-sm font-medium text-foreground">
            Fecha de inicio
          </label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            disabled={pending}
            className={fieldClass(!!errors?.startDate)}
          />
          {errors?.startDate && <p className="text-sm text-error">{errors.startDate}</p>}
        </div>

        <div className="space-y-1">
          <label htmlFor="principalAmount" className="text-sm font-medium text-foreground">
            Monto de la inversión
          </label>
          <input
            id="principalAmount"
            name="principalAmount"
            type="number"
            min={MINIMUM_PRINCIPAL_AMOUNT}
            step="0.01"
            value={principalAmount}
            onChange={(event) => setPrincipalAmount(event.target.value)}
            disabled={pending}
            className={fieldClass(!!errors?.principalAmount)}
          />
          <p className="text-xs text-muted-foreground">
            Monto mínimo: {currencyFormatter.format(MINIMUM_PRINCIPAL_AMOUNT)}.
          </p>
          {errors?.principalAmount && <p className="text-sm text-error">{errors.principalAmount}</p>}
        </div>
      </div>

      {canSeeRate && (
        <div className="space-y-1">
          <label htmlFor="annualRate" className="text-sm font-medium text-foreground">
            Tasa anual (%) <span className="font-normal text-muted-foreground">(opcional)</span>
          </label>
          <input
            id="annualRate"
            name="annualRate"
            type="number"
            min="0.01"
            max="100"
            step="0.01"
            defaultValue={DEFAULT_ANNUAL_RATE}
            disabled={pending}
            className={fieldClass(!!errors?.annualRate)}
          />
          <p className="text-xs text-muted-foreground">
            Por defecto {DEFAULT_ANNUAL_RATE}%. Solo modifícala para casos especiales.
          </p>
          {errors?.annualRate && <p className="text-sm text-error">{errors.annualRate}</p>}
        </div>
      )}

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

      <div className="rounded-lg border border-border bg-black/[0.02] p-4">
        <dl className="grid grid-cols-2 gap-y-2 text-sm sm:grid-cols-3">
          <dt className="text-muted-foreground">Primer rendimiento</dt>
          <dd className="col-span-1 text-right font-medium text-foreground sm:col-span-2">
            {parsedFirstReturn ? dateFormatter.format(parsedFirstReturn) : "—"}
          </dd>
          <dt className="text-muted-foreground">Vencimiento</dt>
          <dd className="col-span-1 text-right font-medium text-foreground sm:col-span-2">
            {parsedMaturity ? dateFormatter.format(parsedMaturity) : "—"}
          </dd>
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">
          Calculadas automáticamente a partir de la fecha de inicio ({parsedStartDate ? dateFormatter.format(parsedStartDate) : "—"}); el servidor las recalcula y valida de forma independiente.
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="receipt" className="text-sm font-medium text-foreground">
          Comprobante de ingreso del dinero *
        </label>
        <input
          ref={receiptInputRef}
          id="receipt"
          name="receipt"
          type="file"
          accept="application/pdf,image/jpeg,image/jpg,image/png,image/webp"
          required
          disabled={pending}
          onChange={() => {
            setReceiptClientError(null);
            // The selected file just changed -- any leftover server error
            // describes the file that's no longer selected, not this one.
            setReceiptServerErrorDismissed(true);
          }}
          className={fieldClass(!!receiptError)}
        />
        <p className="text-xs text-muted-foreground">PDF, JPG, PNG o WEBP. Máximo 5 MB.</p>
        {receiptError && <p className="text-sm text-error">{receiptError}</p>}
      </div>

      <div className="space-y-1">
        <label htmlFor="contract" className="text-sm font-medium text-foreground">
          Contrato <span className="font-normal text-muted-foreground">(opcional)</span>
        </label>
        <input
          id="contract"
          name="contract"
          type="file"
          accept="application/pdf,image/jpeg,image/jpg,image/png,image/webp"
          disabled={pending}
          className={fieldClass(!!errors?.contract)}
        />
        <p className="text-xs text-muted-foreground">Preferiblemente PDF. Máximo 5 MB.</p>
        {errors?.contract && <p className="text-sm text-error">{errors.contract}</p>}
      </div>

      {formError && <p className="text-sm text-error">{formError}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-dark disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Registrar inversión"}
      </button>
    </form>
  );
}
