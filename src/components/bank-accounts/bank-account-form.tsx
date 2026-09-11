"use client";

import { useActionState } from "react";
import type { BankAccountFormState } from "@/app/(app)/cuentas-bancarias/actions";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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
    <Card padding="md" className="max-w-xl">
      <form action={formAction} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="bankName"
            name="bankName"
            label="Banco"
            required
            defaultValue={defaults.bankName}
            disabled={pending}
            error={errors?.bankName}
          />

          <Input
            id="alias"
            name="alias"
            label="Alias de cuenta"
            required
            defaultValue={defaults.alias}
            disabled={pending}
            error={errors?.alias}
          />
        </div>

        <Input
          id="accountHolder"
          name="accountHolder"
          label="Titular"
          required
          defaultValue={defaults.accountHolder}
          disabled={pending}
          error={errors?.accountHolder}
        />

        <Input
          id="accountNumber"
          name="accountNumber"
          label="Número de cuenta"
          required
          defaultValue={defaults.accountNumber}
          disabled={pending}
          error={errors?.accountNumber}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            id="accountType"
            name="accountType"
            label="Tipo de cuenta"
            required
            defaultValue={defaults.accountType}
            disabled={pending}
            error={errors?.accountType}
          >
            {ACCOUNT_TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>

          <Input
            id="currency"
            name="currency"
            label="Moneda"
            required
            defaultValue={defaults.currency}
            disabled={pending}
            error={errors?.currency}
          />
        </div>

        {mode === "edit" && (
          <Select
            id="active"
            name="active"
            label="Estado"
            defaultValue={defaults.active ? "true" : "false"}
            disabled={pending}
          >
            <option value="true">Activa</option>
            <option value="false">Inactiva</option>
          </Select>
        )}

        <Textarea
          id="instructions"
          name="instructions"
          label="Instrucciones"
          helperText="Opcional."
          rows={3}
          defaultValue={defaults.instructions}
          disabled={pending}
        />

        {formError && <p className="text-sm text-error">{formError}</p>}

        <Button type="submit" disabled={pending} loading={pending}>
          {pending ? "Guardando…" : submitLabel}
        </Button>
      </form>
    </Card>
  );
}
