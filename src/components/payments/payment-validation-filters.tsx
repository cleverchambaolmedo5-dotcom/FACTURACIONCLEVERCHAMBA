import { PaymentValidationStatus } from "@/generated/prisma/enums";
import { VALIDATION_STATUS_LABELS } from "@/components/payments/validation-status-badge";

const selectClass =
  "rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary";

// Renders only the filter controls, no <form> of its own -- meant to be
// rendered inside the same GET <form> as the search input, mirroring
// PaymentFilters/SaleFilters.
export function PaymentValidationFilters({
  sellers,
  defaultStatus,
  defaultDateFrom,
  defaultDateTo,
  defaultSellerId,
}: {
  // Only passed (non-undefined) for ADMIN -- see comprobantes/page.tsx.
  sellers?: { id: string; name: string }[];
  defaultStatus?: string;
  defaultDateFrom?: string;
  defaultDateTo?: string;
  defaultSellerId?: string;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <label htmlFor="status" className="text-xs font-medium text-muted-foreground">
          Estado
        </label>
        <select id="status" name="status" defaultValue={defaultStatus ?? ""} className={selectClass}>
          <option value="">Todos</option>
          {Object.values(PaymentValidationStatus).map((value) => (
            <option key={value} value={value}>
              {VALIDATION_STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </div>

      {sellers && (
        <div className="space-y-1">
          <label htmlFor="sellerId" className="text-xs font-medium text-muted-foreground">
            Vendedor
          </label>
          <select id="sellerId" name="sellerId" defaultValue={defaultSellerId ?? ""} className={selectClass}>
            <option value="">Todos</option>
            {sellers.map((seller) => (
              <option key={seller.id} value={seller.id}>
                {seller.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-1">
        <label htmlFor="dateFrom" className="text-xs font-medium text-muted-foreground">
          Desde
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
          Hasta
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
