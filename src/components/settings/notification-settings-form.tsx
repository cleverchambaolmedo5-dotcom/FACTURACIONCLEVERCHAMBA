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
    <form
      action={formAction}
      className="max-w-xl space-y-6 rounded-lg border border-border bg-surface p-6"
      noValidate
    >
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

      <div className="space-y-1">
        <label htmlFor="reminderDaysBefore" className="text-sm font-medium text-foreground">
          Días de anticipación para el recordatorio
        </label>
        <input
          id="reminderDaysBefore"
          name="reminderDaysBefore"
          type="number"
          min={0}
          defaultValue={settings.reminderDaysBefore}
          disabled={pending}
          className={fieldClass(!!errors?.reminderDaysBefore)}
        />
        {errors?.reminderDaysBefore && (
          <p className="text-sm text-error">{errors.reminderDaysBefore}</p>
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
