// Central place for app-wide, non-secret configuration values.
// Environment-dependent secrets belong in `.env` / `src/lib/env.ts`, not here.

export const siteConfig = {
  name: "CleverChamba",
  // Temporary system name shown in the sidebar branding.
  brandName: "Clever Chamba Control",
  description:
    "Sistema interno de control de ventas, pagos y comprobantes para academia.",
} as const;
