import { headers, cookies } from "next/headers";
import { requireUser } from "@/lib/auth/guards";
import { canAccessModule } from "@/lib/auth/rbac";
import {
  NAV_ITEMS,
  MODULE_NAV_KEYS,
  MODULE_CONTEXT_HEADER_NAME,
  MODULE_CONTEXT_COOKIE_NAME,
  type ModuleContext,
} from "@/config/navigation";
import { AppShell } from "@/components/layout/app-shell";

// Shared shell (Sidebar + Header) for every authenticated route. This is
// the second, independent auth check alongside src/proxy.ts -- see the
// comment there and in guards.ts for why neither is meant to be the only
// line of defense.
//
// Per-module authorization (which nav items to show, and whether the
// current route is actually allowed) is computed once here and passed
// down as plain data; each page still calls `requireModuleAccess` itself
// for its own route.
const DEFAULT_MODULE_CONTEXT: ModuleContext = "inversiones";

/**
 * The active module context (Ventas or Inversiones), used to decide which
 * nav entries the Sidebar shows. src/proxy.ts already resolved this for
 * the current route and forwarded it as a request header when the route is
 * unambiguous (/ventas, /inversiones, /dashboard, ...); for a shared route
 * (/clientes, /cuentas-bancarias) or a cross-cutting one (/usuarios,
 * /configuracion, /perfil) that header is absent, so this falls back to
 * the cookie proxy.ts persisted from the last unambiguous route the user
 * visited -- "conserva el contexto desde el que se accedió". A brand-new
 * session with neither (e.g. a direct deep link to /clientes) falls back
 * to Inversiones, matching MODULE_HOME_PATHS' own default elsewhere.
 */
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

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const moduleContext = await resolveModuleContext();

  const allowedKeys = NAV_ITEMS.filter(
    (item) => canAccessModule(user.role, item.key) && MODULE_NAV_KEYS[moduleContext].includes(item.key),
  ).map((item) => item.key);

  return (
    <AppShell user={user} allowedKeys={allowedKeys} moduleContext={moduleContext}>
      {children}
    </AppShell>
  );
}
