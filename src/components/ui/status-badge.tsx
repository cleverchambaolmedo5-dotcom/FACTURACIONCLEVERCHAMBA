import { cn } from "@/lib/utils";

// Reusable visual states for future financial statuses (Sale, Installment,
// Payment, etc.). No business logic lives here -- this only prepares the
// visual language so upcoming modules can map their own status enums onto
// one of these tones instead of hardcoding colors.
//
//   success ("pagado" / "aprobado")   -> green
//   pending ("pendiente")             -> blue (brand primary) / neutral
//   warning ("próximo a vencer")      -> amber
//   error   ("vencido" / "rechazado") -> red
//   neutral (anything without a clear semantic state yet)
export type StatusTone = "success" | "pending" | "warning" | "error" | "neutral";

const TONE_CLASSES: Record<StatusTone, string> = {
  success: "bg-success/10 text-success ring-success/20",
  pending: "bg-primary/10 text-primary ring-primary/20",
  warning: "bg-warning/10 text-warning ring-warning/20",
  error: "bg-error/10 text-error ring-error/20",
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
