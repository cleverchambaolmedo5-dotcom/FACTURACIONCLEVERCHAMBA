import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export type QuickAction = { href: string; label: string; icon: LucideIcon };

export function QuickActions({ actions }: { actions: QuickAction[] }) {
  return (
    <div className="flex flex-wrap gap-3">
      {actions.map((action) => (
        <Link
          key={`${action.href}-${action.label}`}
          href={action.href}
          className={buttonVariants({ variant: "secondary", size: "md" })}
        >
          <action.icon className="size-4 text-primary" aria-hidden />
          {action.label}
        </Link>
      ))}
    </div>
  );
}
