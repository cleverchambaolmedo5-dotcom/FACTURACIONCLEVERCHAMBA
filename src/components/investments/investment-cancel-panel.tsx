"use client";

import { useActionState, useState } from "react";
import {
  cancelInvestmentAction,
  type CancelInvestmentFormState,
} from "@/app/(app)/inversiones/actions";

function fieldClass(hasError: boolean) {
  return `w-full rounded-md border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:ring-1 ${
    hasError
      ? "border-error focus:border-error focus:ring-error"
      : "border-border focus:border-primary focus:ring-primary"
  }`;
}

function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}

// ADMIN-only, only rendered for an ACTIVE investment (see
// inversiones/[id]/page.tsx). This phase only records the cancellation
// decision (status, reason, date, responsible user) -- it does not compute
// or move any settlement amount, which is a later phase.
export function InvestmentCancelPanel({ investmentId }: { investmentId: string }) {
  const boundCancel = cancelInvestmentAction.bind(null, investmentId);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [state, formAction, pending] = useActionState<CancelInvestmentFormState, FormData>(
    boundCancel,
    undefined,
  );

  const formError = state && !state.ok ? state.formError : undefined;
  const reasonError = state && !state.ok ? state.errors?.reason : undefined;
  const dateError = state && !state.ok ? state.errors?.cancelledAt : undefined;

  if (!confirmOpen) {
    return (
      <div className="rounded-lg border border-error/30 bg-error/5 p-4">
        <h4 className="text-sm font-semibold text-foreground">Cancelación anticipada</h4>
        <p className="mt-1 text-xs text-muted-foreground">
          Cancela esta inversión antes de su vencimiento. Requiere un motivo obligatorio.
        </p>
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          className="mt-3 rounded-md border border-error px-4 py-2 text-sm font-medium text-error transition-colors hover:bg-error/10"
        >
          Cancelar inversión
        </button>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-lg border border-error/30 bg-error/5 p-4"
    >
      <h4 className="text-sm font-semibold text-foreground">Confirmar cancelación anticipada</h4>

      <div className="space-y-1">
        <label htmlFor="cancelledAt" className="text-xs font-medium text-muted-foreground">
          Fecha de cancelación
        </label>
        <input
          id="cancelledAt"
          name="cancelledAt"
          type="date"
          defaultValue={todayDateOnly()}
          disabled={pending}
          className={fieldClass(!!dateError)}
        />
        {dateError && <p className="text-sm text-error">{dateError}</p>}
      </div>

      <div className="space-y-1">
        <label htmlFor="cancelReason" className="text-xs font-medium text-muted-foreground">
          Motivo de la cancelación
        </label>
        <textarea
          id="cancelReason"
          name="reason"
          rows={2}
          disabled={pending}
          className={fieldClass(!!reasonError)}
        />
        {reasonError && <p className="text-sm text-error">{reasonError}</p>}
      </div>

      {formError && <p className="text-sm text-error">{formError}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setConfirmOpen(false)}
          disabled={pending}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-black/[0.03] disabled:opacity-60"
        >
          Volver
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-error px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Cancelando…" : "Confirmar cancelación"}
        </button>
      </div>
    </form>
  );
}
