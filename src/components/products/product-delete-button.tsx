"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteProductAction, toggleProductStatusAction } from "@/app/(app)/productos/actions";

// ADMIN-only (enforced again on the server inside deleteProductForAdmin).
// Invoked directly via useTransition, mirroring CustomerDeleteButton --
// deleting has no fields to submit, just a confirmation. When the product
// has sales attached, the server refuses and this offers "Desactivar"
// instead, right in the same dialog, rather than a dead end.
export function ProductDeleteButton({
  productId,
  active,
}: {
  productId: string;
  active: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [hasSales, setHasSales] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    setError(undefined);
    startTransition(async () => {
      const result = await deleteProductAction(productId);
      if (result && !result.ok) {
        setError(result.formError);
        setHasSales(!!result.hasSales);
        return;
      }
      setConfirmOpen(false);
    });
  }

  function handleDeactivate() {
    setError(undefined);
    startTransition(async () => {
      const result = await toggleProductStatusAction(productId);
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
          setHasSales(false);
          setConfirmOpen(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-error transition-colors hover:bg-error/10"
      >
        <Trash2 className="size-3.5" aria-hidden />
        Eliminar
      </button>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-delete-title"
        >
          <div className="w-full max-w-sm rounded-lg bg-surface p-5 shadow-lg">
            <h3 id="product-delete-title" className="text-base font-semibold text-foreground">
              ¿Eliminar producto?
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Esta acción eliminará permanentemente el producto y no se puede deshacer.
            </p>

            {error && <p className="mt-3 text-sm text-error">{error}</p>}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={pending}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-black/[0.03] disabled:opacity-60"
              >
                Cancelar
              </button>
              {hasSales && active ? (
                <button
                  type="button"
                  onClick={handleDeactivate}
                  disabled={pending}
                  className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-dark disabled:opacity-60 sm:w-auto"
                >
                  {pending ? "Desactivando…" : "Desactivar producto"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={pending}
                  className="w-full rounded-md bg-error px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-60 sm:w-auto"
                >
                  {pending ? "Eliminando…" : "Eliminar producto"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
