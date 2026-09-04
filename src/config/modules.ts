// Single source of truth for the public module-selection screen ("/").
// Each entry drives one card. "ventas" and "inversiones" are wired to real
// functionality -- "asesorias" still points at a static "Próximamente"
// placeholder route (see src/app/asesorias).
//
// Adding a real module later means: build its authenticated routes under
// src/app/(app)/<key>/ (mirroring ventas/inversiones), then flip its
// `status` here to "active" and repoint `href` -- nothing else on this
// screen changes.

import type { LucideIcon } from "lucide-react";
import { Handshake, LineChart, TrendingUp } from "lucide-react";

export type CompanyModule = {
  key: "ventas" | "inversiones" | "asesorias";
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  status: "active" | "coming-soon";
};

// Where an authenticated session lands for each module -- read by
// src/proxy.ts (an already-logged-in visit to /login?module=<key> skips
// the login form entirely and redirects straight here) and by
// login() (src/lib/auth/actions.ts, after a successful sign-in). Only
// modules with real authenticated routes are listed; "asesorias" has no
// entry since its card links straight to the public placeholder, never
// through /login. A `module` value that isn't a key here (missing,
// mistyped, or a not-yet-built module) simply falls back to the existing
// default ("/dashboard") wherever this map is read -- never a security
// check, purely a navigation destination.
export const MODULE_HOME_PATHS: Partial<Record<CompanyModule["key"], string>> = {
  ventas: "/dashboard-ventas",
  inversiones: "/dashboard",
};

export const COMPANY_MODULES: CompanyModule[] = [
  {
    key: "ventas",
    title: "Ventas",
    description: "Gestiona clientes, ventas, cuotas, pagos y comprobantes.",
    icon: TrendingUp,
    // The login screen keeps its own auth logic untouched; `module` is
    // only read for display context (see src/app/login/page.tsx).
    href: "/login?module=ventas",
    status: "active",
  },
  {
    key: "inversiones",
    title: "Inversiones",
    description: "Gestiona inversionistas, montos y rendimientos.",
    icon: LineChart,
    // Same pattern as ventas: `module` is only read for display context on
    // the login screen (see src/app/login/page.tsx).
    href: "/login?module=inversiones",
    status: "active",
  },
  {
    key: "asesorias",
    title: "Asesorías",
    description: "Gestiona clientes, asesorías y servicios profesionales.",
    icon: Handshake,
    href: "/asesorias",
    status: "coming-soon",
  },
];
