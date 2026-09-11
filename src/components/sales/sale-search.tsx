import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

// Renders only the search input, no <form> of its own -- it's meant to be
// rendered inside the same GET <form> as SaleFilters (see
// src/app/(app)/ventas/page.tsx) so both submit together as one query
// string instead of clobbering each other.
export function SaleSearch({
  defaultValue,
  placeholder = "Buscar por cliente o producto…",
}: {
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <div className="relative w-full sm:max-w-sm">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input type="search" name="q" defaultValue={defaultValue} placeholder={placeholder} className="pl-9" />
    </div>
  );
}
