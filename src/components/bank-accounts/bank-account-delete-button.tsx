"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteBankAccountAction, toggleBankAccountStatusAction } from "@/app/(app)/cuentas-bancarias/actions";
import { Button } from "@/components/ui/button";

// ADMIN-only (enforced again on the server inside deleteBankAccountForAdmin).
// Invoked directly via useTransition, mirroring ProductDeleteButton --
// deleting has no fields to submit, just a confirmation. When the account
// has payments attached, the server refuses and this offers "Desactivar"
// instead, right in the same dialog, rather than a dead end.
export function BankAccountDeleteButton({
  bankAccountId,
  active,
}: {
  bankAccountId: string;
  active: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [hasPayments, setHasPayments] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    setError(undefined);
    startTransition(async () => {
      const result = await deleteBankAccountAction(bankAccountId);
      if (result && !result.ok) {
        setError(result.formError);
        setHasPayments(!!result.hasPayments);
        return;
      }
      setConfirmOpen(false);
    });
  }

  function handleDeactivate() {
    setError(undefined);
    startTransition(async () => {
      const result = await toggleBankAccountStatusAction(bankAccountId);
      if (result && !result.ok) {
        setError(result.formError);
        return;
      }
      setConfirmOpen(false);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(undefined);
          setHasPayments(false);
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
          aria-labelledby="bank-account-delete-title"
        >
          <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-modal">
            <h3 id="bank-account-delete-title" className="text-base font-semibold text-foreground">
              ¿Eliminar cuenta bancaria?
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Esta acción eliminará permanentemente la cuenta bancaria y no se puede deshacer.
            </p>

            {error && <p className="mt-3 text-sm text-error">{error}</p>}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setConfirmOpen(false)} disabled={pending}>
                Cancelar
              </Button>
              {hasPayments && active ? (
                <Button type="button" onClick={handleDeactivate} disabled={pending} loading={pending} className="w-full sm:w-auto">
                  {pending ? "Desactivando…" : "Desactivar cuenta"}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="danger"
                  onClick={handleDelete}
                  disabled={pending}
                  loading={pending}
                  className="w-full sm:w-auto"
                >
                  {pending ? "Eliminando…" : "Eliminar cuenta"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
