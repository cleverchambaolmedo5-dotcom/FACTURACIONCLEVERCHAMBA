import Link from "next/link";
import { ShoppingCart, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function SaleEmptyState({ hasQuery, canCreate }: { hasQuery: boolean; canCreate: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border border-border bg-surface px-6 py-20 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
        <ShoppingCart className="size-6" aria-hidden />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold text-foreground">
          {hasQuery ? "Sin resultados" : "Todavía no hay ventas"}
        </h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          {hasQuery
            ? "No se encontró ninguna venta que coincida con la búsqueda o los filtros."
            : "Registra la primera venta para empezar a construir el historial comercial."}
        </p>
      </div>
      {!hasQuery && canCreate && (
        <Link href="/ventas/nueva" className={buttonVariants()}>
          <Plus className="size-4" aria-hidden />
          Nueva venta
        </Link>
      )}
    </div>
  );
}
