import type { Metadata } from "next";
import Link from "next/link";
import { Poppins } from "next/font/google";
import { ArrowLeft, Building2 } from "lucide-react";
import { siteConfig } from "@/config/site";
import { COMPANY_MODULES } from "@/config/modules";
import { LoginForm } from "./login-form";

// Scoped to this screen only -- the rest of the app keeps Geist Sans
// (see src/app/layout.tsx). Applied via className below so it cascades
// to LoginForm's labels/inputs/button without touching global fonts.
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-login-poppins",
});

export const metadata: Metadata = {
  title: `Iniciar sesión · ${siteConfig.name}`,
};

// Deliberately outside the (app) route group: no Sidebar/Header here.
// Redirecting an already-authenticated visitor away from this page is
// handled by src/proxy.ts (a real, database-backed check), not here.
//
// `module` only comes from the "/" module-selection screen's cards (see
// src/config/modules.ts): it's used for display context here, and passed
// through LoginForm's hidden field so login() (src/lib/auth/actions.ts)
// knows which module's home page to redirect to on success -- it never
// changes the credentials check itself, only where a successful login
// lands (defaults to /dashboard, same as before, when absent/unrecognized).
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ module?: string }>;
}) {
  const { module: moduleKey } = await searchParams;
  const selectedModule = COMPANY_MODULES.find((item) => item.key === moduleKey);

  return (
    <div
      className={`${poppins.variable} flex min-h-screen flex-1 items-center justify-center bg-gradient-to-br from-[#2563eb] via-[#1d4ed8] to-[#0f172a] px-4 py-16`}
      style={{ fontFamily: "var(--font-login-poppins)" }}
    >
      <div className="w-full max-w-sm space-y-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-white/80 transition-colors hover:text-white"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Volver a selección de módulos
        </Link>

        <div className="rounded-2xl bg-white p-8 shadow-[0_20px_50px_-12px_rgba(37,99,235,0.45)]">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-blue-500/30">
              <Building2 className="size-7" aria-hidden />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-[#1e293b]">
              {siteConfig.brandName}
            </h1>
            <p className="mt-1.5 text-sm text-[#64748b]">
              {selectedModule
                ? `Ingresa al módulo de ${selectedModule.title}. Ingresa con tu correo y contraseña.`
                : "Ingresa con tu correo y contraseña."}
            </p>
          </div>
          <div className="mt-6">
            <LoginForm module={selectedModule?.key} />
          </div>
        </div>
      </div>
    </div>
  );
}
