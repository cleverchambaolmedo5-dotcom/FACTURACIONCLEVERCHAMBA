"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  NAV_ITEMS,
  MODULE_DASHBOARD_NAV,
  isNavItemActive,
  type ModuleContext,
  type ModuleKey,
  type NavItem,
} from "@/config/navigation";
import { cn } from "@/lib/utils";

// Purely presentational grouping on top of NAV_ITEMS -- navigation.ts stays
// the single source of truth for which routes/icons/RBAC keys exist. A
// group only renders when at least one of its keys survives the
// allowedKeys/moduleContext filtering already computed below, so a role or
// context that doesn't have e.g. any "Operaciones" item never shows an
// empty "Operaciones" heading.
const NAV_GROUPS: { label: string; keys: ModuleKey[] }[] = [
  { label: "Principal", keys: ["dashboard"] },
  { label: "Operaciones", keys: ["clientes", "ventas", "cuotas", "pagos", "comprobantes", "productos"] },
  { label: "Inversiones", keys: ["inversiones"] },
  { label: "Administración", keys: ["cuentas-bancarias", "usuarios", "configuracion"] },
];

// Shared nav-item rendering for both the desktop Sidebar and the mobile
// off-canvas navigation, so the active-state/permission logic only lives
// in one place.
export function NavList({
  allowedKeys,
  moduleContext,
  onNavigate,
}: {
  allowedKeys: ModuleKey[];
  moduleContext: ModuleContext;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  // The "dashboard" entry's label/href depends on which module context is
  // active -- see MODULE_DASHBOARD_NAV. Every other item is used as-is.
  const items = NAV_ITEMS.filter((item) => allowedKeys.includes(item.key)).map((item) =>
    item.key === "dashboard" ? { ...item, ...MODULE_DASHBOARD_NAV[moduleContext] } : item,
  );
  const itemsByKey = new Map(items.map((item) => [item.key, item]));

  const groups = NAV_GROUPS.map((group) => ({
    label: group.label,
    items: group.keys
      .map((key) => itemsByKey.get(key))
      .filter((item): item is NavItem => Boolean(item)),
  })).filter((group) => group.items.length > 0);

  return (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/40">
            {group.label}
          </p>
          {group.items.map((item) => {
            const active = isNavItemActive(pathname, item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                )}
              >
                <Icon className="size-5 shrink-0" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
