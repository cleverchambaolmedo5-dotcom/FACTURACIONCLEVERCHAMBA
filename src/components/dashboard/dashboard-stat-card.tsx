import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatCardTone = "default" | "success" | "warning" | "error";

const TONE_CLASSES: Record<StatCardTone, string> = {
  default: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  error: "bg-error/10 text-error",
};

export function DashboardStatCard({
  icon: Icon,
  label,
  value,
  tone = "default",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: StatCardTone;
}) {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-surface p-5">
      <div
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-full",
          TONE_CLASSES[tone],
        )}
      >
        <Icon className="size-5" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-xl font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}
