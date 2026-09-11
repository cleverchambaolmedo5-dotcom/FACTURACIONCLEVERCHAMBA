import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

// Renders only the filter control, no <form> of its own -- see
// BankAccountSearch for why (both live inside one shared GET form).
export function BankAccountFilters({ defaultStatus }: { defaultStatus?: string }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <Select id="status" name="status" label="Estado" defaultValue={defaultStatus ?? ""} wrapperClassName="w-auto">
        <option value="">Todas</option>
        <option value="active">Activas</option>
        <option value="inactive">Inactivas</option>
      </Select>

      <Button type="submit">Filtrar</Button>
    </div>
  );
}
