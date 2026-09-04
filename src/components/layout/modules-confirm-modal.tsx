"use client";

import { X } from "lucide-react";
import { logoutToModules } from "@/lib/auth/actions";

// Confirms before leaving the authenticated app for the module-selection
// screen ("/"), since doing so requires ending the current session (see
// logoutToModules -- it now behaves identically to the regular "Cerrar
// sesión" action, both end up on "/" via endSession()). Kept as a
// separate confirmation step here because navigating away mid-task
// deserves an "¿estás seguro?" that the header's direct "Cerrar sesión"
// button doesn't. Session/cookies are untouched unless the user
// explicitly submits the form below; closing or cancelling never calls
// logoutToModules.
export function ModulesConfirmModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modules-confirm-title"
    >
      <div className="w-full max-w-sm rounded-lg bg-surface p-5 shadow-lg">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3 id="modules-confirm-title" className="text-base font-semibold text-foreground">
            ¿Salir de la sesión actual?
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-black/[0.04] hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground">
          Para regresar a la selección de módulos deberás cerrar tu sesión actual.
        </p>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-black/[0.03]"
          >
            Cancelar
          </button>
          <form action={logoutToModules}>
            <button
              type="submit"
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-dark sm:w-auto"
            >
              Cerrar sesión y ver módulos
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
