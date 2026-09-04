import { ROLE_LABELS } from "@/lib/auth/rbac";
import type { PublicUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/shared/user-avatar";

// Compact identity block (avatar + name + role) reused in the
// Sidebar footer (dark background) and the Header's user menu (light
// background), so both stay in sync instead of duplicating the markup.
export function UserIdentity({
  user,
  variant = "default",
  className,
}: {
  user: PublicUser;
  variant?: "default" | "sidebar";
  className?: string;
}) {
  const onSidebar = variant === "sidebar";

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <UserAvatar name={user.name} avatarUrl={user.avatarUrl} size="sm" />
      <div className="min-w-0">
        <p
          className={cn(
            "truncate text-sm font-medium",
            onSidebar ? "text-sidebar-foreground" : "text-foreground",
          )}
        >
          {user.name}
        </p>
        <p
          className={cn(
            "truncate text-xs",
            onSidebar ? "text-sidebar-foreground/60" : "text-muted-foreground",
          )}
        >
          {ROLE_LABELS[user.role]}
        </p>
      </div>
    </div>
  );
}
