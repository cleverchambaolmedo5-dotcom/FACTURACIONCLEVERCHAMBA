"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

// Root-level error boundary. Catches everything the more specific
// (app)/error.tsx can't: failures in the public routes ("/", "/login",
// "/asesorias") and, since an error.tsx never catches errors thrown by its
// own sibling layout.tsx, failures inside (app)/layout.tsx itself (e.g. the
// requireUser()/session lookup or module-context resolution that layout
// does on every authenticated request). Without this, those failures fall
// through to Next.js's generic global fallback ("This page couldn't
// load"), which is what this whole file exists to avoid.
//
// The real error is always logged (with its `digest`, when the framework
// attaches one for a server-side failure) so the actual cause stays
// diagnosable in server/production logs -- this never hides or swallows
// anything.
export default function RootSegmentError({
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-error/10 text-error">
        <AlertTriangle className="size-6" aria-hidden />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-lg font-semibold text-foreground">Algo salió mal</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Ocurrió un error al cargar esta página. Puedes intentarlo de nuevo.
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
