import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export type StatCardTone = "default" | "success" | "warning" | "error";

const TONE_CLASSES: Record<StatCardTone, string> = {
  default: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  error: "bg-error-soft text-error",
};

// "hero" is an additive, opt-in look (solid --primary background, white
// text) for the single highest-priority KPI on a dashboard -- every
// existing call site keeps the plain `variant="default"` Card look
// untouched since that's the prop's default value.
export type StatCardVariant = "default" | "hero";

// "row" (icon beside a single-line label+value) is the original, unchanged
// layout every existing call site keeps by default. "stack" (icon above a
// bigger label/value/caption block) is opt-in, used to give a small group
// of priority KPI cards -- e.g. sitting in the same row as a `variant="hero"`
// card -- the same proportions/height as that hero card instead of a
// mismatched shorter row. `variant="hero"` always renders as "stack"
// regardless of this prop.
export type StatCardLayout = "row" | "stack";

export function DashboardStatCard({
  icon: Icon,
  label,
  value,
  caption,
  tone = "default",
  variant = "default",
  layout = "row",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  /** Optional secondary line under the value -- only ever real, already-derived data (e.g. a percentage of an existing total), never a fabricated trend/comparison. */
  caption?: string;
  tone?: StatCardTone;
  variant?: StatCardVariant;
  layout?: StatCardLayout;
}) {
  if (variant === "hero" || layout === "stack") {
    const hero = variant === "hero";
    return (
      <Card
        padding="lg"
        className={cn(
          "flex flex-col gap-4",
          hero ? "border-transparent bg-primary text-primary-foreground" : undefined,
        )}
      >
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full",
            hero ? "bg-white/15 text-primary-foreground" : TONE_CLASSES[tone],
          )}
        >
          <Icon className="size-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p
            className={cn(
              "text-xs font-medium uppercase tracking-wide",
              hero ? "text-primary-foreground/70" : "text-muted-foreground",
            )}
          >
            {label}
          </p>
          <p
            className={cn(
              "truncate font-semibold tracking-tight",
              hero ? "text-3xl text-primary-foreground" : "text-2xl text-foreground",
            )}
          >
            {value}
          </p>
          {caption && (
            <p
              className={cn(
                "mt-1 truncate text-xs",
                hero ? "text-primary-foreground/70" : "text-muted-foreground",
              )}
            >
              {caption}
            </p>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card padding="md" className="flex items-center gap-4">
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
        <p className="truncate text-xl font-semibold tracking-tight text-foreground">{value}</p>
        {caption && <p className="truncate text-xs text-muted-foreground">{caption}</p>}
      </div>
    </Card>
  );
}
