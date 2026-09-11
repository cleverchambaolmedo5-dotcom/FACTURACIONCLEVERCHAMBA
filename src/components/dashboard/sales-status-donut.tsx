import { cn } from "@/lib/utils";

// Pure presentational breakdown of the sale-status counts every Ventas
// dashboard already computes (SalesDashboardStats in dashboard-service.ts)
// -- no new query, no derived figure beyond counts that are already on the
// page. Segment order/labels mirror SaleTable's own STATUS_LABELS so the
// donut never disagrees with the table it sits next to.
export type SalesStatusBreakdown = {
  paid: number;
  partiallyPaid: number;
  overdue: number;
  pending: number;
};

const SEGMENTS: {
  key: keyof SalesStatusBreakdown;
  label: string;
  dotClassName: string;
  color: string;
}[] = [
  { key: "paid", label: "Pagadas", dotClassName: "bg-success", color: "var(--status-success)" },
  { key: "partiallyPaid", label: "Parcialmente pagadas", dotClassName: "bg-warning", color: "var(--status-warning)" },
  { key: "overdue", label: "Vencidas", dotClassName: "bg-error", color: "var(--status-error)" },
  { key: "pending", label: "Pendientes", dotClassName: "bg-muted-foreground", color: "var(--muted-foreground)" },
];

export function SalesStatusDonut({
  breakdown,
  totalLabel,
}: {
  breakdown: SalesStatusBreakdown;
  totalLabel: string;
}) {
  const total = breakdown.paid + breakdown.partiallyPaid + breakdown.overdue + breakdown.pending;

  let cursor = 0;
  const stops: string[] = [];
  for (const segment of SEGMENTS) {
    const count = breakdown[segment.key];
    if (count <= 0 || total === 0) continue;
    const start = (cursor / total) * 360;
    cursor += count;
    const end = (cursor / total) * 360;
    stops.push(`${segment.color} ${start}deg ${end}deg`);
  }
  const gradient = stops.length > 0 ? `conic-gradient(${stops.join(", ")})` : "var(--border)";

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row">
      <div
        className="relative flex size-36 shrink-0 items-center justify-center rounded-full"
        style={{ background: gradient }}
      >
        <div className="flex size-24 flex-col items-center justify-center rounded-full bg-surface text-center">
          <span className="text-2xl font-semibold text-foreground">{total}</span>
          <span className="text-[11px] text-muted-foreground">{totalLabel}</span>
        </div>
      </div>
      <ul className="flex w-full flex-col gap-2.5">
        {SEGMENTS.map((segment) => {
          const count = breakdown[segment.key];
          const pct = total > 0 ? (count / total) * 100 : 0;
          return (
            <li key={segment.key} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 text-foreground">
                <span className={cn("size-2.5 shrink-0 rounded-full", segment.dotClassName)} aria-hidden />
                {segment.label}
              </span>
              <span className="shrink-0 text-muted-foreground">
                {count} ({pct.toFixed(0)}%)
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
