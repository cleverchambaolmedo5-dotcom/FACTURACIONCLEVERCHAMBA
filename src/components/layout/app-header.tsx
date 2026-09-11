"use client";

import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { NAV_ITEMS, isNavItemActive } from "@/config/navigation";
import type { PublicUser } from "@/lib/auth/session";
import { UserMenu } from "./user-menu";

function usePageTitle(): string {
  const pathname = usePathname();
  const match = NAV_ITEMS.find((item) => isNavItemActive(pathname, item.href));
  return match?.label ?? "Panel";
}

export function AppHeader({
  user,
  onOpenMobileNav,
}: {
  user: PublicUser;
  onOpenMobileNav: () => void;
}) {
  const title = usePageTitle();

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-surface px-4 sm:px-6">
      <button
        type="button"
        onClick={onOpenMobileNav}
        aria-label="Abrir navegación"
        className="-ml-1.5 flex size-9 items-center justify-center rounded-md text-foreground transition-colors hover:bg-primary-soft lg:hidden"
      >
        <Menu className="size-5" aria-hidden />
      </button>

      <h1 className="flex-1 truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">
        {title}
      </h1>

      <UserMenu user={user} />
    </header>
  );
}
