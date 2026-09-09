"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

// Route-level error boundary for every authenticated page. Placed one
// level below (app)/layout.tsx (not inside a specific module) so it
// catches a render/data-fetch failure in any page under the Ventas or
// Inversiones module, while the Sidebar/Header the layout already rendered
// stay mounted -- only the content area is replaced. Without this, an
// uncaught error anywhere in the app bubbles all the way up to Next.js's
// own built-in fallback ("This page couldn't load"), which tears down the
// entire page instead of just the section that failed.
//
// The real error is always logged (with its `digest`, when the framework
// attaches one for a server-side failure) so the actual cause stays
// diagnosable -- this never hides or swallows anything, it only stops one
// failure from taking the whole app down with it.
export default function AppSegmentError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-error/10 text-error">
        <AlertTriangle className="size-6" aria-hidden />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-lg font-semibold text-foreground">Algo salió mal</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Ocurrió un error al cargar esta sección. Puedes intentarlo de nuevo.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/70">Código de referencia: {error.digest}</p>
        )}
      </div>
      <button
        type="button"
        onClick={retry}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-dark"
      >
        Reintentar
      </button>
    </div>
  );
}
