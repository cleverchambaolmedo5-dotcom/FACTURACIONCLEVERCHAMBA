import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Handshake, Sparkles } from "lucide-react";
import { siteConfig } from "@/config/site";
import { ModulePlaceholder } from "@/components/ui/module-placeholder";

export const metadata: Metadata = { title: `Asesorías · ${siteConfig.name}` };

// Public placeholder route for the not-yet-built Asesorías module (see
// src/config/modules.ts). No session required -- src/proxy.ts allowlists
// this path alongside "/". No data, no Prisma models, no business logic:
// just a "Próximamente" screen with a way back to the module-selection
// screen. Inversiones used to be a placeholder like this too, but is now a
// real, protected module (src/app/(app)/inversiones) -- see PUBLIC_PATHS
// in proxy.ts.
export default function AsesoriasPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-background px-4 py-16">
      <div className="w-full max-w-lg space-y-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Volver a selección de módulos
        </Link>

        <ModulePlaceholder
          icon={Handshake}
          title="Asesorías"
          description="Gestiona clientes, asesorías y servicios profesionales. Este módulo todavía no está disponible."
          badgeLabel="Próximamente"
          badgeIcon={Sparkles}
        />
      </div>
    </div>
  );
}
