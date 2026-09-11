"use client";

import { useState, useTransition } from "react";
import { Power, PowerOff } from "lucide-react";
import { UserStatus } from "@/generated/prisma/enums";
import { toggleUserStatusAction } from "@/app/(app)/usuarios/actions";

// Invoked directly (no form/FormData) via useTransition, mirroring the
// "Aprobar pago" button in PaymentValidationPanel
// (src/components/payments/payment-validation-panel.tsx). The server
// action re-validates every rule (ADMIN-only, self-deactivation, last
// active ADMIN) regardless of `disabled` below -- that prop is purely a
// UX shortcut to avoid a round-trip for the one case (deactivating your
// own account) that's always rejected.
export function ToggleUserStatusButton({
  userId,
  status,
  disabled,
}: {
  userId: string;
  status: UserStatus;
  disabled?: boolean;
}) {
  const [error, setError] = useState<string | undefined>(undefined);
  const [pending, startTransition] = useTransition();
  const willActivate = status === UserStatus.INACTIVE;

  function handleClick() {
    setError(undefined);
    startTransition(async () => {
      const result = await toggleUserStatusAction(userId);
      if (result && !result.ok) {
        setError(result.formError);
      }
    });
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || pending}
        title={disabled ? "No puedes desactivar tu propia cuenta." : undefined}
        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          willActivate
            ? "text-success hover:bg-success-soft"
            : "text-error hover:bg-error-soft"
        }`}
      >
        {willActivate ? <Power className="size-3.5" aria-hidden /> : <PowerOff className="size-3.5" aria-hidden />}
        {pending ? "Guardando…" : willActivate ? "Activar" : "Desactivar"}
      </button>
      {error && <p className="max-w-[220px] text-right text-xs text-error">{error}</p>}
    </div>
  );
}
