"use client";

import { useEffect } from "react";

// Last-resort error boundary: only runs if the ROOT layout.tsx itself
// throws (fonts/metadata setup) -- src/app/error.tsx already catches
// everything below that. Must render its own <html>/<body> since it
// replaces the root layout when active, so it can't rely on globals.css
// having loaded; styling is inline on purpose, mirroring Next.js's own
// built-in fallback for the same reason.
//
// The real error is always logged (with its `digest`, when the framework
// attaches one for a server-side failure) so the actual cause stays
// diagnosable -- this never hides or swallows anything.
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "1.5rem",
          textAlign: "center",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          background: "#f8fafc",
          color: "#0f172a",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <h1 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>Algo salió mal</h1>
          <p style={{ fontSize: "0.875rem", color: "#64748b", maxWidth: "24rem", margin: 0 }}>
            Ocurrió un error al cargar la aplicación. Puedes intentarlo de nuevo.
          </p>
          {error.digest && (
            <p style={{ fontSize: "0.75rem", color: "#64748b", margin: 0 }}>
              Código de referencia: {error.digest}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={retry}
          style={{
            borderRadius: "0.375rem",
            background: "#2563eb",
            color: "#ffffff",
            border: "none",
            padding: "0.5rem 1rem",
            fontSize: "0.875rem",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Reintentar
        </button>
      </body>
    </html>
  );
}
