import { Building2 } from "lucide-react";
import { siteConfig } from "@/config/site";
import type { ModuleContext, ModuleKey } from "@/config/navigation";
import { NavList } from "./nav-list";
import { UserIdentity } from "./user-identity";
import type { PublicUser } from "@/lib/auth/session";

// "Clever Chamba" / "CONTROL" lockup, derived from siteConfig.brandName
// ("Clever Chamba Control") rather than hardcoded twice -- see the same
// split in MobileNavigation.
const brandWords = siteConfig.brandName.split(" ");
const brandSubtitle = brandWords.pop() ?? "";
const brandTitle = brandWords.join(" ");

// Permanent, always-visible desktop sidebar. Hidden below the `lg`
// breakpoint -- MobileNavigation covers that case with the same NavList.
export function AppSidebar({
  user,
  allowedKeys,
  moduleContext,
}: {
  user: PublicUser;
  allowedKeys: ModuleKey[];
  moduleContext: ModuleContext;
}) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-4">
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

      <NavList allowedKeys={allowedKeys} moduleContext={moduleContext} />

      <div className="border-t border-sidebar-border p-3">
        <UserIdentity user={user} variant="sidebar" />
      </div>
    </aside>
  );
}
