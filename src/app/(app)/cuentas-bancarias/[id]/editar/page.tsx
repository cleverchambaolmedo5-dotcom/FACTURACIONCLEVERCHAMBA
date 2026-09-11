import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { UserRole } from "@/generated/prisma/enums";
import { requireModuleAccess } from "@/lib/auth/guards";
import { getBankAccountForUser } from "@/server/services/bank-account-service";
import { BankAccountForm } from "@/components/bank-accounts/bank-account-form";
import { updateBankAccountAction } from "../../actions";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: `Editar cuenta bancaria · ${siteConfig.name}` };

// Editing is ADMIN-only within the module -- ACCOUNTANT (who otherwise has
// read-only page access, see rbac.ts) is redirected away, mirroring
// cuentas-bancarias/nuevo/page.tsx.
export default async function EditarCuentaBancariaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireModuleAccess("cuentas-bancarias");
  if (user.role !== UserRole.ADMIN) {
    redirect("/acceso-denegado");
  }
  const { id } = await params;

  const bankAccount = await getBankAccountForUser(user, id);
  if (!bankAccount) {
    notFound();
  }

  const boundAction = updateBankAccountAction.bind(null, bankAccount.id);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Editar cuenta bancaria</h2>
        <p className="text-sm text-muted-foreground">
          {bankAccount.bankName} · {bankAccount.alias}
        </p>
      </div>

      <BankAccountForm
        action={boundAction}
        mode="edit"
        submitLabel="Guardar cambios"
        defaults={{
          bankName: bankAccount.bankName,
          alias: bankAccount.alias,
          accountHolder: bankAccount.accountHolder,
          accountType: bankAccount.accountType,
          accountNumber: bankAccount.accountNumber,
          currency: bankAccount.currency,
          instructions: bankAccount.instructions ?? "",
          active: bankAccount.active,
        }}
      />
    </div>
  );
}
