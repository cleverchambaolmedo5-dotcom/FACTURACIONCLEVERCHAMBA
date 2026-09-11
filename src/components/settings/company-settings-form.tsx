"use client";

import { useActionState } from "react";
import type { SystemSettingsModel } from "@/generated/prisma/models/SystemSettings";
import type { SettingsFormState } from "@/app/(app)/configuracion/actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export type SettingsFormAction = (
  state: SettingsFormState,
  formData: FormData,
) => Promise<SettingsFormState>;

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
    <Card padding="md" className="max-w-xl">
      <form action={formAction} className="space-y-4" noValidate>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Datos de la empresa</h3>
          <p className="text-xs text-muted-foreground">
            Información general de la empresa, datos fiscales y contacto.
          </p>
        </div>

        <Input
          id="companyName"
          name="companyName"
          label="Nombre de la empresa"
          defaultValue={settings.companyName}
          disabled={pending}
          error={errors?.companyName}
        />

        <Input
          id="companyTaxId"
          name="companyTaxId"
          label="RUC / Identificación fiscal (opcional)"
          defaultValue={settings.companyTaxId}
          disabled={pending}
          error={errors?.companyTaxId}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="companyEmail"
            name="companyEmail"
            type="email"
            label="Correo de contacto (opcional)"
            defaultValue={settings.companyEmail}
            disabled={pending}
            error={errors?.companyEmail}
          />

          <Input
            id="companyPhone"
            name="companyPhone"
            label="Teléfono (opcional)"
            defaultValue={settings.companyPhone}
            disabled={pending}
            error={errors?.companyPhone}
          />
        </div>

        <Input
          id="companyAddress"
          name="companyAddress"
          label="Dirección (opcional)"
          defaultValue={settings.companyAddress}
          disabled={pending}
          error={errors?.companyAddress}
        />

        {formError && <p className="text-sm text-error">{formError}</p>}
        {succeeded && <p className="text-sm text-success">Configuración guardada correctamente.</p>}

        <Button type="submit" disabled={pending} loading={pending}>
          {pending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </form>
    </Card>
  );
}
