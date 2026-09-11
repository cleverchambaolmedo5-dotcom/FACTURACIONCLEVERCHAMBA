import { cn } from "@/lib/utils";

// Reusable visual states for financial statuses (Sale, Installment,
// Payment, etc.). No business logic lives here -- this only prepares the
// visual language so modules map their own status enums onto one of these
// tones instead of hardcoding colors. "info" was added alongside "pending"
// (same look) for callers that want the more generic name; existing
// tone="pending" usage across the app keeps working unchanged.
//
//   success ("pagado" / "aprobado")     -> green
//   pending / info ("pendiente")        -> blue (brand primary)
//   warning ("próximo a vencer")        -> amber
//   error   ("vencido" / "rechazado")   -> red
//   neutral (anything without a clear semantic state yet)
export type StatusTone = "success" | "pending" | "info" | "warning" | "error" | "neutral";

const TONE_CLASSES: Record<StatusTone, string> = {
  success: "bg-success-soft text-success ring-success/20",
  pending: "bg-primary-soft text-primary ring-primary/20",
  info: "bg-primary-soft text-primary ring-primary/20",
  warning: "bg-warning-soft text-warning ring-warning/20",
  error: "bg-error-soft text-error ring-error/20",
  neutral: "bg-black/5 text-muted-foreground ring-black/10",
};

export function StatusBadge({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
