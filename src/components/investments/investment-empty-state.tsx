import Link from "next/link";
import { LineChart, Plus } from "lucide-react";

export function InvestmentEmptyState({
  hasQuery,
  canCreate,
}: {
  hasQuery: boolean;
  canCreate: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border border-border bg-surface px-6 py-20 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <LineChart className="size-6" aria-hidden />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold text-foreground">
          {hasQuery ? "Sin resultados" : "Todavía no hay inversiones"}
        </h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          {hasQuery
            ? "No se encontró ninguna inversión que coincida con la búsqueda o los filtros."
            : "Registra la primera inversión para empezar a construir el historial."}
        </p>
      </div>
      {!hasQuery && canCreate && (
        <Link
          href="/inversiones/nueva"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-dark"
        >
          <Plus className="size-4" aria-hidden />
          Nueva inversión
        </Link>
      )}
    </div>
  );
}
