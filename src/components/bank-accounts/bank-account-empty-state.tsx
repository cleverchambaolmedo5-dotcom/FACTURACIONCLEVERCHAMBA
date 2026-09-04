import Link from "next/link";
import { Landmark, Plus } from "lucide-react";

export function BankAccountEmptyState({
  hasQuery,
  canCreate,
}: {
  hasQuery: boolean;
  canCreate: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border border-border bg-surface px-6 py-20 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Landmark className="size-6" aria-hidden />
      </div>
      <div className="space-y-1.5">
        <h2 className="text-lg font-semibold text-foreground">
          {hasQuery ? "Sin resultados" : "No hay cuentas bancarias registradas"}
        </h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          {hasQuery
            ? "No se encontró ninguna cuenta bancaria que coincida con la búsqueda."
            : "Registra la primera cuenta bancaria para recibir pagos."}
        </p>
      </div>
      {!hasQuery && canCreate && (
        <Link
          href="/cuentas-bancarias/nuevo"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-dark"
        >
          <Plus className="size-4" aria-hidden />
          Nueva cuenta bancaria
        </Link>
      )}
    </div>
  );
}
