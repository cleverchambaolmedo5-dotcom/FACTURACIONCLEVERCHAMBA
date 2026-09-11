import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

// Plain GET form -- no client-side JS required. Submitting navigates to
// `/clientes?q=...`, which the page reads via `searchParams`. Works
// identically with or without JavaScript.
export function CustomerSearch({ defaultValue }: { defaultValue?: string }) {
  return (
    <form action="/clientes" method="GET" className="relative w-full max-w-sm">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        name="q"
        defaultValue={defaultValue}
        placeholder="Buscar por nombre, email o teléfono…"
        className="pl-9"
      />
    </form>
  );
}
