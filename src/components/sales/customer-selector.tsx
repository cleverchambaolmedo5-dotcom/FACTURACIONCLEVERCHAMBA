"use client";

import { useEffect, useEffectEvent, useRef, useState, useTransition } from "react";
import { Search, UserRoundPlus } from "lucide-react";
import { UserRole } from "@/generated/prisma/enums";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  CustomerCreateModal,
  type CreatedCustomer,
  type NewCustomerAction,
} from "./customer-create-modal";

export type CustomerSearchResult = {
  id: string;
  fullName: string;
  phone: string;
  // Optional -- see Customer.identification in schema.prisma.
  identification: string | null;
};

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Search-and-select customer picker for the "Nueva venta" form, replacing
 * the old plain <select>. Renders a hidden `customerId` input so it still
 * submits like any other form field; the actual scoping (a SELLER only
 * ever getting their own customers back) happens server-side inside
 * `searchAction`, never here.
 */
export function CustomerSelector({
  error,
  searchAction,
  createAction,
  role,
  sellers,
  currentUserName,
}: {
  error?: string;
  searchAction: (query: string) => Promise<CustomerSearchResult[]>;
  createAction: NewCustomerAction;
  role: UserRole;
  sellers: { id: string; name: string }[];
  currentUserName: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerSearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [selected, setSelected] = useState<CreatedCustomer | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const latestRequest = useRef(0);

  // DEBUG INSTRUMENTATION -- temporary, remove after diagnosing the
  // repeated-search issue.
  useEffect(() => {
    console.log("[CustomerSelector] MOUNTED");
    return () => console.log("[CustomerSelector] UNMOUNTED");
  }, []);

  // `searchAction` is a Server Action reference passed down from the
  // server-rendered page. It is *not* guaranteed to keep the same JS
  // identity across every render (e.g. a route revalidation triggered by
  // anything else on the page hands the client a freshly-deserialized
  // reference for the same action). useEffectEvent gives us a handle that
  // always calls the *latest* searchAction without being itself a reactive
  // value -- so it can be called from the effect below without being a
  // dependency, and an identity change alone can never re-trigger a search.
  const runSearch = useEffectEvent(async (trimmed: string, requestId: number) => {
    console.log("[CustomerSelector] runSearch CALLED", { trimmed, requestId });
    const found = await searchAction(trimmed);
    // Ignore results from a stale, superseded request (e.g. the user kept
    // typing after this search fired).
    if (latestRequest.current === requestId) {
      setResults(found);
      setHasSearched(true);
    }
  });

  useEffect(() => {
    console.log("[CustomerSelector] search-effect RAN", { query });
    const trimmed = query.trim();
    if (!trimmed) {
      // Clearing the query is handled synchronously in handleQueryChange
      // below, not here -- an effect body shouldn't set state on its own
      // initiative outside of reacting to an external system.
      return;
    }

    const requestId = ++latestRequest.current;
    const timeout = setTimeout(() => {
      startTransition(() => runSearch(trimmed, requestId));
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [query]);

  function handleQueryChange(value: string) {
    setQuery(value);
    if (!value.trim()) {
      setResults([]);
      setHasSearched(false);
    }
  }

  function handleSelect(customer: CustomerSearchResult) {
    setSelected(customer);
    setQuery("");
    setResults([]);
    setHasSearched(false);
  }

  function handleCreated(customer: CreatedCustomer) {
    setSelected(customer);
    setModalOpen(false);
    setQuery("");
    setResults([]);
    setHasSearched(false);
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name="customerId" value={selected?.id ?? ""} />

      {selected ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <UserAvatar name={selected.fullName} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{selected.fullName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {selected.identification || "—"} · {selected.phone}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="shrink-0 text-sm font-medium text-primary hover:underline"
          >
            Cambiar
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => handleQueryChange(event.target.value)}
              onKeyDown={(event) => {
                // Enter must never submit the parent form from here -- it
                // should only ever confirm a search, and picking a result is
                // done by clicking it below. Without this, pressing Enter
                // while typing submits the form with an empty customerId
                // (the user hasn't clicked a result yet), and the resulting
                // stale server error then lingers even after they do select
                // one -- see the `error && !selected` guard below.
                if (event.key === "Enter") {
                  event.preventDefault();
                }
              }}
              placeholder="Buscar por nombre, teléfono o identificación…"
              aria-label="Buscar cliente"
              error={error}
              className="pl-9"
            />
          </div>

          {isPending && <p className="text-sm text-muted-foreground">Buscando…</p>}

          {!isPending && results.length > 0 && (
            <ul className="divide-y divide-border overflow-hidden rounded-md border border-border bg-surface">
              {results.map((customer) => (
                <li key={customer.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(customer)}
                    className="flex w-full flex-col items-start px-3 py-2 text-left text-sm transition-colors hover:bg-row-hover"
                  >
                    <span className="font-medium text-foreground">{customer.fullName}</span>
                    <span className="text-xs text-muted-foreground">
                      {customer.identification || "—"} · {customer.phone}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!isPending && hasSearched && results.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No encontramos un cliente con esos datos.
            </p>
          )}

          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <UserRoundPlus className="size-3.5" aria-hidden />
            Registrar nuevo cliente
          </button>
        </>
      )}

      {/* `error` reflects the last server response, not live client state --
          once the user has picked a customer client-side, keep it hidden so
          a stale "Selecciona un cliente válido" from a previous submission
          doesn't linger and read as if the fresh selection didn't take. */}
      {error && !selected && <p className="text-sm text-error">{error}</p>}

      {modalOpen && (
        <CustomerCreateModal
          onClose={() => setModalOpen(false)}
          onCreated={handleCreated}
          action={createAction}
          role={role}
          sellers={sellers}
          currentUserName={currentUserName}
        />
      )}
    </div>
  );
}
