import { PaymentValidationStatus } from "@/generated/prisma/enums";
import { VALIDATION_STATUS_LABELS } from "@/components/payments/validation-status-badge";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Renders only the filter controls, no <form> of its own -- meant to be
// rendered inside the same GET <form> as the search input, mirroring
// SaleFilters/SaleSearch in the ventas module.
export function PaymentFilters({
  products,
  sellers,
  defaultProductId,
  defaultStatus,
  defaultDateFrom,
  defaultDateTo,
  defaultSellerId,
}: {
  products: { id: string; name: string }[];
  // Only passed (non-undefined) for ADMIN -- see pagos/page.tsx.
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
        {Object.values(PaymentValidationStatus).map((value) => (
          <option key={value} value={value}>
            {VALIDATION_STATUS_LABELS[value]}
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
