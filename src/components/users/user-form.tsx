"use client";

import { useActionState } from "react";
import { UserRole, UserStatus } from "@/generated/prisma/enums";
import { ROLE_LABELS } from "@/lib/auth/rbac";
import { USER_STATUS_LABELS } from "./user-status-badge";
import type { ManagedUserFormState } from "@/app/(app)/usuarios/actions";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export type UserFormAction = (
  state: ManagedUserFormState,
  formData: FormData,
) => Promise<ManagedUserFormState>;

export type UserFormDefaults = {
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
};

const EMPTY_DEFAULTS: UserFormDefaults = {
  name: "",
  email: "",
  role: UserRole.SELLER,
  status: UserStatus.ACTIVE,
};

/**
 * Shared create/edit form for the Usuarios module, mirroring
 * ProductForm/CustomerForm's structure (src/components/products/product-form.tsx).
 * `mode="create"` requires a password; `mode="edit"` makes it optional
 * (leave blank to keep the current one -- see
 * user-management-service.ts#updateUserForAdmin) and additionally shows
 * the Estado field. `isSelf` disables picking "Inactivo" client-side as a
 * UX shortcut -- the server still rejects self-deactivation regardless
 * (see updateUserForAdmin).
 */
export function UserForm({
  action,
  mode,
  isSelf = false,
  defaults = EMPTY_DEFAULTS,
  submitLabel,
}: {
  action: UserFormAction;
  mode: "create" | "edit";
  isSelf?: boolean;
  defaults?: UserFormDefaults;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<ManagedUserFormState, FormData>(
    action,
    undefined,
  );
  const errors = state && !state.ok ? state.errors : undefined;
  const formError = state && !state.ok ? state.formError : undefined;

  return (
    <Card padding="md" className="max-w-xl">
      <form action={formAction} className="space-y-4" noValidate>
        <Input
          id="name"
          name="name"
          label="Nombre completo"
          required
          defaultValue={defaults.name}
          disabled={pending}
          error={errors?.name}
        />

        <Input
          id="email"
          name="email"
          type="email"
          label="Usuario"
          required
          autoComplete="username"
          defaultValue={defaults.email}
          disabled={pending}
          error={errors?.email}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="password"
            name="password"
            type="password"
            label={mode === "create" ? "Contraseña" : "Contraseña (opcional)"}
            required={mode === "create"}
            autoComplete="new-password"
            disabled={pending}
            placeholder={mode === "edit" ? "Dejar en blanco para conservarla" : undefined}
            error={errors?.password}
          />

          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            label="Confirmar contraseña"
            autoComplete="new-password"
            disabled={pending}
            error={errors?.confirmPassword}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            id="role"
            name="role"
            label="Rol"
            required
            defaultValue={defaults.role}
            disabled={pending}
            error={errors?.role}
          >
            {Object.values(UserRole).map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </Select>

          {mode === "edit" && (
            <Select
              id="status"
              name="status"
              label="Estado"
              defaultValue={defaults.status}
              disabled={pending}
              error={errors?.status}
              helperText={isSelf ? "No puedes desactivar tu propia cuenta." : undefined}
            >
              {Object.values(UserStatus).map((status) => (
                <option key={status} value={status} disabled={isSelf && status === UserStatus.INACTIVE}>
                  {USER_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
          )}
        </div>

        {formError && <p className="text-sm text-error">{formError}</p>}

        <Button type="submit" disabled={pending} loading={pending}>
          {pending ? "Guardando…" : submitLabel}
        </Button>
      </form>
    </Card>
  );
}
