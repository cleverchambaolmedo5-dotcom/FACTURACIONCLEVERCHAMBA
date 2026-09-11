"use client";

import { Building2, X } from "lucide-react";
import { siteConfig } from "@/config/site";
import type { ModuleContext, ModuleKey } from "@/config/navigation";
import { cn } from "@/lib/utils";
import { NavList } from "./nav-list";

const brandWords = siteConfig.brandName.split(" ");
const brandSubtitle = brandWords.pop() ?? "";
const brandTitle = brandWords.join(" ");

// Off-canvas navigation for small screens. Reuses NavList (same active
// state, same permission filtering) instead of duplicating the menu.
export function MobileNavigation({
  open,
  onClose,
  allowedKeys,
  moduleContext,
}: {
  open: boolean;
  onClose: () => void;
  allowedKeys: ModuleKey[];
  moduleContext: ModuleContext;
}) {
  return (
    <div
      className={cn(
        "fixed inset-0 z-40 lg:hidden",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
      aria-hidden={!open}
    >
      <div
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-slate-950/50 transition-opacity",
          open ? "opacity-100" : "opacity-0",
        )}
      />

      <aside
        className={cn(
          "absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-sidebar shadow-xl transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between gap-2 border-b border-sidebar-border px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Building2 className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold text-sidebar-foreground">{brandTitle}</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sidebar-foreground/50">
                {brandSubtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar navegación"
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <NavList allowedKeys={allowedKeys} moduleContext={moduleContext} onNavigate={onClose} />
      </aside>
    </div>
  );
}
