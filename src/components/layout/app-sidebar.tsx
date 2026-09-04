import { Building2 } from "lucide-react";
import { siteConfig } from "@/config/site";
import type { ModuleContext, ModuleKey } from "@/config/navigation";
import { NavList } from "./nav-list";
import { UserIdentity } from "./user-identity";
import type { PublicUser } from "@/lib/auth/session";

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
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-4">
        <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Building2 className="size-5" aria-hidden />
        </div>
        <span className="text-sm font-semibold text-sidebar-foreground">
          {siteConfig.brandName}
        </span>
      </div>

      <NavList allowedKeys={allowedKeys} moduleContext={moduleContext} />

      <div className="border-t border-sidebar-border p-3">
        <UserIdentity user={user} variant="sidebar" />
      </div>
    </aside>
  );
}
