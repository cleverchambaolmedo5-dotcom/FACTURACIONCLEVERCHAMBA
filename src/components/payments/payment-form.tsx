"use client";

import { useActionState, useRef, useState, type FormEvent } from "react";
import { PaymentMethod } from "@/generated/prisma/enums";
import type { PaymentFormState } from "@/app/(app)/pagos/actions";

const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  BANK_TRANSFER: "Transferencia",
  DEPOSIT: "Depósito",
  CARD: "Tarjeta",
  OTHER: "Otro",
};

export type PaymentFormAction = (
  state: PaymentFormState,
  formData: FormData,
) => Promise<PaymentFormState>;

export type PaymentFormBankAccount = {
  id: string;
  bankName: string;
  alias: string;
  accountNumber: string;
};

const currencyFormatter = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

function fieldClass(hasError: boolean) {
  return `w-full rounded-md border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:ring-1 ${
    hasError
      ? "border-error focus:border-error focus:ring-error"
      : "border-border focus:border-primary focus:ring-primary"
  }`;
}

/** Masks everything but the last 4 characters -- mirrors sale-form.tsx's own maskAccountNumber. */
function maskAccountNumber(accountNumber: string): string {
  const visible = accountNumber.slice(-4);
  const hiddenLength = accountNumber.length - visible.length;
  if (hiddenLength <= 0) return accountNumber;
  return "•".repeat(hiddenLength) + visible;
}

export function PaymentForm({
  action,
  balanceCents,
  defaultPaymentDate,
  bankAccounts,
  cardBankAccount,
}: {
  action: PaymentFormAction;
  balanceCents: number;
  defaultPaymentDate: string;
  bankAccounts: PaymentFormBankAccount[];
  // The one fixed BankAccount every CARD payment is credited to -- null
  // when CARD_PAYMENT_BANK_ACCOUNT_ID isn't configured, in which case the
  // seller can still pick "Tarjeta" but submission is blocked (server-side,
  // see registerPaymentForUser) until an admin configures it. Mirrors
  // sale-form.tsx's own cardBankAccount prop.
  cardBankAccount: PaymentFormBankAccount | null;
}) {
  const [state, formAction, pending] = useActionState<PaymentFormState, FormData>(action, undefined);
  const errors = state && !state.ok ? state.errors : undefined;
  const formError = state && !state.ok ? state.formError : undefined;

  // Only tracked so the "cuenta bancaria" field below can switch to the
  // locked CARD view -- every other field stays uncontrolled, unchanged.
  const [method, setMethod] = useState<PaymentMethod | "">("");

  const receiptInputRef = useRef<HTMLInputElement>(null);
  const [receiptClientError, setReceiptClientError] = useState<string | null>(null);
  const receiptError = errors?.receipt ?? receiptClientError ?? undefined;

  // Belt-and-suspenders: the actual, unbypassable rule lives in
  // registerPaymentForUser (server-side) -- this only blocks the obvious
  // case of submitting with no file chosen, without a round trip.
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const hasFile = !!receiptInputRef.current?.files?.length;
    if (!hasFile) {
      event.preventDefault();
      setReceiptClientError("Debes adjuntar un comprobante para registrar el pago.");
      return;
    }
    setReceiptClientError(null);
  }

  return (
    <form
      id="registrar-pago"
      action={formAction}
      onSubmit={handleSubmit}
      encType="multipart/form-data"
      className="max-w-md space-y-4"
      noValidate
    >
      <div className="space-y-1">
        <label htmlFor="amount" className="text-sm font-medium text-foreground">
          Monto
        </label>
        <input
          id="amount"
          name="amount"
          type="number"
          min="0.01"
          step="0.01"
          max={(balanceCents / 100).toFixed(2)}
          disabled={pending}
          className={fieldClass(!!errors?.amount)}
        />
        <p className="text-xs text-muted-foreground">
          Saldo pendiente: {currencyFormatter.format(balanceCents / 100)}
        </p>
        {errors?.amount && <p className="text-sm text-error">{errors.amount}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="paymentDate" className="text-sm font-medium text-foreground">
            Fecha de pago
          </label>
          <input
            id="paymentDate"
            name="paymentDate"
            type="date"
            defaultValue={defaultPaymentDate}
            disabled={pending}
            className={fieldClass(!!errors?.paymentDate)}
          />
          {errors?.paymentDate && <p className="text-sm text-error">{errors.paymentDate}</p>}
        </div>

        <div className="space-y-1">
          <label htmlFor="method" className="text-sm font-medium text-foreground">
            Método de pago
          </label>
          <select
            id="method"
            name="method"
            value={method}
            onChange={(event) => setMethod(event.target.value as PaymentMethod)}
            disabled={pending}
            className={fieldClass(!!errors?.method)}
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
          {errors?.method && <p className="text-sm text-error">{errors.method}</p>}
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="bankAccountId" className="text-sm font-medium text-foreground">
          Cuenta bancaria donde se recibió el pago
        </label>
        {method === PaymentMethod.CARD ? (
          cardBankAccount ? (
            <>
              <input type="hidden" name="bankAccountId" value={cardBankAccount.id} />
              <p
                id="bankAccountId"
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
            <p id="bankAccountId" className={fieldClass(true)}>
              No hay una cuenta bancaria configurada para pagos con tarjeta. Contacta a un
              administrador.
            </p>
          )
        ) : (
          <>
            <select
              id="bankAccountId"
              name="bankAccountId"
              defaultValue=""
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
              Cuenta donde el cliente realizó la transferencia o el depósito. El saldo de esta
              cuenta solo se actualiza cuando Contabilidad aprueba el pago.
            </p>
          </>
        )}
        {errors?.bankAccountId && <p className="text-sm text-error">{errors.bankAccountId}</p>}
      </div>

      <div className="space-y-1">
        <label htmlFor="reference" className="text-sm font-medium text-foreground">
          Referencia <span className="font-normal text-muted-foreground">(opcional)</span>
        </label>
        <input
          id="reference"
          name="reference"
          disabled={pending}
          className={fieldClass(!!errors?.reference)}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="notes" className="text-sm font-medium text-foreground">
          Observaciones <span className="font-normal text-muted-foreground">(opcional)</span>
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          disabled={pending}
          className={fieldClass(!!errors?.notes)}
        />
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
        {pending ? "Guardando…" : "Registrar pago"}
      </button>
    </form>
  );
}
