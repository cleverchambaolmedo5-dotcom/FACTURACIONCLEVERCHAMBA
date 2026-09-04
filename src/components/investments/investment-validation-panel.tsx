"use client";

import { useActionState, useState, useTransition } from "react";
import {
  approveInvestmentAction,
  rejectInvestmentAction,
  type RejectInvestmentFormState,
} from "@/app/(app)/inversiones/actions";

function fieldClass(hasError: boolean) {
  return `w-full rounded-md border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:ring-1 ${
    hasError
      ? "border-error focus:border-error focus:ring-error"
      : "border-border focus:border-primary focus:ring-primary"
  }`;
}

// Only rendered for a still-PENDING_VALIDATION investment (see
// inversiones/[id]/page.tsx) -- both forms re-verify the role and the
// investment's current status server-side regardless. Mirrors
// PaymentValidationPanel (comprobantes module).
export function InvestmentValidationPanel({ investmentId }: { investmentId: string }) {
  const boundReject = rejectInvestmentAction.bind(null, investmentId);

  const [approveError, setApproveError] = useState<string | undefined>(undefined);
  const [approvePending, startApproveTransition] = useTransition();

  const [rejectState, rejectFormAction, rejectPending] = useActionState<
    RejectInvestmentFormState,
    FormData
  >(boundReject, undefined);

  const rejectFormError = rejectState && !rejectState.ok ? rejectState.formError : undefined;
  const rejectFieldError = rejectState && !rejectState.ok ? rejectState.errors?.reason : undefined;

  const pending = approvePending || rejectPending;

  function handleApprove() {
    setApproveError(undefined);
    startApproveTransition(async () => {
      const result = await approveInvestmentAction(investmentId);
      if (result && !result.ok) {
        setApproveError(result.formError);
      }
    });
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-3 rounded-lg border border-success/30 bg-success/5 p-4">
        <h4 className="text-sm font-semibold text-foreground">Aprobar inversión</h4>
        <p className="text-xs text-muted-foreground">
          La inversión pasará a estado Activa.
        </p>
        {approveError && <p className="text-sm text-error">{approveError}</p>}
        <button
          type="button"
          onClick={handleApprove}
          disabled={pending}
          className="rounded-md bg-success px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-60"
        >
          {approvePending ? "Aprobando…" : "Aprobar inversión"}
        </button>
      </div>

      <form action={rejectFormAction} className="space-y-3 rounded-lg border border-error/30 bg-error/5 p-4">
        <h4 className="text-sm font-semibold text-foreground">Rechazar inversión</h4>
        <div className="space-y-1">
          <label htmlFor="reason" className="text-xs font-medium text-muted-foreground">
            Motivo del rechazo
          </label>
          <textarea
            id="reason"
            name="reason"
            rows={2}
            disabled={pending}
            className={fieldClass(!!rejectFieldError)}
          />
          {rejectFieldError && <p className="text-sm text-error">{rejectFieldError}</p>}
        </div>
        {rejectFormError && <p className="text-sm text-error">{rejectFormError}</p>}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-error px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-60"
        >
          {rejectPending ? "Rechazando…" : "Rechazar inversión"}
        </button>
      </form>
    </div>
  );
}
