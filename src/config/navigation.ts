// Single source of truth for the authenticated app's navigation: every
// sidebar/mobile-nav entry, its route, its icon, and the module key RBAC
// checks it against. Nothing else should hardcode this list -- the
// Sidebar, the mobile navigation, and each module page all read from
// here instead of repeating routes/labels/icons.

import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  CalendarClock,
  Wallet,
  Receipt,
  Package,
  Landmark,
  UserCog,
  Settings,
  LineChart,
} from "lucide-react";

export type ModuleKey =
  | "dashboard"
  | "clientes"
  | "ventas"
  | "inversiones"
  | "cuotas"
  | "pagos"
  | "comprobantes"
  | "productos"
  | "cuentas-bancarias"
  | "usuarios"
  | "configuracion";

export type NavItem = {
  key: ModuleKey;
  label: string;
  href: string;
  icon: LucideIcon;
};

// The two authenticated "areas" a session can be working in. Distinct from
// ModuleKey (a single nav entry, e.g. "clientes") -- this is which of the
// two sets of nav entries is currently showing. See
// resolveModuleContextFromPathname below for how it's determined, and
// src/app/(app)/layout.tsx for how it's threaded down to the Sidebar.
export type ModuleContext = "ventas" | "inversiones";

export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { key: "clientes", label: "Clientes", href: "/clientes", icon: Users },
  { key: "ventas", label: "Ventas", href: "/ventas", icon: ShoppingCart },
  { key: "inversiones", label: "Inversiones", href: "/inversiones", icon: LineChart },
  { key: "cuotas", label: "Cuotas", href: "/cuotas", icon: CalendarClock },
  { key: "pagos", label: "Pagos", href: "/pagos", icon: Wallet },
  { key: "comprobantes", label: "Comprobantes", href: "/comprobantes", icon: Receipt },
  { key: "productos", label: "Productos", href: "/productos", icon: Package },
  {
    key: "cuentas-bancarias",
    label: "Cuentas bancarias",
    href: "/cuentas-bancarias",
    icon: Landmark,
  },
  { key: "usuarios", label: "Usuarios", href: "/usuarios", icon: UserCog },
  { key: "configuracion", label: "Configuración", href: "/configuracion", icon: Settings },
];

// Which nav entries show up while the session is working in each module
// context. `clientes` and `cuentas-bancarias` are shared resources and
// deliberately appear in both -- only the *set of visible nav items*
// changes here, never RBAC (rbac.ts still decides per-role access) or the
// routes themselves, which keep working under either context. `usuarios`/
// `configuracion` are cross-cutting (ADMIN-only system settings, not
// specific to either module) so they stay available in both too. Read by
// src/app/(app)/layout.tsx together with the resolved ModuleContext.
export const MODULE_NAV_KEYS: Record<ModuleContext, ModuleKey[]> = {
  ventas: [
    "dashboard",
    "clientes",
    "ventas",
    "cuotas",
    "pagos",
    "comprobantes",
    "productos",
    "cuentas-bancarias",
    "usuarios",
    "configuracion",
  ],
  inversiones: ["dashboard", "clientes", "inversiones", "cuentas-bancarias", "usuarios", "configuracion"],
};

// The single "dashboard" nav entry (see NAV_ITEMS above, still gated by
// MODULE_ACCESS.dashboard like any other item) points somewhere different
// depending on context: Inversiones has its own metrics dashboard
// (/dashboard) and Ventas has its own, separate one (/dashboard-ventas) --
// see dashboard-service.ts, which keeps each module's numbers/lists fully
// independent of the other's. Applied by NavList.
export const MODULE_DASHBOARD_NAV: Record<ModuleContext, { label: string; href: string }> = {
  ventas: { label: "Dashboard de Ventas", href: "/dashboard-ventas" },
  inversiones: { label: "Dashboard de Inversiones", href: "/dashboard" },
};

function pathMatchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

// Routes that unambiguously belong to one module context. Shared resources
// (/clientes, /cuentas-bancarias) and cross-cutting pages (/usuarios,
// /configuracion, /perfil) are intentionally absent -- for those,
// src/proxy.ts falls back to the last context recorded in
// MODULE_CONTEXT_COOKIE_NAME instead (see resolveModuleContextFromPathname).
const VENTAS_ROUTE_PREFIXES = [
  "/dashboard-ventas",
  "/ventas",
  "/pagos",
  "/cuotas",
  "/comprobantes",
  "/productos",
];
const INVERSIONES_ROUTE_PREFIXES = ["/dashboard", "/inversiones"];

/**
 * Determines the active module context purely from the current route --
 * `null` for a route that doesn't unambiguously belong to either (shared
 * resources, cross-cutting pages, or public routes like "/"/"/login").
 * Called from src/proxy.ts on every request to compute
 * MODULE_CONTEXT_HEADER_NAME for that render and to update
 * MODULE_CONTEXT_COOKIE_NAME for later, ambiguous ones.
 */
export function resolveModuleContextFromPathname(pathname: string): ModuleContext | null {
  if (VENTAS_ROUTE_PREFIXES.some((prefix) => pathMatchesPrefix(pathname, prefix))) return "ventas";
  if (INVERSIONES_ROUTE_PREFIXES.some((prefix) => pathMatchesPrefix(pathname, prefix))) return "inversiones";
  return null;
}

// Carries the module context resolved for the *current* request from
// src/proxy.ts down into the (app) layout's Server Component render (see
// the "Setting Headers" pattern in Next.js's Proxy docs) -- a plain
// request header, not a security boundary of any kind.
export const MODULE_CONTEXT_HEADER_NAME = "x-module-context";

// Remembers the last unambiguous module context across requests, so a
// later visit to a shared/cross-cutting route (where
// resolveModuleContextFromPathname returns null) still shows the right
// Sidebar. A UI preference only -- unrelated to SESSION_COOKIE_NAME/the
// Session table, never read for auth or RBAC decisions.
export const MODULE_CONTEXT_COOKIE_NAME = "cc_module_context";

// True when `pathname` is the nav item's route or a sub-route of it, used
// to highlight the active sidebar entry.
export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
