import Link from "next/link";
import { Calendar, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

// Ecuador local time -- used only to pick a "Buenos días/tardes/noches"
// greeting and to render today's date/render time, never to compute or
// filter any business data (installments/payments already use their own
// "UTC" formatters elsewhere on purpose, to display stored dates as-is).
const TIME_ZONE = "America/Guayaquil";

const dateFormatter = new Intl.DateTimeFormat("es-EC", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: TIME_ZONE,
});

const timeFormatter = new Intl.DateTimeFormat("es-EC", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: TIME_ZONE,
});

const hourFormatter = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: TIME_ZONE });

function getGreeting(now: Date): string {
  const hour = Number(hourFormatter.format(now));
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

// Shared hero header for the three Ventas dashboards (ADMIN/ACCOUNTANT/
// SELLER) -- one component instead of copy-pasting this block three times.
// `subtitle` and `primaryAction` stay role-specific and are passed in by
// each dashboard, exactly like the plain "Hola, {user.name}" block they
// replace.
export function SalesDashboardHero({
  userName,
  subtitle,
  primaryAction,
}: {
  userName: string;
  subtitle: string;
  primaryAction?: { href: string; label: string };
}) {
  const now = new Date();

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Panel de ventas</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {getGreeting(now)}, {userName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <div className="flex flex-col items-start gap-2 sm:items-end">
        <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <Calendar className="size-4 text-muted-foreground" aria-hidden />
          Hoy, {dateFormatter.format(now)}
        </div>
        <p className="text-xs text-muted-foreground">Última actualización: {timeFormatter.format(now)}</p>
        {primaryAction && (
          <Link
            href={primaryAction.href}
            className={buttonVariants({ variant: "primary", size: "md", className: "mt-1" })}
          >
            <Plus className="size-4" aria-hidden />
            {primaryAction.label}
          </Link>
        )}
      </div>
    </div>
  );
}
