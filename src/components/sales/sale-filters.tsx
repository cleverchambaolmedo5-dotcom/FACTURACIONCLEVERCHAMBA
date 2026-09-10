import { SaleStatus } from "@/generated/prisma/enums";

const STATUS_LABELS: Record<SaleStatus, string> = {
  // Mirrors sale-table.tsx's own relabeling -- ACTIVE means "no payment
  // approved yet", shown as "Pendiente" everywhere in Ventas.
  ACTIVE: "Pendiente",
  PARTIALLY_PAID: "Parcialmente pagada",
  PAID: "Pagada",
  OVERDUE: "Vencida",
  CANCELLED: "Cancelada",
};

const selectClass =
  "rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary";

// Renders only the filter controls, no <form> of its own -- see
// SaleSearch for why (both live inside one shared GET form).
export function SaleFilters({
  products,
  sellers,
  defaultProductId,
  defaultStatus,
  defaultDateFrom,
  defaultDateTo,
  defaultSellerId,
}: {
  products: { id: string; name: string }[];
  // Only passed (non-undefined) for ADMIN/ACCOUNTANT -- see ventas/page.tsx.
  sellers?: { id: string; name: string }[];
  defaultProductId?: string;
  defaultStatus?: string;
  defaultDateFrom?: string;
  defaultDateTo?: string;
  defaultSellerId?: string;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <label htmlFor="productId" className="text-xs font-medium text-muted-foreground">
          Producto
        </label>
        <select id="productId" name="productId" defaultValue={defaultProductId ?? ""} className={selectClass}>
          <option value="">Todos</option>
          {products.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label htmlFor="status" className="text-xs font-medium text-muted-foreground">
          Estado
        </label>
        <select id="status" name="status" defaultValue={defaultStatus ?? ""} className={selectClass}>
          <option value="">Todos</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
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
