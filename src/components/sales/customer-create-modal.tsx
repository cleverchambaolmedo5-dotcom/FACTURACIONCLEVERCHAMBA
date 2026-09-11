"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ShieldAlert, UserCheck, X } from "lucide-react";
import { UserRole } from "@/generated/prisma/enums";
import type { CustomerFormState } from "@/app/(app)/clientes/actions";
import type { CustomerDuplicateCandidate } from "@/server/services/customer-service";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/shared/user-avatar";

export type NewCustomerAction = (
  state: CustomerFormState,
  formData: FormData,
) => Promise<CustomerFormState>;

export type CreatedCustomer = {
  id: string;
  fullName: string;
  phone: string;
  // Optional -- see Customer.identification in schema.prisma.
  identification: string | null;
};

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
  const duplicate = state && !state.ok ? state.duplicate : undefined;
  const canPickSeller = role !== UserRole.SELLER;

  const formRef = useRef<HTMLFormElement>(null);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);

  function handleContinueAnyway() {
    setConfirmDuplicate(true);
    const input = formRef.current?.elements.namedItem("confirmDuplicate");
    if (input instanceof HTMLInputElement) input.value = "true";
    formRef.current?.requestSubmit();
  }

  function handleUseExisting(customer: CustomerDuplicateCandidate) {
    onCreated({
      id: customer.id,
      fullName: customer.fullName,
      phone: customer.phone,
      identification: customer.identification,
    });
  }

  useEffect(() => {
    if (state?.ok) {
      onCreated({ id: state.id, fullName, phone, identification: identification || null });
    }
    // Only react to the action's result changing -- fullName/phone/
    // identification are read at that moment, not tracked as triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Rendered via a portal into document.body -- this modal's own <form>
  // must never end up nested inside the "Nueva venta" form's DOM tree
  // (invalid HTML that React can't hydrate), which is unavoidable if it
  // renders in place, since CustomerSelector lives inside that form. This
  // is why it can't use the generic <Modal> primitive (which doesn't
  // portal) -- only its visual classes are reused here.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customer-create-modal-title"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-border bg-surface p-5 shadow-modal">
        <div className="mb-4 flex items-center justify-between">
          <h3 id="customer-create-modal-title" className="text-base font-semibold text-foreground">
            Registrar nuevo cliente
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-black/[0.04] hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <form
          ref={formRef}
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
          <input type="hidden" name="confirmDuplicate" value={confirmDuplicate ? "true" : "false"} />

          <Input
            id="modal-fullName"
            name="fullName"
            label="Nombre completo"
            required
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            disabled={pending}
            error={errors?.fullName}
          />

          <Input
            id="modal-identification"
            name="identification"
            label="Identificación (cédula / RUC)"
            helperText="Opcional."
            value={identification}
            onChange={(event) => setIdentification(event.target.value)}
            disabled={pending}
            error={errors?.identification}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="modal-phone"
              name="phone"
              label="Teléfono"
              required
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              disabled={pending}
              error={errors?.phone}
            />

            <Input
              id="modal-country"
              name="country"
              label="País"
              required
              defaultValue="Ecuador"
              disabled={pending}
              error={errors?.country}
            />
          </div>

          <Input
            id="modal-email"
            name="email"
            type="email"
            label="Email"
            helperText="Opcional."
            disabled={pending}
            error={errors?.email}
          />

          <Input
            id="modal-address"
            name="address"
            label="Dirección"
            helperText="Opcional."
            disabled={pending}
          />

          {canPickSeller ? (
            <Select
              name="assignedSellerId"
              label="Vendedor responsable"
              required
              defaultValue=""
              disabled={pending}
              error={errors?.assignedSellerId}
            >
              <option value="" disabled>
                Selecciona un vendedor…
              </option>
              {sellers.map((seller) => (
                <option key={seller.id} value={seller.id}>
                  {seller.name}
                </option>
              ))}
            </Select>
          ) : (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Vendedor responsable</label>
              <p className="rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                Se te asignará automáticamente a ti ({currentUserName}).
              </p>
            </div>
          )}

          {formError && !duplicate && <p className="text-sm text-error">{formError}</p>}

          {duplicate?.kind === "blocked" && (
            <div className="flex gap-3 rounded-lg border border-error/30 bg-error-soft p-3">
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-error" aria-hidden />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-sm font-semibold text-error">{formError}</p>
                <DuplicateCandidateRow customer={duplicate.customer} onUse={handleUseExisting} />
              </div>
            </div>
          )}

          {duplicate?.kind === "warning" && (
            <div className="flex gap-3 rounded-lg border border-warning/30 bg-warning-soft p-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
              <div className="min-w-0 flex-1 space-y-3">
                <p className="text-sm font-semibold text-foreground">{formError}</p>
                <div className="space-y-2">
                  {duplicate.customers.map((customer) => (
                    <DuplicateCandidateRow key={customer.id} customer={customer} onUse={handleUseExisting} />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleContinueAnyway}
                  disabled={pending}
                  className="text-sm font-medium text-primary hover:underline disabled:opacity-60"
                >
                  Continuar con nuevo cliente de todos modos
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending} loading={pending}>
              {pending ? "Guardando…" : "Crear cliente"}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

function DuplicateCandidateRow({
  customer,
  onUse,
}: {
  customer: CustomerDuplicateCandidate;
  onUse: (customer: CustomerDuplicateCandidate) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <UserAvatar name={customer.fullName} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{customer.fullName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {customer.identification ? `${customer.identification} · ` : ""}
            {customer.phone}
            {customer.email ? ` · ${customer.email}` : ""}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onUse(customer)}
        className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        <UserCheck className="size-3.5" aria-hidden />
        Usar cliente existente
      </button>
    </div>
  );
}
