import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export type QuickAction = { href: string; label: string; icon: LucideIcon };

export function QuickActions({ actions }: { actions: QuickAction[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {actions.map((action) => (
        <Link
          key={`${action.href}-${action.label}`}
          href={action.href}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-black/[0.03]"
        >
          <action.icon className="size-4 text-primary" aria-hidden />
          {action.label}
        </Link>
      ))}
    </div>
  );
}
