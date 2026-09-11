"use client";

import { useState, useTransition } from "react";
import { Power, PowerOff } from "lucide-react";
import { toggleBankAccountStatusAction } from "@/app/(app)/cuentas-bancarias/actions";

// Invoked directly (no form/FormData) via useTransition, mirroring
// ProductToggleStatusButton. The server action re-validates ADMIN-only
// regardless of ACCOUNTANT never rendering this button in the first place.
export function BankAccountToggleStatusButton({
  bankAccountId,
  active,
}: {
  bankAccountId: string;
  active: boolean;
}) {
  const [error, setError] = useState<string | undefined>(undefined);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    setError(undefined);
    startTransition(async () => {
      const result = await toggleBankAccountStatusAction(bankAccountId);
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
        disabled={pending}
        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          active ? "text-error hover:bg-error-soft" : "text-success hover:bg-success-soft"
        }`}
      >
        {active ? <PowerOff className="size-3.5" aria-hidden /> : <Power className="size-3.5" aria-hidden />}
        {pending ? "Guardando…" : active ? "Desactivar" : "Activar"}
      </button>
      {error && <p className="max-w-[220px] text-right text-xs text-error">{error}</p>}
    </div>
  );
}
