import type { Metadata } from "next";
import Link from "next/link";
import { Plus, ArrowLeftRight } from "lucide-react";
import { UserRole } from "@/generated/prisma/enums";
import { requireModuleAccess } from "@/lib/auth/guards";
import {
  listBankAccountsForUser,
  type BankAccountStatusFilter,
} from "@/server/services/bank-account-service";
import { BankAccountSearch } from "@/components/bank-accounts/bank-account-search";
import { BankAccountFilters } from "@/components/bank-accounts/bank-account-filters";
import { BankAccountTable } from "@/components/bank-accounts/bank-account-table";
import { BankAccountEmptyState } from "@/components/bank-accounts/bank-account-empty-state";
import { buttonVariants } from "@/components/ui/button";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: `Cuentas bancarias · ${siteConfig.name}` };

function isBankAccountStatusFilter(value: string): value is BankAccountStatusFilter {
  return value === "active" || value === "inactive";
}

// requireModuleAccess("cuentas-bancarias") gates page-level access to
// ADMIN/ACCOUNTANT (see rbac.ts; SELLER gets "none"). Within the module,
// ADMIN has full CRUD and ACCOUNTANT is read-only -- listBankAccountsForUser
// and BankAccountTable's currentUserRole branching handle that distinction,
// while createBankAccountForAdmin/updateBankAccountForAdmin/
// toggleBankAccountStatusForAdmin/deleteBankAccountForAdmin (bank-account-
// service.ts) each re-check actingUser.role === ADMIN again on their own,
// as defense in depth. Mirrors productos/page.tsx.
export default async function CuentasBancariasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const user = await requireModuleAccess("cuentas-bancarias");
  const { q, status: statusRaw } = await searchParams;
  const search = q?.trim() || undefined;
  const status = statusRaw && isBankAccountStatusFilter(statusRaw) ? statusRaw : "all";

  const bankAccounts = await listBankAccountsForUser(user, { search, status });
  const hasFilters = !!(search || status !== "all");
  const canCreate = user.role === UserRole.ADMIN;

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Cuentas bancarias</h2>
          <p className="text-sm text-muted-foreground">
            Cuentas bancarias utilizadas para recibir pagos.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/cuentas-bancarias/movimientos" className={buttonVariants({ variant: "secondary" })}>
            <ArrowLeftRight className="size-4" aria-hidden />
            Movimientos
          </Link>
          {canCreate && (
            <Link href="/cuentas-bancarias/nuevo" className={buttonVariants()}>
              <Plus className="size-4" aria-hidden />
              Nueva cuenta bancaria
            </Link>
          )}
        </div>
      </div>

      <form action="/cuentas-bancarias" method="GET" className="flex flex-col gap-3">
        <BankAccountSearch defaultValue={search} />
        <BankAccountFilters defaultStatus={status === "all" ? undefined : status} />
      </form>

      {bankAccounts.length === 0 ? (
        <BankAccountEmptyState hasQuery={hasFilters} canCreate={canCreate} />
      ) : (
        <BankAccountTable bankAccounts={bankAccounts} currentUserRole={user.role} />
      )}
    </div>
  );
}
