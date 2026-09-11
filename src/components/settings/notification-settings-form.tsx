"use client";

import { useActionState } from "react";
import type { SystemSettingsModel } from "@/generated/prisma/models/SystemSettings";
import type { SettingsFormAction } from "./company-settings-form";
import type { SettingsFormState } from "@/app/(app)/configuracion/actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function NotificationSettingsForm({
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
          <h3 className="text-sm font-semibold text-foreground">Notificaciones</h3>
          <p className="text-xs text-muted-foreground">
            Preferencias de alertas y avisos del sistema.
          </p>
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              name="notifyOnNewSale"
              defaultChecked={settings.notifyOnNewSale}
              disabled={pending}
              className="size-4 rounded border-border accent-primary"
            />
            Notificar cuando se registre una nueva venta
          </label>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              name="notifyOnPaymentDue"
              defaultChecked={settings.notifyOnPaymentDue}
              disabled={pending}
              className="size-4 rounded border-border accent-primary"
            />
            Notificar cuando una cuota esté próxima a vencer
          </label>

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              name="notifyOnOverduePayment"
              defaultChecked={settings.notifyOnOverduePayment}
              disabled={pending}
              className="size-4 rounded border-border accent-primary"
            />
            Notificar cuando una cuota esté vencida
          </label>
        </div>

        <Input
          id="reminderDaysBefore"
          name="reminderDaysBefore"
          type="number"
          label="Días de anticipación para el recordatorio"
          min={0}
          defaultValue={settings.reminderDaysBefore}
          disabled={pending}
          error={errors?.reminderDaysBefore}
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
