import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Building2, ShoppingCart, Bell, Palette } from "lucide-react";
import { requireModuleAccess } from "@/lib/auth/guards";
import { getSystemSettingsForUser } from "@/server/services/system-settings-service";
import { SettingsCard } from "@/components/settings/settings-card";
import { CompanySettingsForm } from "@/components/settings/company-settings-form";
import { SaleDefaultsSettingsForm } from "@/components/settings/sale-defaults-settings-form";
import { NotificationSettingsForm } from "@/components/settings/notification-settings-form";
import { PersonalizationSettingsForm } from "@/components/settings/personalization-settings-form";
import { siteConfig } from "@/config/site";
import {
  updateCompanySettingsAction,
  updateSaleDefaultsSettingsAction,
  updateNotificationSettingsAction,
  updatePersonalizationSettingsAction,
} from "./actions";

export const metadata: Metadata = { title: `Configuración · ${siteConfig.name}` };

export default async function ConfiguracionPage() {
  const user = await requireModuleAccess("configuracion");

  const settings = await getSystemSettingsForUser(user);
  if (!settings) {
    notFound();
  }

  return (
    <div className="flex flex-1 flex-col gap-8">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Configuración</h2>
        <p className="text-sm text-muted-foreground">
          Gestiona las preferencias generales del sistema.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SettingsCard
          icon={Building2}
          title="Datos de la empresa"
          description="Información general de la empresa, datos fiscales y contacto."
          href="#empresa"
        />
        <SettingsCard
          icon={ShoppingCart}
          title="Configuración de ventas"
          description="Preferencias predeterminadas para nuevas ventas."
          href="#ventas"
        />
        <SettingsCard
          icon={Bell}
          title="Notificaciones"
          description="Preferencias de alertas y avisos del sistema."
          href="#notificaciones"
        />
        <SettingsCard
          icon={Palette}
          title="Personalización"
          description="Colores y preferencias regionales."
          href="#personalizacion"
        />
      </div>

      <div id="empresa" className="scroll-mt-24">
        <CompanySettingsForm action={updateCompanySettingsAction} settings={settings} />
      </div>

      <div id="ventas" className="scroll-mt-24">
        <SaleDefaultsSettingsForm action={updateSaleDefaultsSettingsAction} settings={settings} />
      </div>

      <div id="notificaciones" className="scroll-mt-24">
        <NotificationSettingsForm action={updateNotificationSettingsAction} settings={settings} />
      </div>

      <div id="personalizacion" className="scroll-mt-24">
        <PersonalizationSettingsForm action={updatePersonalizationSettingsAction} settings={settings} />
      </div>
    </div>
  );
}
