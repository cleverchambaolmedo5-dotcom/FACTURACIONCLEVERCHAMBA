import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { CompanyModule } from "@/config/modules";
import { StatusBadge } from "@/components/ui/status-badge";

// One card on the "/" module-selection screen. Purely presentational --
// `module.status` only changes copy/badge, never what happens on click:
// every card is a real Link to `module.href`, active or not (the
// "coming-soon" routes just render their own "Próximamente" screen). The
// whole card is the click target -- there is no separate "Ingresar"/"Ver
// más" affordance inside it.
export function ModuleCard({ module }: { module: CompanyModule }) {
  const isActive = module.status === "active";
  const Icon = module.icon;

  return (
    <Link
      href={module.href}
      className="group relative flex cursor-pointer flex-col items-center gap-4 rounded-3xl bg-white p-8 text-center shadow-[0_10px_30px_rgba(0,120,255,0.35),0_0_20px_rgba(0,102,255,0.25)] transition-all duration-300 ease-out hover:-translate-y-2 hover:shadow-[0_18px_45px_rgba(0,120,255,0.45),0_0_30px_rgba(0,102,255,0.35)] sm:p-10"
    >
      <div className="absolute right-5 top-5">
        {isActive ? (
          <StatusBadge tone="success">Disponible</StatusBadge>
        ) : (
          <StatusBadge tone="neutral" className="gap-1">
            <Sparkles className="size-3.5" aria-hidden />
            Próximamente
          </StatusBadge>
        )}
      </div>

      <div className="flex size-20 items-center justify-center rounded-full bg-blue-50 text-[#1447e6] transition-colors group-hover:bg-blue-100">
        <Icon className="size-10" aria-hidden />
      </div>

      <div className="space-y-1.5">
        <h2 className="text-xl font-semibold text-slate-900">{module.title}</h2>
        <p className="text-sm font-normal text-slate-500">{module.description}</p>
      </div>
    </Link>
  );
}
