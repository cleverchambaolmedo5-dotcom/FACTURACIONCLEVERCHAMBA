import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireModuleAccess } from "@/lib/auth/guards";
import { getManagedUserForAdmin } from "@/server/services/user-management-service";
import { UserForm } from "@/components/users/user-form";
import { updateUserAction } from "../../actions";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: `Editar usuario · ${siteConfig.name}` };

export default async function EditarUsuarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireModuleAccess("usuarios");
  const { id } = await params;

  // getManagedUserForAdmin re-checks ADMIN on its own (defense in depth,
  // see user-management-service.ts) -- a non-ADMIN never reaches here in
  // the first place, requireModuleAccess("usuarios") already redirected.
  const managedUser = await getManagedUserForAdmin(user, id);
  if (!managedUser) {
    notFound();
  }

  const boundAction = updateUserAction.bind(null, managedUser.id);

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Editar usuario</h2>
        <p className="text-sm text-muted-foreground">{managedUser.name}</p>
      </div>

      <UserForm
        action={boundAction}
        mode="edit"
        submitLabel="Guardar cambios"
        isSelf={managedUser.id === user.id}
        defaults={{
          name: managedUser.name,
          email: managedUser.email,
          role: managedUser.role,
          status: managedUser.status,
        }}
      />
    </div>
  );
}
