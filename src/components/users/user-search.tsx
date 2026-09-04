import { Search } from "lucide-react";

// Plain GET form -- no client-side JS required. Submitting navigates to
// `/usuarios?q=...`, which the page reads via `searchParams`. Mirrors
// CustomerSearch (src/components/customers/customer-search.tsx).
export function UserSearch({ defaultValue }: { defaultValue?: string }) {
  return (
    <form action="/usuarios" method="GET" className="relative w-full max-w-sm">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="Buscar por nombre o usuario…"
        className="w-full rounded-md border border-border bg-surface py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
      />
    </form>
  );
}
