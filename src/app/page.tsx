import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { Building2 } from "lucide-react";
import { siteConfig } from "@/config/site";
import { COMPANY_MODULES } from "@/config/modules";
import { ModuleCard } from "@/components/home/module-card";

export const metadata: Metadata = { title: siteConfig.brandName };

// Scoped to this screen only (via `.className` below) -- does not touch the
// app-wide font set in src/app/layout.tsx.
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// The new main entry point of the system ("/"). Deliberately outside the
// (app) route group -- no Sidebar/Header, and reachable with or without a
// session (see the PUBLIC_PATHS allowlist in src/proxy.ts). The user
// menu's "Módulos" option (see UserMenu/ModulesConfirmModal) always ends
// the session before landing here, via logoutToModules.
export default function Home() {
  return (
    <div
      className={`relative flex flex-1 flex-col items-center overflow-hidden bg-gradient-to-br from-[#081c4b] via-[#123e9e] to-[#1f8bff] px-4 py-16 sm:py-24 ${poppins.className}`}
    >
      {/* Decorative background: soft glows, dot grid, and a wave -- purely
          visual, sits behind the content via z-index. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="absolute -left-32 -top-32 size-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-40 -right-24 size-[28rem] rounded-full bg-sky-300/20 blur-3xl" />
        <svg
          className="absolute inset-x-0 bottom-0 h-40 w-full text-white/10"
          viewBox="0 0 1440 200"
          preserveAspectRatio="none"
          fill="none"
        >
          <path
            d="M0 120 C 240 200, 480 40, 720 100 C 960 160, 1200 60, 1440 110 L1440 200 L0 200 Z"
            fill="currentColor"
          />
        </svg>
        <svg
          className="absolute inset-x-0 top-0 h-64 w-full text-white/[0.06]"
          viewBox="0 0 1440 260"
          preserveAspectRatio="none"
          fill="none"
        >
          <path
            d="M0 0 L1440 0 L1440 60 C 1200 130, 960 10, 720 60 C 480 110, 240 20, 0 80 Z"
            fill="currentColor"
          />
        </svg>
      </div>

      <div className="relative z-10 w-full max-w-5xl space-y-12">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-xl bg-white text-[#123e9e] shadow-lg shadow-blue-950/30">
            <Building2 className="size-7" aria-hidden />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Clever Chamba
          </h1>
          <p className="mt-3 max-w-md text-sm font-normal text-blue-100 sm:text-base">
            Selecciona el área a la que deseas ingresar
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {COMPANY_MODULES.map((module) => (
            <ModuleCard key={module.key} module={module} />
          ))}
        </div>
      </div>
    </div>
  );
}
