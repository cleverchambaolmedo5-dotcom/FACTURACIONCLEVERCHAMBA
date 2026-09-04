import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UserRole } from "@/generated/prisma/enums";
import { requireModuleAccess } from "@/lib/auth/guards";
import { BankAccountForm } from "@/components/bank-accounts/bank-account-form";
import { createBankAccountAction } from "../actions";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: `Nueva cuenta bancaria · ${siteConfig.name}` };

// requireModuleAccess("cuentas-bancarias") lets ADMIN and ACCOUNTANT
// through (the module's page-level access, see rbac.ts), but creating an
// account is ADMIN-only within it -- ACCOUNTANT is redirected here just
// like inversiones/nueva/page.tsx redirects ACCOUNTANT away from a
// sub-route the module as a whole allows them into.
export default async function NuevaCuentaBancariaPage() {
  const user = await requireModuleAccess("cuentas-bancarias");
  if (user.role !== UserRole.ADMIN) {
    redirect("/acceso-denegado");
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Nueva cuenta bancaria</h2>
        <p className="text-sm text-muted-foreground">
          Completa los datos de la cuenta. Se crea activa por defecto.
        </p>
      </div>

      <BankAccountForm action={createBankAccountAction} mode="create" submitLabel="Crear cuenta bancaria" />
    </div>
  );
}
