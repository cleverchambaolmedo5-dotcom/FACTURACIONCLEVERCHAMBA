import type { Metadata } from "next";
import { requireModuleAccess } from "@/lib/auth/guards";
import { UserForm } from "@/components/users/user-form";
import { createUserAction } from "../actions";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: `Nuevo usuario · ${siteConfig.name}` };

export default async function NuevoUsuarioPage() {
  await requireModuleAccess("usuarios");

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Nuevo usuario</h2>
        <p className="text-sm text-muted-foreground">
          Completa los datos para registrar un nuevo usuario interno. Se crea activo por defecto.
        </p>
      </div>

      <UserForm action={createUserAction} mode="create" submitLabel="Crear usuario" />
    </div>
  );
}
