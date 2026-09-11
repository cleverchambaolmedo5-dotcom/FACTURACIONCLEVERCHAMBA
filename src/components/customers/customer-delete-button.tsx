"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteCustomerAction } from "@/app/(app)/clientes/actions";
import { Button } from "@/components/ui/button";

// ADMIN-only (enforced again on the server inside deleteCustomerForUser --
// this component only controls whether the button/dialog render). Invoked
// directly via useTransition, mirroring ToggleUserStatusButton -- deleting
// has no fields to submit, just a confirmation.
export function CustomerDeleteButton({
  customerId,
  redirectTo,
}: {
  customerId: string;
  // When set (e.g. from the edit page), navigates there on success instead
  // of relying on the table's own revalidation.
  redirectTo?: string;
}) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    setError(undefined);
    startTransition(async () => {
      const result = await deleteCustomerAction(customerId);
      if (result && !result.ok) {
        setError(result.formError);
        return;
      }
      setConfirmOpen(false);
      if (redirectTo) {
        router.push(redirectTo);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(undefined);
          setConfirmOpen(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-error transition-colors hover:bg-error-soft"
      >
        <Trash2 className="size-3.5" aria-hidden />
        Eliminar
      </button>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="customer-delete-title"
        >
          <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-modal">
            <h3 id="customer-delete-title" className="text-base font-semibold text-foreground">
              ¿Eliminar cliente?
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Esta acción eliminará permanentemente al cliente y no se puede deshacer.
            </p>

            {error && <p className="mt-3 text-sm text-error">{error}</p>}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setConfirmOpen(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleConfirm}
                disabled={pending}
                loading={pending}
                className="w-full sm:w-auto"
              >
                {pending ? "Eliminando…" : "Eliminar cliente"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
