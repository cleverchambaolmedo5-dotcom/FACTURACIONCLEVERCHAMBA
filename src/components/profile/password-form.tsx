"use client";

import { useActionState, useEffect, useRef } from "react";
import type { PasswordFormState } from "@/app/(app)/perfil/actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export type PasswordFormAction = (
  state: PasswordFormState,
  formData: FormData,
) => Promise<PasswordFormState>;

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
    <Card padding="md" className="max-w-xl">
      <form ref={formRef} action={formAction} className="space-y-4" noValidate>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Seguridad</h3>
          <p className="text-xs text-muted-foreground">
            Cambia tu contraseña. Tu sesión actual seguirá activa.
          </p>
        </div>

        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          label="Contraseña actual"
          autoComplete="current-password"
          disabled={pending}
          error={errors?.currentPassword}
        />

        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          label="Nueva contraseña"
          autoComplete="new-password"
          disabled={pending}
          error={errors?.newPassword}
        />

        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          label="Confirmar nueva contraseña"
          autoComplete="new-password"
          disabled={pending}
          error={errors?.confirmPassword}
        />

        {formError && <p className="text-sm text-error">{formError}</p>}
        {succeeded && <p className="text-sm text-success">Contraseña actualizada correctamente.</p>}

        <Button type="submit" disabled={pending} loading={pending}>
          {pending ? "Actualizando…" : "Actualizar contraseña"}
        </Button>
      </form>
    </Card>
  );
}
