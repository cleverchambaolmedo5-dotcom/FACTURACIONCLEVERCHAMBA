"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  NAV_ITEMS,
  MODULE_DASHBOARD_NAV,
  isNavItemActive,
  type ModuleContext,
  type ModuleKey,
} from "@/config/navigation";
import { cn } from "@/lib/utils";

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

  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
      {items.map((item) => {
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
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
            )}
          >
            <Icon className="size-5 shrink-0" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
