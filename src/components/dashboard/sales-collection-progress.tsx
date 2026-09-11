const currencyFormatter = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

// Visual stand-in for a real "evolución de ventas y cobranza" time-series
// chart, which this app has no monthly-bucketed query for. Renders only the
// two cents figures every Ventas dashboard already receives
// (FinancialSummary from dashboard-service.ts) as a collected-vs-pending
// split of the same total -- no new query, no historical/trend data
// implied.
export function SalesCollectionProgress({
  totalCents,
  collectedCents,
  pendingCents,
}: {
  totalCents: number;
  collectedCents: number;
  pendingCents: number;
}) {
  const collectedPct = totalCents > 0 ? (collectedCents / totalCents) * 100 : 0;
  const pendingPct = totalCents > 0 ? (pendingCents / totalCents) * 100 : 0;

  return (
    <div className="flex flex-col gap-5">
      {totalCents > 0 ? (
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-border">
          <div className="h-full bg-success" style={{ width: `${collectedPct}%` }} />
          <div className="h-full bg-warning" style={{ width: `${pendingPct}%` }} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Todavía no hay ventas registradas.</p>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <span className="size-2.5 shrink-0 rounded-full bg-success" aria-hidden />
            Total cobrado
          </p>
          <p className="mt-1.5 truncate text-lg font-semibold text-foreground">
            {currencyFormatter.format(collectedCents / 100)}
          </p>
          <p className="text-xs text-muted-foreground">{collectedPct.toFixed(1)}% del total</p>
        </div>
        <div>
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <span className="size-2.5 shrink-0 rounded-full bg-warning" aria-hidden />
            Saldo por cobrar
          </p>
          <p className="mt-1.5 truncate text-lg font-semibold text-foreground">
            {currencyFormatter.format(pendingCents / 100)}
          </p>
          <p className="text-xs text-muted-foreground">{pendingPct.toFixed(1)}% pendiente</p>
        </div>
      </div>
    </div>
  );
}
