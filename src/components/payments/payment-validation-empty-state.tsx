import { Receipt } from "lucide-react";

export function PaymentValidationEmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border border-border bg-surface px-6 py-20 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Receipt className="size-6" aria-hidden />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold text-foreground">
          {hasFilters ? "Sin resultados" : "No hay pagos por validar"}
        </h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          {hasFilters
            ? "No se encontró ningún pago que coincida con la búsqueda o los filtros."
            : "Los pagos aparecerán aquí a medida que se registren en el módulo de Pagos."}
        </p>
      </div>
    </div>
  );
}
