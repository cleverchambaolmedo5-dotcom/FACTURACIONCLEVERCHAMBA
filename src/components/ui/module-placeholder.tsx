import type { LucideIcon } from "lucide-react";
import { Hammer } from "lucide-react";
import { StatusBadge } from "./status-badge";

// Temporary content for module routes that don't have real business logic
// yet (the public Asesorías placeholder screen). Once a module is
// actually built (as Ventas and Inversiones now are), its page.tsx stops
// rendering this and renders real content instead.
export function ModulePlaceholder({
  icon: Icon,
  title,
  description,
  badgeLabel = "Módulo en construcción",
  badgeIcon: BadgeIcon = Hammer,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  badgeLabel?: string;
  badgeIcon?: LucideIcon;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border border-border bg-surface px-6 py-20 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Icon className="size-6" aria-hidden />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      <StatusBadge tone="pending" className="gap-1.5">
        <BadgeIcon className="size-3.5" aria-hidden />
        {badgeLabel}
      </StatusBadge>
    </div>
  );
}
