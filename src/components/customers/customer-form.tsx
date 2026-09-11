"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { AlertTriangle, Eye, ShieldAlert } from "lucide-react";
import { UserRole } from "@/generated/prisma/enums";
import type { CustomerFormState } from "@/app/(app)/clientes/actions";
import type { CustomerDuplicateCandidate } from "@/server/services/customer-service";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/shared/user-avatar";

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

      <Input
        id="fullName"
        name="fullName"
        label="Nombre completo"
        required
        defaultValue={defaults.fullName}
        disabled={pending}
        error={errors?.fullName}
      />

      <Input
        id="identification"
        name="identification"
        label="Identificación (cédula / RUC)"
        helperText="Opcional."
        defaultValue={defaults.identification}
        disabled={pending}
        error={errors?.identification}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          id="phone"
          name="phone"
          label="Teléfono"
          required
          defaultValue={defaults.phone}
          disabled={pending}
          error={errors?.phone}
        />

        <Input
          id="country"
          name="country"
          label="País"
          required
          defaultValue={defaults.country}
          disabled={pending}
          error={errors?.country}
        />
      </div>

      <Input
        id="email"
        name="email"
        type="email"
        label="Email"
        helperText="Opcional."
        defaultValue={defaults.email}
        disabled={pending}
        error={errors?.email}
      />

      <Input
        id="address"
        name="address"
        label="Dirección"
        helperText="Opcional."
        defaultValue={defaults.address}
        disabled={pending}
      />

      {canPickSeller ? (
        <Select
          id="assignedSellerId"
          name="assignedSellerId"
          label="Vendedor responsable"
          required
          defaultValue={defaults.assignedSellerId}
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
        <div className="flex gap-3 rounded-lg border border-error/30 bg-error-soft p-4">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-error" aria-hidden />
          <div className="min-w-0 flex-1 space-y-3">
            <p className="text-sm font-semibold text-error">{formError}</p>
            <DuplicateCandidateCard customer={duplicate.customer} />
          </div>
        </div>
      )}

      {duplicate?.kind === "warning" && (
        <div className="flex gap-3 rounded-lg border border-warning/30 bg-warning-soft p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
          <div className="min-w-0 flex-1 space-y-3">
            <p className="text-sm font-semibold text-foreground">{formError}</p>
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
        </div>
      )}

      <Button type="submit" disabled={pending} loading={pending}>
        {pending ? "Guardando…" : submitLabel}
      </Button>
    </form>
  );
}

function DuplicateCandidateCard({ customer }: { customer: CustomerDuplicateCandidate }) {
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
      <Link
        href={`/clientes/${customer.id}/editar`}
        className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        <Eye className="size-3.5" aria-hidden />
        Ver cliente
      </Link>
    </div>
  );
}
