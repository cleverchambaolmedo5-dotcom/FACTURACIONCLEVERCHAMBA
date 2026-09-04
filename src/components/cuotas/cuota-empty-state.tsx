import { CalendarClock } from "lucide-react";

export function CuotaEmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border border-border bg-surface px-6 py-20 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <CalendarClock className="size-6" aria-hidden />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold text-foreground">
          {hasFilters
            ? "No se encontraron cuotas con estos filtros."
            : "Actualmente no hay cuotas registradas."}
        </h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          {hasFilters
            ? "Ajusta la búsqueda o el filtro de estado para ver otras cuotas."
            : "Las cuotas aparecerán aquí una vez que se registren ventas."}
        </p>
      </div>
    </div>
  );
}
