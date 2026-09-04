import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { getProfileForUser } from "@/server/services/profile-service";
import { ProfileForm } from "@/components/profile/profile-form";
import { PasswordForm } from "@/components/profile/password-form";
import { siteConfig } from "@/config/site";
import { updateProfileAction, changePasswordAction } from "./actions";

export const metadata: Metadata = { title: `Mi perfil · ${siteConfig.name}` };

// Available to every role (ADMIN, ACCOUNTANT, SELLER) -- this is a
// personal account page, not an RBAC module, so only requireUser() is
// needed here. Both the profile fields and the password form always act
// on the currently authenticated user; see actions.ts.
export default async function PerfilPage() {
  const user = await requireUser();

  const profile = await getProfileForUser(user);
  if (!profile) {
    notFound();
  }

  return (
    <div className="flex flex-1 flex-col gap-8">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Mi perfil</h2>
        <p className="text-sm text-muted-foreground">
          Administra tu información personal y tu contraseña.
        </p>
      </div>

      <ProfileForm action={updateProfileAction} profile={profile} />

      <div id="seguridad" className="scroll-mt-24">
        <PasswordForm action={changePasswordAction} />
      </div>
    </div>
  );
}
