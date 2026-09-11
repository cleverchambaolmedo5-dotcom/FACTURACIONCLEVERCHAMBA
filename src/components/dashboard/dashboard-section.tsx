import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

// Shared "card list" wrapper for every dashboard section (Ventas recientes,
// Próximos pagos, Cuotas vencidas, etc.): a title/description, an optional
// "ver todas" link to the real module, and a plain-text empty state instead
// of an empty table -- mirrors the empty-state convention already used by
// PaymentEmptyState/SaleEmptyState, kept lightweight here since these are
// dashboard previews, not full module listings.
//
// `variant="card"` (opt-in, used by the Ventas dashboards) additionally
// wraps the whole section -- header and content -- in a single bordered/
// shadowed Card and lets an icon be shown next to the title. The default
// `variant="plain"` renders exactly as before, so every other existing call
// site (Inversiones dashboards, etc.) is visually unchanged.
export function DashboardSection({
  title,
  description,
  actionHref,
  actionLabel,
  icon: Icon,
  variant = "plain",
  isEmpty,
  emptyMessage,
  children,
}: {
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
  icon?: LucideIcon;
  variant?: "plain" | "card";
  isEmpty: boolean;
  emptyMessage: string;
  children: React.ReactNode;
}) {
  const header = (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {Icon && variant === "card" && (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Icon className="size-5" aria-hidden />
          </div>
        )}
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary-dark"
        >
          {actionLabel}
          <ArrowRight className="size-3.5" aria-hidden />
        </Link>
      )}
    </div>
  );

  if (variant === "card") {
    return (
      <section>
        <Card padding="none" className="overflow-hidden">
          <div className="p-5">{header}</div>
          {isEmpty ? (
            <p className="border-t border-border px-5 py-10 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </p>
          ) : (
            <div className="border-t border-border">{children}</div>
          )}
        </Card>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      {header}
      {isEmpty ? (
        <p className="rounded-lg border border-dashed border-border bg-surface px-4 py-8 text-center text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        children
      )}
    </section>
  );
}
