"use client";

import { useActionState } from "react";
import type { SystemSettingsModel } from "@/generated/prisma/models/SystemSettings";
import type { SettingsFormAction } from "./company-settings-form";
import type { SettingsFormState } from "@/app/(app)/configuracion/actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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
    <Card padding="md" className="max-w-xl">
      <form action={formAction} className="space-y-4" noValidate>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Configuración de ventas</h3>
          <p className="text-xs text-muted-foreground">
            Preferencias predeterminadas para nuevas ventas.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="saleDefaultCurrency"
            name="saleDefaultCurrency"
            label="Moneda predeterminada"
            defaultValue={settings.saleDefaultCurrency}
            disabled={pending}
            error={errors?.saleDefaultCurrency}
          />

          <Input
            id="saleMaxInstallments"
            name="saleMaxInstallments"
            type="number"
            label="Número de cuotas predeterminado"
            min={1}
            max={3}
            defaultValue={settings.saleMaxInstallments}
            disabled={pending}
            error={errors?.saleMaxInstallments}
          />
        </div>

        <Input
          id="salePaymentTermDays"
          name="salePaymentTermDays"
          type="number"
          label="Plazo predeterminado para la primera cuota (días)"
          min={1}
          defaultValue={settings.salePaymentTermDays}
          disabled={pending}
          error={errors?.salePaymentTermDays}
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
