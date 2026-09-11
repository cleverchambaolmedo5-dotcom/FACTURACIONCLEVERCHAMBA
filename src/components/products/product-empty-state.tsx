import Link from "next/link";
import { Package, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function ProductEmptyState({
  hasQuery,
  canCreate,
}: {
  hasQuery: boolean;
  canCreate: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border border-border bg-surface px-6 py-20 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Package className="size-6" aria-hidden />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold text-foreground">
          {hasQuery ? "Sin resultados" : "No hay productos registrados"}
        </h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          {hasQuery
            ? "No se encontró ningún producto que coincida con la búsqueda."
            : "Crea tu primer curso, mentoría o asesoría para comenzar a registrar ventas."}
        </p>
      </div>
      {!hasQuery && canCreate && (
        <Link href="/productos/nuevo" className={buttonVariants()}>
          <Plus className="size-4" aria-hidden />
          Nuevo producto
        </Link>
      )}
    </div>
  );
}
