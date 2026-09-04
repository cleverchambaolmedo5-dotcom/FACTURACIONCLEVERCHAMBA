import { Search } from "lucide-react";

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
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-surface py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
      />
    </div>
  );
}
