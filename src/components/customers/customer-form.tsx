"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { UserRole } from "@/generated/prisma/enums";
import type { CustomerFormState } from "@/app/(app)/clientes/actions";
import type { CustomerDuplicateCandidate } from "@/server/services/customer-service";

export type CustomerFormAction = (
  state: CustomerFormState,
  formData: FormData,
) => Promise<CustomerFormState>;

export type CustomerFormDefaults = {
  fullName: string;
  identification: string;
  phone: string;
  email: string;
  country: string;
  address: string;
  assignedSellerId: string;
};

const EMPTY_DEFAULTS: CustomerFormDefaults = {
  fullName: "",
  identification: "",
  phone: "",
  email: "",
  country: "Ecuador",
  address: "",
  assignedSellerId: "",
};

function fieldClass(hasError: boolean) {
  return `w-full rounded-md border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:ring-1 ${
    hasError
      ? "border-error focus:border-error focus:ring-error"
      : "border-border focus:border-primary focus:ring-primary"
  }`;
}

export function CustomerForm({
  action,
  role,
  sellers,
  currentUserName,
  defaults = EMPTY_DEFAULTS,
  submitLabel,
}: {
  action: CustomerFormAction;
  role: UserRole;
  sellers: { id: string; name: string }[];
  currentUserName: string;
  defaults?: CustomerFormDefaults;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<CustomerFormState, FormData>(
    action,
    undefined,
  );
  const errors = state && !state.ok ? state.errors : undefined;
  const formError = state && !state.ok ? state.formError : undefined;
  const duplicate = state && !state.ok ? state.duplicate : undefined;
  const canPickSeller = role !== UserRole.SELLER;

  const formRef = useRef<HTMLFormElement>(null);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);

  function handleContinueAnyway() {
    setConfirmDuplicate(true);
    // Set synchronously via the DOM too -- the state update above won't
    // have re-rendered the hidden input's value yet when requestSubmit()
    // reads the form.
    const input = formRef.current?.elements.namedItem("confirmDuplicate");
    if (input instanceof HTMLInputElement) input.value = "true";
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={formAction} className="max-w-xl space-y-4" noValidate>
      <input type="hidden" name="confirmDuplicate" value={confirmDuplicate ? "true" : "false"} />
      <div className="space-y-1">
        <label htmlFor="fullName" className="text-sm font-medium text-foreground">
          Nombre completo
        </label>
        <input
          id="fullName"
          name="fullName"
          defaultValue={defaults.fullName}
          disabled={pending}
          className={fieldClass(!!errors?.fullName)}
        />
        {errors?.fullName && <p className="text-sm text-error">{errors.fullName}</p>}
      </div>

      <div className="space-y-1">
        <label htmlFor="identification" className="text-sm font-medium text-foreground">
          Identificación (cédula / RUC){" "}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </label>
        <input
          id="identification"
          name="identification"
          defaultValue={defaults.identification}
          disabled={pending}
          className={fieldClass(!!errors?.identification)}
        />
        {errors?.identification && (
          <p className="text-sm text-error">{errors.identification}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="phone" className="text-sm font-medium text-foreground">
            Teléfono
          </label>
          <input
            id="phone"
            name="phone"
            defaultValue={defaults.phone}
            disabled={pending}
            className={fieldClass(!!errors?.phone)}
          />
          {errors?.phone && <p className="text-sm text-error">{errors.phone}</p>}
        </div>

        <div className="space-y-1">
          <label htmlFor="country" className="text-sm font-medium text-foreground">
            País
          </label>
          <input
            id="country"
            name="country"
            defaultValue={defaults.country}
            disabled={pending}
            className={fieldClass(!!errors?.country)}
          />
          {errors?.country && <p className="text-sm text-error">{errors.country}</p>}
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium text-foreground">
          Email <span className="font-normal text-muted-foreground">(opcional)</span>
        </label>
        <input
          id="email"
          name="email"
          type="email"
          defaultValue={defaults.email}
          disabled={pending}
          className={fieldClass(!!errors?.email)}
        />
        {errors?.email && <p className="text-sm text-error">{errors.email}</p>}
      </div>

      <div className="space-y-1">
        <label htmlFor="address" className="text-sm font-medium text-foreground">
          Dirección <span className="font-normal text-muted-foreground">(opcional)</span>
        </label>
        <input
          id="address"
          name="address"
          defaultValue={defaults.address}
          disabled={pending}
          className={fieldClass(false)}
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground">
          Vendedor responsable
        </label>
        {canPickSeller ? (
          <>
            <select
              name="assignedSellerId"
              defaultValue={defaults.assignedSellerId}
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

      {duplicate?.kind === "blocked" && (
        <div className="space-y-3 rounded-md border border-error/40 bg-error/5 p-3">
          <DuplicateCandidateCard customer={duplicate.customer} />
        </div>
      )}

      {duplicate?.kind === "warning" && (
        <div className="space-y-3 rounded-md border border-border bg-black/[0.02] p-3">
          <div className="space-y-2">
            {duplicate.customers.map((customer) => (
              <DuplicateCandidateCard key={customer.id} customer={customer} />
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
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-dark disabled:opacity-60"
      >
        {pending ? "Guardando…" : submitLabel}
      </button>
    </form>
  );
}

function DuplicateCandidateCard({ customer }: { customer: CustomerDuplicateCandidate }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{customer.fullName}</p>
        <p className="truncate text-xs text-muted-foreground">
          {customer.identification ? `${customer.identification} · ` : ""}
          {customer.phone}
          {customer.email ? ` · ${customer.email}` : ""}
        </p>
      </div>
      <Link
        href={`/clientes/${customer.id}/editar`}
        className="shrink-0 text-sm font-medium text-primary hover:underline"
      >
        Ver cliente
      </Link>
    </div>
  );
}
