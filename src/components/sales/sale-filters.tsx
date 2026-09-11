import { SaleStatus } from "@/generated/prisma/enums";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const STATUS_LABELS: Record<SaleStatus, string> = {
  // Mirrors sale-table.tsx's own relabeling -- ACTIVE means "no payment
  // approved yet", shown as "Pendiente" everywhere in Ventas.
  ACTIVE: "Pendiente",
  PARTIALLY_PAID: "Parcialmente pagada",
  PAID: "Pagada",
  OVERDUE: "Vencida",
  CANCELLED: "Cancelada",
};

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
      <Select
        id="productId"
        name="productId"
        label="Producto"
        defaultValue={defaultProductId ?? ""}
        wrapperClassName="w-auto"
      >
        <option value="">Todos</option>
        {products.map((product) => (
          <option key={product.id} value={product.id}>
            {product.name}
          </option>
        ))}
      </Select>

      <Select
        id="status"
        name="status"
        label="Estado"
        defaultValue={defaultStatus ?? ""}
        wrapperClassName="w-auto"
      >
        <option value="">Todos</option>
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>

      {sellers && (
        <Select
          id="sellerId"
          name="sellerId"
          label="Vendedor"
          defaultValue={defaultSellerId ?? ""}
          wrapperClassName="w-auto"
        >
          <option value="">Todos</option>
          {sellers.map((seller) => (
            <option key={seller.id} value={seller.id}>
              {seller.name}
            </option>
          ))}
        </Select>
      )}

      <Input
        id="dateFrom"
        type="date"
        name="dateFrom"
        label="Desde"
        defaultValue={defaultDateFrom ?? ""}
        wrapperClassName="w-auto"
      />

      <Input
        id="dateTo"
        type="date"
        name="dateTo"
        label="Hasta"
        defaultValue={defaultDateTo ?? ""}
        wrapperClassName="w-auto"
      />

      <Button type="submit">Filtrar</Button>
    </div>
  );
}
