"use client";

import { useActionState, useEffect, useRef } from "react";
import type { PasswordFormState } from "@/app/(app)/perfil/actions";

export type PasswordFormAction = (
  state: PasswordFormState,
  formData: FormData,
) => Promise<PasswordFormState>;

function fieldClass(hasError: boolean) {
  return `w-full rounded-md border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:ring-1 ${
    hasError
      ? "border-error focus:border-error focus:ring-error"
      : "border-border focus:border-primary focus:ring-primary"
  }`;
}

export function PasswordForm({ action }: { action: PasswordFormAction }) {
  const [state, formAction, pending] = useActionState<PasswordFormState, FormData>(
    action,
    undefined,
  );
  const errors = state && !state.ok ? state.errors : undefined;
  const formError = state && !state.ok ? state.formError : undefined;
  const succeeded = state?.ok === true;

  const formRef = useRef<HTMLFormElement>(null);

  // Clear the fields after a successful change -- the values are never
  // worth keeping in the form once they've been used, and the session
  // stays active (see changePasswordForUser: it never touches Session).
  useEffect(() => {
    if (succeeded) {
      formRef.current?.reset();
    }
  }, [succeeded]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="max-w-xl space-y-4 rounded-lg border border-border bg-surface p-6"
      noValidate
    >
      <div>
        <h3 className="text-sm font-semibold text-foreground">Seguridad</h3>
        <p className="text-xs text-muted-foreground">
          Cambia tu contraseña. Tu sesión actual seguirá activa.
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="currentPassword" className="text-sm font-medium text-foreground">
          Contraseña actual
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          disabled={pending}
          className={fieldClass(!!errors?.currentPassword)}
        />
        {errors?.currentPassword && (
          <p className="text-sm text-error">{errors.currentPassword}</p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="newPassword" className="text-sm font-medium text-foreground">
          Nueva contraseña
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          disabled={pending}
          className={fieldClass(!!errors?.newPassword)}
        />
        {errors?.newPassword && <p className="text-sm text-error">{errors.newPassword}</p>}
      </div>

      <div className="space-y-1">
        <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
          Confirmar nueva contraseña
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

      {formError && <p className="text-sm text-error">{formError}</p>}
      {succeeded && (
        <p className="text-sm text-success">Contraseña actualizada correctamente.</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-dark disabled:opacity-60"
      >
        {pending ? "Actualizando…" : "Actualizar contraseña"}
      </button>
    </form>
  );
}
