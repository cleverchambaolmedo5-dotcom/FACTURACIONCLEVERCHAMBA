import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Todas" },
  { value: "PENDING", label: "Pendientes" },
  { value: "PAID", label: "Pagadas" },
  { value: "OVERDUE", label: "Vencidas" },
  { value: "UPCOMING", label: "Próximas a vencer" },
];

// Renders only the filter controls, no <form> of its own -- meant to be
// rendered inside the same GET <form> as the search input, mirroring
// PaymentFilters/SaleFilters. `status` values are the CuotaFilterStatus
// buckets from payment-service.ts#listCuotasForUser, not the raw
// InstallmentStatus enum -- PARTIALLY_PAID cuotas fall under "Pendientes"
// here, matching the module's simplified pendiente/pagada/vencida view.
export function CuotaFilters({ defaultStatus }: { defaultStatus?: string }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <Select id="status" name="status" label="Estado" defaultValue={defaultStatus ?? ""} wrapperClassName="w-auto">
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>

      <Button type="submit">Filtrar</Button>
    </div>
  );
}
