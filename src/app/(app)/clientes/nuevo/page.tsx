import type { Metadata } from "next";
import { requireModuleAccess } from "@/lib/auth/guards";
import { listAssignableSellers } from "@/server/services/customer-service";
import { UserRole } from "@/generated/prisma/enums";
import { CustomerForm } from "@/components/customers/customer-form";
import { createCustomerAction } from "../actions";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: `Nuevo cliente · ${siteConfig.name}` };

export default async function NuevoClientePage() {
  const user = await requireModuleAccess("clientes");
  const sellers =
    user.role === UserRole.SELLER ? [] : await listAssignableSellers();

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Nuevo cliente</h2>
        <p className="text-sm text-muted-foreground">
          Completa los datos para registrar un nuevo cliente.
        </p>
      </div>

      <CustomerForm
        action={createCustomerAction}
        role={user.role}
        sellers={sellers}
        currentUserName={user.name}
        submitLabel="Crear cliente"
      />
    </div>
  );
}
