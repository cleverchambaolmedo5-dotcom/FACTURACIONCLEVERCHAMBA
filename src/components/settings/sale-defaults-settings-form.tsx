"use client";

import { useActionState } from "react";
import type { SystemSettingsModel } from "@/generated/prisma/models/SystemSettings";
import type { SettingsFormAction } from "./company-settings-form";
import type { SettingsFormState } from "@/app/(app)/configuracion/actions";

function fieldClass(hasError: boolean) {
  return `w-full rounded-md border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:ring-1 ${
    hasError
      ? "border-error focus:border-error focus:ring-error"
      : "border-border focus:border-primary focus:ring-primary"
  }`;
}

export function SaleDefaultsSettingsForm({
  action,
  settings,
}: {
  action: SettingsFormAction;
  settings: SystemSettingsModel;
}) {
  const [state, formAction, pending] = useActionState<SettingsFormState, FormData>(action, undefined);
  const errors = state && !state.ok ? state.errors : undefined;
  const formError = state && !state.ok ? state.formError : undefined;
  const succeeded = state?.ok === true;

  return (
    <form
      action={formAction}
      className="max-w-xl space-y-6 rounded-lg border border-border bg-surface p-6"
      noValidate
    >
      <div>
        <h3 className="text-sm font-semibold text-foreground">Configuración de ventas</h3>
        <p className="text-xs text-muted-foreground">
          Preferencias predeterminadas para nuevas ventas.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="saleDefaultCurrency" className="text-sm font-medium text-foreground">
            Moneda predeterminada
          </label>
          <input
            id="saleDefaultCurrency"
            name="saleDefaultCurrency"
            defaultValue={settings.saleDefaultCurrency}
            disabled={pending}
            className={fieldClass(!!errors?.saleDefaultCurrency)}
          />
          {errors?.saleDefaultCurrency && (
            <p className="text-sm text-error">{errors.saleDefaultCurrency}</p>
          )}
        </div>

        <div className="space-y-1">
          <label htmlFor="saleMaxInstallments" className="text-sm font-medium text-foreground">
            Número de cuotas predeterminado
          </label>
          <input
            id="saleMaxInstallments"
            name="saleMaxInstallments"
            type="number"
            min={1}
            max={3}
            defaultValue={settings.saleMaxInstallments}
            disabled={pending}
            className={fieldClass(!!errors?.saleMaxInstallments)}
          />
          {errors?.saleMaxInstallments && (
            <p className="text-sm text-error">{errors.saleMaxInstallments}</p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="salePaymentTermDays" className="text-sm font-medium text-foreground">
          Plazo predeterminado para la primera cuota (días)
        </label>
        <input
          id="salePaymentTermDays"
          name="salePaymentTermDays"
          type="number"
          min={1}
          defaultValue={settings.salePaymentTermDays}
          disabled={pending}
          className={fieldClass(!!errors?.salePaymentTermDays)}
        />
        {errors?.salePaymentTermDays && (
          <p className="text-sm text-error">{errors.salePaymentTermDays}</p>
        )}
      </div>

      {formError && <p className="text-sm text-error">{formError}</p>}
      {succeeded && <p className="text-sm text-success">Configuración guardada correctamente.</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-dark disabled:opacity-60"
      >
        {pending ? "Guardando…" : "Guardar cambios"}
      </button>
    </form>
  );
}
