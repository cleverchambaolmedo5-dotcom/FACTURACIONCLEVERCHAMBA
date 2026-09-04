"use client";

import { useActionState } from "react";
import { UserRole, UserStatus } from "@/generated/prisma/enums";
import { ROLE_LABELS } from "@/lib/auth/rbac";
import { USER_STATUS_LABELS } from "./user-status-badge";
import type { ManagedUserFormState } from "@/app/(app)/usuarios/actions";

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

function fieldClass(hasError: boolean) {
  return `w-full rounded-md border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:ring-1 ${
    hasError
      ? "border-error focus:border-error focus:ring-error"
      : "border-border focus:border-primary focus:ring-primary"
  }`;
}

/**
 * Shared create/edit form for the Usuarios module, mirroring
 * CustomerForm's structure (src/components/customers/customer-form.tsx).
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
    <form action={formAction} className="max-w-xl space-y-4" noValidate>
      <div className="space-y-1">
        <label htmlFor="name" className="text-sm font-medium text-foreground">
          Nombre completo
        </label>
        <input
          id="name"
          name="name"
          defaultValue={defaults.name}
          disabled={pending}
          className={fieldClass(!!errors?.name)}
        />
        {errors?.name && <p className="text-sm text-error">{errors.name}</p>}
      </div>

      <div className="space-y-1">
        <label htmlFor="email" className="text-sm font-medium text-foreground">
          Usuario
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          defaultValue={defaults.email}
          disabled={pending}
          className={fieldClass(!!errors?.email)}
        />
        {errors?.email && <p className="text-sm text-error">{errors.email}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="password" className="text-sm font-medium text-foreground">
            {mode === "create" ? "Contraseña" : (
              <>
                Contraseña <span className="font-normal text-muted-foreground">(opcional)</span>
              </>
            )}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            disabled={pending}
            placeholder={mode === "edit" ? "Dejar en blanco para conservarla" : undefined}
            className={fieldClass(!!errors?.password)}
          />
          {errors?.password && <p className="text-sm text-error">{errors.password}</p>}
        </div>

        <div className="space-y-1">
          <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
            Confirmar contraseña
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            disabled={pending}
            className={fieldClass(!!errors?.confirmPassword)}
          />
          {errors?.confirmPassword && (
            <p className="text-sm text-error">{errors.confirmPassword}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="role" className="text-sm font-medium text-foreground">
            Rol
          </label>
          <select
            id="role"
            name="role"
            defaultValue={defaults.role}
            disabled={pending}
            className={fieldClass(!!errors?.role)}
          >
            {Object.values(UserRole).map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
          {errors?.role && <p className="text-sm text-error">{errors.role}</p>}
        </div>

        {mode === "edit" && (
          <div className="space-y-1">
            <label htmlFor="status" className="text-sm font-medium text-foreground">
              Estado
            </label>
            <select
              id="status"
              name="status"
              defaultValue={defaults.status}
              disabled={pending}
              className={fieldClass(!!errors?.status)}
            >
              {Object.values(UserStatus).map((status) => (
                <option key={status} value={status} disabled={isSelf && status === UserStatus.INACTIVE}>
                  {USER_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
            {errors?.status && <p className="text-sm text-error">{errors.status}</p>}
            {isSelf && (
              <p className="text-xs text-muted-foreground">No puedes desactivar tu propia cuenta.</p>
            )}
          </div>
        )}
      </div>

      {formError && <p className="text-sm text-error">{formError}</p>}

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
