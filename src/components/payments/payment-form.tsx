"use client";

import { useActionState, useRef, useState, type FormEvent } from "react";
import { PaymentMethod } from "@/generated/prisma/enums";
import type { PaymentFormState } from "@/app/(app)/pagos/actions";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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
    <Card padding="md">
      <form
        id="registrar-pago"
        action={formAction}
        onSubmit={handleSubmit}
        encType="multipart/form-data"
        className="max-w-md space-y-4"
        noValidate
      >
        <Input
          id="amount"
          name="amount"
          type="number"
          label="Monto"
          min="0.01"
          step="0.01"
          max={(balanceCents / 100).toFixed(2)}
          disabled={pending}
          error={errors?.amount}
          helperText={
            errors?.amount ? undefined : `Saldo pendiente: ${currencyFormatter.format(balanceCents / 100)}`
          }
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="paymentDate"
            name="paymentDate"
            type="date"
            label="Fecha de pago"
            defaultValue={defaultPaymentDate}
            disabled={pending}
            error={errors?.paymentDate}
          />

          <Select
            id="method"
            name="method"
            label="Método de pago"
            value={method}
            onChange={(event) => setMethod(event.target.value as PaymentMethod)}
            disabled={pending}
            error={errors?.method}
          >
            <option value="" disabled>
              Selecciona un método…
            </option>
            {Object.values(PaymentMethod).map((method) => (
              <option key={method} value={method}>
                {METHOD_LABELS[method]}
              </option>
            ))}
          </Select>
        </div>

        {method === PaymentMethod.CARD ? (
          <div className="space-y-1.5">
            <label htmlFor="bankAccountId" className="text-sm font-medium text-foreground">
              Cuenta bancaria donde se recibió el pago
            </label>
            {cardBankAccount ? (
              <>
                <input type="hidden" name="bankAccountId" value={cardBankAccount.id} />
                <p
                  id="bankAccountId"
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                >
                  {cardBankAccount.bankName} — {cardBankAccount.alias} (
                  {maskAccountNumber(cardBankAccount.accountNumber)})
                </p>
                <p className="text-xs text-muted-foreground">
                  Los pagos con tarjeta siempre se acreditan a esta cuenta.
                </p>
              </>
            ) : (
              <p id="bankAccountId" className="rounded-md border border-error bg-error-soft px-3 py-2 text-sm text-error">
                No hay una cuenta bancaria configurada para pagos con tarjeta. Contacta a un
                administrador.
              </p>
            )}
          </div>
        ) : (
          <Select
            id="bankAccountId"
            name="bankAccountId"
            label="Cuenta bancaria donde se recibió el pago"
            defaultValue=""
            disabled={pending}
            error={errors?.bankAccountId}
            helperText={
              errors?.bankAccountId
                ? undefined
                : "Cuenta donde el cliente realizó la transferencia o el depósito. El saldo de esta cuenta solo se actualiza cuando Contabilidad aprueba el pago."
            }
          >
            <option value="" disabled>
              Selecciona una cuenta bancaria…
            </option>
            {bankAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.bankName} — {account.alias} ({maskAccountNumber(account.accountNumber)})
              </option>
            ))}
          </Select>
        )}

        <Input
          id="reference"
          name="reference"
          label="Referencia"
          helperText="Opcional."
          disabled={pending}
          error={errors?.reference}
        />

        <Textarea
          id="notes"
          name="notes"
          label="Observaciones"
          helperText="Opcional."
          rows={2}
          disabled={pending}
          error={errors?.notes}
        />

        <Input
          ref={receiptInputRef}
          id="receipt"
          name="receipt"
          type="file"
          label="Adjuntar comprobante"
          required
          accept="application/pdf,image/jpeg,image/jpg,image/png,image/webp"
          disabled={pending}
          onChange={() => setReceiptClientError(null)}
          error={receiptError}
          helperText={receiptError ? undefined : "PDF, JPG, PNG o WEBP. Máximo 5 MB."}
        />

        {formError && <p className="text-sm text-error">{formError}</p>}

        <Button type="submit" disabled={pending} loading={pending}>
          {pending ? "Guardando…" : "Registrar pago"}
        </Button>
      </form>
    </Card>
  );
}
