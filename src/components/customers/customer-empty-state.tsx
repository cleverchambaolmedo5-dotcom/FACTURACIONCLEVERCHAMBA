import Link from "next/link";
import { Users, UserPlus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function CustomerEmptyState({ hasQuery }: { hasQuery: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border border-border bg-surface px-6 py-20 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
        <Users className="size-6" aria-hidden />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold text-foreground">
          {hasQuery ? "Sin resultados" : "Todavía no hay clientes"}
        </h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          {hasQuery
            ? "No se encontró ningún cliente que coincida con la búsqueda."
            : "Registra el primer cliente para empezar a construir el historial comercial."}
        </p>
      </div>
      {!hasQuery && (
        <Link href="/clientes/nuevo" className={buttonVariants()}>
          <UserPlus className="size-4" aria-hidden />
          Nuevo cliente
        </Link>
      )}
    </div>
  );
}
