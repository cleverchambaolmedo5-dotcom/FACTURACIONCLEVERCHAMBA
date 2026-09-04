"use client";

import { useActionState, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { UserRole } from "@/generated/prisma/enums";
import type { CustomerFormState } from "@/app/(app)/clientes/actions";

export type NewCustomerAction = (
  state: CustomerFormState,
  formData: FormData,
) => Promise<CustomerFormState>;

export type CreatedCustomer = {
  id: string;
  fullName: string;
  phone: string;
  identification: string;
};

function fieldClass(hasError: boolean) {
  return `w-full rounded-md border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:ring-1 ${
    hasError
      ? "border-error focus:border-error focus:ring-error"
      : "border-border focus:border-primary focus:ring-primary"
  }`;
}

// Rendered only while the "Nueva venta" screen's quick-create modal is
// open (see customer-selector.tsx) -- mounting/unmounting it is what
// resets useActionState's internal result between openings, so a
// previous success doesn't leak into the next attempt.
export function CustomerCreateModal({
  onClose,
  onCreated,
  action,
  role,
  sellers,
  currentUserName,
}: {
  onClose: () => void;
  onCreated: (customer: CreatedCustomer) => void;
  action: NewCustomerAction;
  role: UserRole;
  sellers: { id: string; name: string }[];
  currentUserName: string;
}) {
  const [state, formAction, pending] = useActionState<CustomerFormState, FormData>(
    action,
    undefined,
  );
  // Tracked locally (in addition to being submitted via the form) so the
  // newly-created customer can be handed straight to the sale form's
  // selector without a second round-trip to fetch it back.
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [identification, setIdentification] = useState("");
  const errors = state && !state.ok ? state.errors : undefined;
  const formError = state && !state.ok ? state.formError : undefined;
  const canPickSeller = role !== UserRole.SELLER;

  useEffect(() => {
    if (state?.ok) {
      onCreated({ id: state.id, fullName, phone, identification });
    }
    // Only react to the action's result changing -- fullName/phone/
    // identification are read at that moment, not tracked as triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Rendered via a portal into document.body -- this modal's own <form>
  // must never end up nested inside the "Nueva venta" form's DOM tree
  // (invalid HTML that React can't hydrate), which is unavoidable if it
  // renders in place, since CustomerSelector lives inside that form.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-create-modal-title"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-surface p-5 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 id="customer-create-modal-title" className="text-base font-semibold text-foreground">
            Registrar nuevo cliente
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1 text-muted-foreground hover:bg-black/[0.04] hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <form
          action={formAction}
          // Rendered via a portal, but still a React-tree descendant of the
          // "Nueva venta" <form> -- its submit event bubbles through that
          // tree (not the DOM tree) and would otherwise reach the sale
          // form's onSubmit, whose receipt-file check calls
          // preventDefault() and silently cancels this form's own submit.
          onSubmit={(event) => event.stopPropagation()}
          className="space-y-4"
          noValidate
        >
          <div className="space-y-1">
            <label htmlFor="modal-fullName" className="text-sm font-medium text-foreground">
              Nombre completo
            </label>
            <input
              id="modal-fullName"
              name="fullName"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              disabled={pending}
              className={fieldClass(!!errors?.fullName)}
            />
            {errors?.fullName && <p className="text-sm text-error">{errors.fullName}</p>}
          </div>

          <div className="space-y-1">
            <label htmlFor="modal-identification" className="text-sm font-medium text-foreground">
              Identificación (cédula / RUC)
            </label>
            <input
              id="modal-identification"
              name="identification"
              value={identification}
              onChange={(event) => setIdentification(event.target.value)}
              disabled={pending}
              className={fieldClass(!!errors?.identification)}
            />
            {errors?.identification && (
              <p className="text-sm text-error">{errors.identification}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="modal-phone" className="text-sm font-medium text-foreground">
                Teléfono
              </label>
              <input
                id="modal-phone"
                name="phone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                disabled={pending}
                className={fieldClass(!!errors?.phone)}
              />
              {errors?.phone && <p className="text-sm text-error">{errors.phone}</p>}
            </div>

            <div className="space-y-1">
              <label htmlFor="modal-country" className="text-sm font-medium text-foreground">
                País
              </label>
              <input
                id="modal-country"
                name="country"
                defaultValue="Ecuador"
                disabled={pending}
                className={fieldClass(!!errors?.country)}
              />
              {errors?.country && <p className="text-sm text-error">{errors.country}</p>}
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="modal-email" className="text-sm font-medium text-foreground">
              Email <span className="font-normal text-muted-foreground">(opcional)</span>
            </label>
            <input
              id="modal-email"
              name="email"
              type="email"
              disabled={pending}
              className={fieldClass(!!errors?.email)}
            />
            {errors?.email && <p className="text-sm text-error">{errors.email}</p>}
          </div>

          <div className="space-y-1">
            <label htmlFor="modal-address" className="text-sm font-medium text-foreground">
              Dirección <span className="font-normal text-muted-foreground">(opcional)</span>
            </label>
            <input
              id="modal-address"
              name="address"
              disabled={pending}
              className={fieldClass(false)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-foreground">Vendedor responsable</label>
            {canPickSeller ? (
              <>
                <select
                  name="assignedSellerId"
                  defaultValue=""
                  disabled={pending}
                  className={fieldClass(!!errors?.assignedSellerId)}
                >
                  <option value="" disabled>
                    Selecciona un vendedor…
                  </option>
                  {sellers.map((seller) => (
                    <option key={seller.id} value={seller.id}>
                      {seller.name}
                    </option>
                  ))}
                </select>
                {errors?.assignedSellerId && (
                  <p className="text-sm text-error">{errors.assignedSellerId}</p>
                )}
              </>
            ) : (
              <p className="rounded-md border border-border bg-black/[0.02] px-3 py-2 text-sm text-muted-foreground">
                Se te asignará automáticamente a ti ({currentUserName}).
              </p>
            )}
          </div>

          {formError && <p className="text-sm text-error">{formError}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-black/[0.03] disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-dark disabled:opacity-60"
            >
              {pending ? "Guardando…" : "Crear cliente"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
