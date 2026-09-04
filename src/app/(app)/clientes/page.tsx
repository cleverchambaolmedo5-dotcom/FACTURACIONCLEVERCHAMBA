import type { Metadata } from "next";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { requireModuleAccess } from "@/lib/auth/guards";
import { listCustomersForUser } from "@/server/services/customer-service";
import { CustomerSearch } from "@/components/customers/customer-search";
import { CustomerTable } from "@/components/customers/customer-table";
import { CustomerEmptyState } from "@/components/customers/customer-empty-state";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: `Clientes · ${siteConfig.name}` };

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireModuleAccess("clientes");
  const { q } = await searchParams;
  const search = q?.trim() || undefined;

  const customers = await listCustomersForUser(user, search);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Clientes</h2>
          <p className="text-sm text-muted-foreground">
            Clientes de la academia y su vendedor responsable.
          </p>
        </div>
        <Link
          href="/clientes/nuevo"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-dark"
        >
          <UserPlus className="size-4" aria-hidden />
          Nuevo cliente
        </Link>
      </div>

      <CustomerSearch defaultValue={search} />

      {customers.length === 0 ? (
        <CustomerEmptyState hasQuery={!!search} />
      ) : (
        <CustomerTable customers={customers} currentUserRole={user.role} />
      )}
    </div>
  );
}
