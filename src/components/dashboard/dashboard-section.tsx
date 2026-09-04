import Link from "next/link";
import { ArrowRight } from "lucide-react";

// Shared "card list" wrapper for every dashboard section (Ventas recientes,
// Próximos pagos, Cuotas vencidas, etc.): a title/description, an optional
// "ver todas" link to the real module, and a plain-text empty state instead
// of an empty table -- mirrors the empty-state convention already used by
// PaymentEmptyState/SaleEmptyState, kept lightweight here since these are
// dashboard previews, not full module listings.
export function DashboardSection({
  title,
  description,
  actionHref,
  actionLabel,
  isEmpty,
  emptyMessage,
  children,
}: {
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
  isEmpty: boolean;
  emptyMessage: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {actionHref && actionLabel && (
          <Link
            href={actionHref}
            className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            {actionLabel}
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        )}
      </div>
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
