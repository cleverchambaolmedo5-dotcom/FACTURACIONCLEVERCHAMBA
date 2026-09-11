import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

// Renders only the search input, no <form> of its own -- meant to be
// rendered inside the same GET <form> as ProductFilters (see
// src/app/(app)/productos/page.tsx) so both submit together as one query
// string, mirroring SaleSearch/SaleFilters.
export function ProductSearch({ defaultValue }: { defaultValue?: string }) {
  return (
    <div className="relative w-full sm:max-w-sm">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="Buscar por nombre o descripción…"
        className="pl-9"
      />
    </div>
  );
}
