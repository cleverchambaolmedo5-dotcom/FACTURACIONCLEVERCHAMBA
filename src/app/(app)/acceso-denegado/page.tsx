import type { Metadata } from "next";
import Link from "next/link";
import { headers, cookies } from "next/headers";
import { ShieldAlert } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import {
  MODULE_CONTEXT_HEADER_NAME,
  MODULE_CONTEXT_COOKIE_NAME,
  MODULE_DASHBOARD_NAV,
  type ModuleContext,
} from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = { title: `Acceso denegado · ${siteConfig.name}` };

const DEFAULT_MODULE_CONTEXT: ModuleContext = "inversiones";

/** Mirrors (app)/layout.tsx#resolveModuleContext, so "Volver al dashboard" always lands on the dashboard of the module the user was actually in, never the other one's. */
async function resolveModuleContext(): Promise<ModuleContext> {
  const headerValue = (await headers()).get(MODULE_CONTEXT_HEADER_NAME);
  if (headerValue === "ventas" || headerValue === "inversiones") {
    return headerValue;
  }

  const cookieValue = (await cookies()).get(MODULE_CONTEXT_COOKIE_NAME)?.value;
  if (cookieValue === "ventas" || cookieValue === "inversiones") {
    return cookieValue;
  }

  return DEFAULT_MODULE_CONTEXT;
}

// Destination for requireModuleAccess() when an authenticated user's role
// doesn't have access to a module. See src/lib/auth/guards.ts for why a
// dedicated page was chosen over a silent redirect to a dashboard: it
// tells the user *why* nothing loaded instead of leaving them guessing
// why a link or bookmark "did nothing".
export default async function AccesoDenegadoPage() {
  // Still requires a session -- an unauthenticated visitor never reaches
  // this page, Proxy sends them to /login first.
  await requireUser();
  const moduleContext = await resolveModuleContext();
  const dashboard = MODULE_DASHBOARD_NAV[moduleContext];

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-error-soft text-error">
        <ShieldAlert className="size-6" aria-hidden />
      </div>
      <div className="space-y-1.5">
        <h1 className="text-lg font-semibold text-foreground">Acceso denegado</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Tu rol no tiene permiso para ver esta sección.
        </p>
      </div>
      <Link href={dashboard.href} className={buttonVariants()}>
        Volver a {dashboard.label}
      </Link>
    </div>
  );
}
