// Centralized, static role-based access control. This defines which
// modules each role can reach, and at what scope -- but does NOT yet
// implement row-level data filtering (e.g. a SELLER only ever seeing
// their own sales/customers/payments). That filtering belongs in each
// module's queries once those modules exist; for now this is just the
// permissions table they'll read from.
//
// This is also only half the story: hiding a Sidebar link is a UX
// nicety, not a security boundary. Every module page must call
// `requireModuleAccess()` (see ./guards.ts) itself, and any future API
// route/Server Action touching module data must check `canAccessModule()`
// again on the server before doing anything.

import type { UserRole } from "@/generated/prisma/enums";
import type { ModuleKey } from "@/config/navigation";

export type { ModuleKey };

// "all": full access to every record in the module.
// "scoped": access limited to records related to the current user (e.g.
//   a SELLER's own sales, or payments tied to those sales). The actual
//   filtering logic is not implemented yet -- this is a placeholder
//   marker for when it is.
// "none": the module isn't accessible to this role at all.
export type ModuleAccess = "all" | "scoped" | "none";

// Centralized display label per role, so the Sidebar, Header, and
// Dashboard don't each hardcode their own copy.
export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Administrador",
  ACCOUNTANT: "Contabilidad",
  SELLER: "Vendedor",
};

export const MODULE_ACCESS: Record<ModuleKey, Record<UserRole, ModuleAccess>> = {
  dashboard: { ADMIN: "all", ACCOUNTANT: "all", SELLER: "all" },
  clientes: { ADMIN: "all", ACCOUNTANT: "all", SELLER: "scoped" },
  ventas: { ADMIN: "all", ACCOUNTANT: "all", SELLER: "scoped" },
  // SELLER's "scoped" access here additionally never includes financial
  // data (principal amount, rate, ...), even for their own investments --
  // that restriction is enforced in src/server/services/investment-service.ts,
  // not expressible by this "all"/"scoped"/"none" table alone.
  inversiones: { ADMIN: "all", ACCOUNTANT: "all", SELLER: "scoped" },
  // SELLER's "scoped" access here is the same bucket as their own sales/
  // pagos: only cuotas belonging to their own sales (see
  // payment-service.ts#listCuotasForUser).
  cuotas: { ADMIN: "all", ACCOUNTANT: "all", SELLER: "scoped" },
  // SELLER's "pagos relacionados" (payments tied to their own sales) is
  // the same "scoped" bucket as their own sales/customers.
  pagos: { ADMIN: "all", ACCOUNTANT: "all", SELLER: "scoped" },
  comprobantes: { ADMIN: "all", ACCOUNTANT: "all", SELLER: "none" },
  productos: { ADMIN: "all", ACCOUNTANT: "none", SELLER: "none" },
  "cuentas-bancarias": { ADMIN: "all", ACCOUNTANT: "all", SELLER: "none" },
  usuarios: { ADMIN: "all", ACCOUNTANT: "none", SELLER: "none" },
  configuracion: { ADMIN: "all", ACCOUNTANT: "none", SELLER: "none" },
};

export function getModuleAccess(
  role: UserRole,
  moduleKey: ModuleKey,
): ModuleAccess {
  return MODULE_ACCESS[moduleKey][role];
}

export function canAccessModule(role: UserRole, moduleKey: ModuleKey): boolean {
  return getModuleAccess(role, moduleKey) !== "none";
}
