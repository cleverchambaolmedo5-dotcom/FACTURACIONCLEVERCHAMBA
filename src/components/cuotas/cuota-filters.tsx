const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Todas" },
  { value: "PENDING", label: "Pendientes" },
  { value: "PAID", label: "Pagadas" },
  { value: "OVERDUE", label: "Vencidas" },
  { value: "UPCOMING", label: "Próximas a vencer" },
];

const selectClass =
  "rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary";

// Renders only the filter controls, no <form> of its own -- meant to be
// rendered inside the same GET <form> as the search input, mirroring
// PaymentFilters/SaleFilters. `status` values are the CuotaFilterStatus
// buckets from payment-service.ts#listCuotasForUser, not the raw
// InstallmentStatus enum -- PARTIALLY_PAID cuotas fall under "Pendientes"
// here, matching the module's simplified pendiente/pagada/vencida view.
export function CuotaFilters({ defaultStatus }: { defaultStatus?: string }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <label htmlFor="status" className="text-xs font-medium text-muted-foreground">
          Estado
        </label>
        <select id="status" name="status" defaultValue={defaultStatus ?? ""} className={selectClass}>
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-dark"
      >
        Filtrar
      </button>
    </div>
  );
}
