import { INVESTMENT_STATUS_LABELS } from "./investment-status";

const selectClass =
  "rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary";

// Renders only the filter controls, no <form> of its own -- meant to be
// rendered inside the same GET <form> as the search input (see
// src/app/(app)/inversiones/page.tsx), same pattern as SaleFilters.
export function InvestmentFilters({
  defaultStatus,
  defaultDateFrom,
  defaultDateTo,
}: {
  defaultStatus?: string;
  defaultDateFrom?: string;
  defaultDateTo?: string;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <label htmlFor="status" className="text-xs font-medium text-muted-foreground">
          Estado
        </label>
        <select id="status" name="status" defaultValue={defaultStatus ?? ""} className={selectClass}>
          <option value="">Todos</option>
          {Object.entries(INVESTMENT_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label htmlFor="dateFrom" className="text-xs font-medium text-muted-foreground">
          Inicio desde
        </label>
        <input
          id="dateFrom"
          type="date"
          name="dateFrom"
          defaultValue={defaultDateFrom ?? ""}
          className={selectClass}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="dateTo" className="text-xs font-medium text-muted-foreground">
          Inicio hasta
        </label>
        <input id="dateTo" type="date" name="dateTo" defaultValue={defaultDateTo ?? ""} className={selectClass} />
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
