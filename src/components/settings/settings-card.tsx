import type { LucideIcon } from "lucide-react";

// One tile in the /configuracion overview grid. Purely presentational --
// "Configurar" just jumps to the matching form section further down the
// same page (see the `id`s in page.tsx), mirroring how PerfilPage links
// into its own #seguridad section.
export function SettingsCard({
  icon: Icon,
  title,
  description,
  href,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6">
      <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-5" aria-hidden />
      </div>
      <div className="flex-1 space-y-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <a
        href={href}
        className="inline-flex w-fit items-center justify-center rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-black/5"
      >
        Configurar
      </a>
    </div>
  );
}
