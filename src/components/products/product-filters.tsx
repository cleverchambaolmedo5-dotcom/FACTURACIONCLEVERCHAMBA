import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

// Renders only the filter control, no <form> of its own -- see
// ProductSearch for why (both live inside one shared GET form).
export function ProductFilters({ defaultStatus }: { defaultStatus?: string }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <Select id="status" name="status" label="Estado" defaultValue={defaultStatus ?? ""} wrapperClassName="w-auto">
        <option value="">Todos</option>
        <option value="active">Activos</option>
        <option value="inactive">Inactivos</option>
      </Select>

      <Button type="submit">Filtrar</Button>
    </div>
  );
}
