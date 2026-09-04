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

const LOCALE_OPTIONS = [
  { value: "es-EC", label: "Español (Ecuador)" },
  { value: "es-CO", label: "Español (Colombia)" },
  { value: "es-MX", label: "Español (México)" },
  { value: "en-US", label: "English (US)" },
];

const TIMEZONE_OPTIONS = [
  { value: "America/Guayaquil", label: "Guayaquil (UTC-5)" },
  { value: "America/Bogota", label: "Bogotá (UTC-5)" },
  { value: "America/Mexico_City", label: "Ciudad de México (UTC-6)" },
  { value: "America/New_York", label: "Nueva York (UTC-5/-4)" },
];

export function PersonalizationSettingsForm({
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
        <h3 className="text-sm font-semibold text-foreground">Personalización</h3>
        <p className="text-xs text-muted-foreground">Colores y preferencias regionales.</p>
      </div>

      <div className="space-y-1">
        <label htmlFor="primaryColor" className="text-sm font-medium text-foreground">
          Color principal
        </label>
        <input
          id="primaryColor"
          name="primaryColor"
          type="color"
          defaultValue={settings.primaryColor}
          disabled={pending}
          className="h-9 w-20 cursor-pointer rounded-md border border-border bg-surface p-1"
        />
        {errors?.primaryColor && <p className="text-sm text-error">{errors.primaryColor}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="locale" className="text-sm font-medium text-foreground">
            Idioma y región
          </label>
          <select
            id="locale"
            name="locale"
            defaultValue={settings.locale}
            disabled={pending}
            className={fieldClass(!!errors?.locale)}
          >
            {LOCALE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors?.locale && <p className="text-sm text-error">{errors.locale}</p>}
        </div>

        <div className="space-y-1">
          <label htmlFor="timezone" className="text-sm font-medium text-foreground">
            Zona horaria
          </label>
          <select
            id="timezone"
            name="timezone"
            defaultValue={settings.timezone}
            disabled={pending}
            className={fieldClass(!!errors?.timezone)}
          >
            {TIMEZONE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {errors?.timezone && <p className="text-sm text-error">{errors.timezone}</p>}
        </div>
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
