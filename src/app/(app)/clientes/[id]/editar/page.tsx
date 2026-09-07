import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireModuleAccess } from "@/lib/auth/guards";
import {
  getCustomerForUser,
  listAssignableSellers,
} from "@/server/services/customer-service";
import { UserRole } from "@/generated/prisma/enums";
import { CustomerForm } from "@/components/customers/customer-form";
import { CustomerDeleteButton } from "@/components/customers/customer-delete-button";
import { updateCustomerAction } from "../../actions";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: `Editar cliente · ${siteConfig.name}` };

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireModuleAccess("clientes");
  const { id } = await params;

  // Record-level permission (a SELLER only ever gets their own customer
  // back) is enforced inside getCustomerForUser. A customer that doesn't
  // exist and one that exists but isn't the SELLER's look identical here
  // on purpose -- both render the same 404.
  const customer = await getCustomerForUser(user, id);
  if (!customer) {
    notFound();
  }

  const sellers =
    user.role === UserRole.SELLER ? [] : await listAssignableSellers();

  const boundAction = updateCustomerAction.bind(null, customer.id);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Editar cliente</h2>
          <p className="text-sm text-muted-foreground">{customer.fullName}</p>
        </div>
        {user.role === UserRole.ADMIN && (
          <CustomerDeleteButton customerId={customer.id} redirectTo="/clientes" />
        )}
      </div>

      <CustomerForm
        action={boundAction}
        role={user.role}
        sellers={sellers}
        currentUserName={user.name}
        submitLabel="Guardar cambios"
        defaults={{
          fullName: customer.fullName,
          identification: customer.identification ?? "",
          phone: customer.phone,
          email: customer.email ?? "",
          country: customer.country,
          address: customer.address ?? "",
          assignedSellerId: customer.assignedSellerId,
        }}
      />
    </div>
  );
}
