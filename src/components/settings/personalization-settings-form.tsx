"use client";

import { useActionState } from "react";
import type { SystemSettingsModel } from "@/generated/prisma/models/SystemSettings";
import type { SettingsFormAction } from "./company-settings-form";
import type { SettingsFormState } from "@/app/(app)/configuracion/actions";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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
    <Card padding="md" className="max-w-xl">
      <form action={formAction} className="space-y-4" noValidate>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Personalización</h3>
          <p className="text-xs text-muted-foreground">Colores y preferencias regionales.</p>
        </div>

        <div className="space-y-1.5">
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
          {errors?.primaryColor && <p className="text-xs text-error">{errors.primaryColor}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            id="locale"
            name="locale"
            label="Idioma y región"
            defaultValue={settings.locale}
            disabled={pending}
            error={errors?.locale}
          >
            {LOCALE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>

          <Select
            id="timezone"
            name="timezone"
            label="Zona horaria"
            defaultValue={settings.timezone}
            disabled={pending}
            error={errors?.timezone}
          >
            {TIMEZONE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>

        {formError && <p className="text-sm text-error">{formError}</p>}
        {succeeded && <p className="text-sm text-success">Configuración guardada correctamente.</p>}

        <Button type="submit" disabled={pending} loading={pending}>
          {pending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </form>
    </Card>
  );
}
