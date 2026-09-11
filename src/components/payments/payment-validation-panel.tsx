"use client";

import { useActionState, useState, useTransition } from "react";
import {
  approvePaymentAction,
  rejectPaymentAction,
  type RejectPaymentFormState,
} from "@/app/(app)/comprobantes/actions";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Only rendered for a still-PENDING_VALIDATION payment (see
// comprobantes/[id]/page.tsx) -- both forms re-verify the role and the
// payment's current status server-side regardless, this is just the UI
// for the one place a validation decision can be made.
export function PaymentValidationPanel({ paymentId }: { paymentId: string }) {
  const boundReject = rejectPaymentAction.bind(null, paymentId);

  const [approveError, setApproveError] = useState<string | undefined>(undefined);
  const [approvePending, startApproveTransition] = useTransition();

  const [rejectState, rejectFormAction, rejectPending] = useActionState<
    RejectPaymentFormState,
    FormData
  >(boundReject, undefined);

  const rejectFormError = rejectState && !rejectState.ok ? rejectState.formError : undefined;
  const rejectFieldError = rejectState && !rejectState.ok ? rejectState.errors?.reason : undefined;

  const pending = approvePending || rejectPending;

  function handleApprove() {
    setApproveError(undefined);
    startApproveTransition(async () => {
      const result = await approvePaymentAction(paymentId);
      if (result && !result.ok) {
        setApproveError(result.formError);
      }
    });
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card padding="md" className="space-y-3 border-success/30 bg-success-soft">
        <h4 className="text-sm font-semibold text-foreground">Aprobar pago</h4>
        <p className="text-xs text-muted-foreground">
          El monto pasará a contar como pagado aprobado y reducirá el saldo de la cuota.
        </p>
        {approveError && <p className="text-sm text-error">{approveError}</p>}
        <Button type="button" variant="primary" className="bg-success hover:bg-success/90" onClick={handleApprove} disabled={pending} loading={approvePending}>
          {approvePending ? "Aprobando…" : "Aprobar pago"}
        </Button>
      </Card>

      <Card padding="md" className="space-y-3 border-error/30 bg-error-soft">
        <form action={rejectFormAction} className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground">Rechazar pago</h4>
          <Textarea
            id="reason"
            name="reason"
            label="Motivo del rechazo"
            rows={2}
            disabled={pending}
            error={rejectFieldError}
          />
          {rejectFormError && <p className="text-sm text-error">{rejectFormError}</p>}
          <Button type="submit" variant="danger" disabled={pending} loading={rejectPending}>
            {rejectPending ? "Rechazando…" : "Rechazar pago"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
