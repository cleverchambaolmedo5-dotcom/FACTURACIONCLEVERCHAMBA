"use client";

import { useActionState } from "react";
import type { BankAccountFormState } from "@/app/(app)/cuentas-bancarias/actions";

export type BankAccountFormAction = (
  state: BankAccountFormState,
  formData: FormData,
) => Promise<BankAccountFormState>;

export type BankAccountFormDefaults = {
  bankName: string;
  alias: string;
  accountHolder: string;
  accountType: string;
  accountNumber: string;
  currency: string;
  instructions: string;
  active: boolean;
};

const EMPTY_DEFAULTS: BankAccountFormDefaults = {
  bankName: "",
  alias: "",
  accountHolder: "",
  accountType: "Ahorros",
  accountNumber: "",
  currency: "USD",
  instructions: "",
  active: true,
};

// Common account types in this market -- accountType stays a plain string
// column (see schema.prisma) rather than an enum, so this list is just a
// UI convenience; the server never rejects a value outside of it.
const ACCOUNT_TYPE_OPTIONS = ["Ahorros", "Corriente", "Otra"];

function fieldClass(hasError: boolean) {
  return `w-full rounded-md border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:ring-1 ${
    hasError
      ? "border-error focus:border-error focus:ring-error"
      : "border-border focus:border-primary focus:ring-primary"
  }`;
}

/**
 * Shared create/edit form for the Cuentas Bancarias module, mirroring
 * ProductForm's structure. Only ever rendered for ADMIN -- the page itself
 * redirects any other role to /acceso-denegado before reaching this
 * component (see nuevo/page.tsx and [id]/editar/page.tsx), so the full,
 * unmasked account number is safe to show here. `mode="edit"` additionally
 * shows the Estado field -- creation always starts an account ACTIVE (see
 * createBankAccountForAdmin).
 */
export function BankAccountForm({
  action,
  mode,
  defaults = EMPTY_DEFAULTS,
  submitLabel,
}: {
  action: BankAccountFormAction;
  mode: "create" | "edit";
  defaults?: BankAccountFormDefaults;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<BankAccountFormState, FormData>(
    action,
    undefined,
  );
  const errors = state && !state.ok ? state.errors : undefined;
  const formError = state && !state.ok ? state.formError : undefined;

  return (
    <form action={formAction} className="max-w-xl space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="bankName" className="text-sm font-medium text-foreground">
            Banco
          </label>
          <input
            id="bankName"
            name="bankName"
            defaultValue={defaults.bankName}
            disabled={pending}
            className={fieldClass(!!errors?.bankName)}
          />
          {errors?.bankName && <p className="text-sm text-error">{errors.bankName}</p>}
        </div>

        <div className="space-y-1">
          <label htmlFor="alias" className="text-sm font-medium text-foreground">
            Alias de cuenta
          </label>
          <input
            id="alias"
            name="alias"
            defaultValue={defaults.alias}
            disabled={pending}
            className={fieldClass(!!errors?.alias)}
          />
          {errors?.alias && <p className="text-sm text-error">{errors.alias}</p>}
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="accountHolder" className="text-sm font-medium text-foreground">
          Titular
        </label>
        <input
          id="accountHolder"
          name="accountHolder"
          defaultValue={defaults.accountHolder}
          disabled={pending}
          className={fieldClass(!!errors?.accountHolder)}
        />
        {errors?.accountHolder && <p className="text-sm text-error">{errors.accountHolder}</p>}
      </div>

      <div className="space-y-1">
        <label htmlFor="accountNumber" className="text-sm font-medium text-foreground">
          Número de cuenta
        </label>
        <input
          id="accountNumber"
          name="accountNumber"
          defaultValue={defaults.accountNumber}
          disabled={pending}
          className={fieldClass(!!errors?.accountNumber)}
        />
        {errors?.accountNumber && <p className="text-sm text-error">{errors.accountNumber}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="accountType" className="text-sm font-medium text-foreground">
            Tipo de cuenta
          </label>
          <select
            id="accountType"
            name="accountType"
            defaultValue={defaults.accountType}
            disabled={pending}
            className={fieldClass(!!errors?.accountType)}
          >
            {ACCOUNT_TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          {errors?.accountType && <p className="text-sm text-error">{errors.accountType}</p>}
        </div>

        <div className="space-y-1">
          <label htmlFor="currency" className="text-sm font-medium text-foreground">
            Moneda
          </label>
          <input
            id="currency"
            name="currency"
            defaultValue={defaults.currency}
            disabled={pending}
            className={fieldClass(!!errors?.currency)}
          />
          {errors?.currency && <p className="text-sm text-error">{errors.currency}</p>}
        </div>
      </div>

      {mode === "edit" && (
        <div className="space-y-1">
          <label htmlFor="active" className="text-sm font-medium text-foreground">
            Estado
          </label>
          <select
            id="active"
            name="active"
            defaultValue={defaults.active ? "true" : "false"}
            disabled={pending}
            className={fieldClass(false)}
          >
            <option value="true">Activa</option>
            <option value="false">Inactiva</option>
          </select>
        </div>
      )}

      <div className="space-y-1">
        <label htmlFor="instructions" className="text-sm font-medium text-foreground">
          Instrucciones <span className="font-normal text-muted-foreground">(opcional)</span>
        </label>
        <textarea
          id="instructions"
          name="instructions"
          rows={3}
          defaultValue={defaults.instructions}
          disabled={pending}
          className={fieldClass(false)}
        />
      </div>

      {formError && <p className="text-sm text-error">{formError}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-dark disabled:opacity-60"
      >
        {pending ? "Guardando…" : submitLabel}
      </button>
    </form>
  );
}
