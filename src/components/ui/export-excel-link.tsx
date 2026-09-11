import { FileSpreadsheet } from "lucide-react";

// Plain <a> to a Route Handler that streams back an .xlsx file (see
// src/server/services/excel-export.ts) -- a normal navigation, not a
// fetch/useTransition, so the browser's native "Save file" flow handles
// the download and the Route Handler's own requireModuleAccess() guard
// applies exactly like any other page render. Reused by both the
// Movimientos and Ventas exports so every "Exportar a Excel" button looks
// and behaves the same.
export function ExportExcelLink({ href, label = "Exportar a Excel" }: { href: string; label?: string }) {
  return (
    <a
      href={href}
      className="inline-flex items-center justify-center gap-2 rounded-md border border-success/30 bg-success-soft px-4 py-2 text-sm font-medium text-success transition-colors hover:opacity-90"
    >
      <FileSpreadsheet className="size-4" aria-hidden />
      {label}
    </a>
  );
}
