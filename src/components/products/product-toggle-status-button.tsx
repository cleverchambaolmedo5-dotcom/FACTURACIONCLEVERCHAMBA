"use client";

import { useState, useTransition } from "react";
import { Power, PowerOff } from "lucide-react";
import { toggleProductStatusAction } from "@/app/(app)/productos/actions";

// Invoked directly (no form/FormData) via useTransition, mirroring
// ToggleUserStatusButton. The server action re-validates ADMIN-only
// regardless of the fact that only ADMIN can reach this table at all.
export function ProductToggleStatusButton({
  productId,
  active,
}: {
  productId: string;
  active: boolean;
}) {
  const [error, setError] = useState<string | undefined>(undefined);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    setError(undefined);
    startTransition(async () => {
      const result = await toggleProductStatusAction(productId);
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
