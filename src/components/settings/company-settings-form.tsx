"use client";

import { useActionState } from "react";
import type { SystemSettingsModel } from "@/generated/prisma/models/SystemSettings";
import type { SettingsFormState } from "@/app/(app)/configuracion/actions";

export type SettingsFormAction = (
  state: SettingsFormState,
  formData: FormData,
) => Promise<SettingsFormState>;

function fieldClass(hasError: boolean) {
  return `w-full rounded-md border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:ring-1 ${
    hasError
      ? "border-error focus:border-error focus:ring-error"
      : "border-border focus:border-primary focus:ring-primary"
  }`;
}

export function CompanySettingsForm({
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
        <h3 className="text-sm font-semibold text-foreground">Datos de la empresa</h3>
        <p className="text-xs text-muted-foreground">
          Información general de la empresa, datos fiscales y contacto.
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="companyName" className="text-sm font-medium text-foreground">
          Nombre de la empresa
        </label>
        <input
          id="companyName"
          name="companyName"
          defaultValue={settings.companyName}
          disabled={pending}
          className={fieldClass(!!errors?.companyName)}
        />
        {errors?.companyName && <p className="text-sm text-error">{errors.companyName}</p>}
      </div>

      <div className="space-y-1">
        <label htmlFor="companyTaxId" className="text-sm font-medium text-foreground">
          RUC / Identificación fiscal{" "}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </label>
        <input
          id="companyTaxId"
          name="companyTaxId"
          defaultValue={settings.companyTaxId}
          disabled={pending}
          className={fieldClass(!!errors?.companyTaxId)}
        />
        {errors?.companyTaxId && <p className="text-sm text-error">{errors.companyTaxId}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="companyEmail" className="text-sm font-medium text-foreground">
            Correo de contacto <span className="font-normal text-muted-foreground">(opcional)</span>
          </label>
          <input
            id="companyEmail"
            name="companyEmail"
            type="email"
            defaultValue={settings.companyEmail}
            disabled={pending}
            className={fieldClass(!!errors?.companyEmail)}
          />
          {errors?.companyEmail && <p className="text-sm text-error">{errors.companyEmail}</p>}
        </div>

        <div className="space-y-1">
          <label htmlFor="companyPhone" className="text-sm font-medium text-foreground">
            Teléfono <span className="font-normal text-muted-foreground">(opcional)</span>
          </label>
          <input
            id="companyPhone"
            name="companyPhone"
            defaultValue={settings.companyPhone}
            disabled={pending}
            className={fieldClass(!!errors?.companyPhone)}
          />
          {errors?.companyPhone && <p className="text-sm text-error">{errors.companyPhone}</p>}
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="companyAddress" className="text-sm font-medium text-foreground">
          Dirección <span className="font-normal text-muted-foreground">(opcional)</span>
        </label>
        <input
          id="companyAddress"
          name="companyAddress"
          defaultValue={settings.companyAddress}
          disabled={pending}
          className={fieldClass(!!errors?.companyAddress)}
        />
        {errors?.companyAddress && <p className="text-sm text-error">{errors.companyAddress}</p>}
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
