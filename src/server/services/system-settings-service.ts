import "server-only";
import { UserRole } from "@/generated/prisma/enums";
import type { PublicUser } from "@/lib/auth/session";
import { isValidEmail } from "@/lib/validation";
import * as systemSettingsRepository from "@/server/repositories/system-settings-repository";

// All SystemSettings permission/validation logic lives here, not in
// pages/components/actions, mirroring bank-account-service.ts.
// MODULE_ACCESS.configuracion in rbac.ts already restricts this module to
// ADMIN only via requireModuleAccess, but every function below re-checks
// actingUser.role again on its own, as defense in depth.

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

function canRead(role: UserRole): boolean {
  return role === UserRole.ADMIN;
}

function str(value: FormDataEntryValue | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function int(value: FormDataEntryValue | null | undefined): number | null {
  const parsed = Number(str(value));
  return Number.isInteger(parsed) ? parsed : null;
}

export async function getSystemSettingsForUser(actingUser: PublicUser) {
  if (!canRead(actingUser.role)) {
    return null;
  }
  return systemSettingsRepository.getSystemSettings();
}

export type SettingsActionResult = { ok: true } | { ok: false; errors?: Record<string, string>; formError?: string };

// ---------------------------------------------------------------------
// Datos de la empresa
// ---------------------------------------------------------------------

export type RawCompanySettingsInput = {
  companyName?: FormDataEntryValue | null;
  companyTaxId?: FormDataEntryValue | null;
  companyEmail?: FormDataEntryValue | null;
  companyPhone?: FormDataEntryValue | null;
  companyAddress?: FormDataEntryValue | null;
};

export async function updateCompanySettingsForAdmin(
  actingUser: PublicUser,
  raw: RawCompanySettingsInput,
): Promise<SettingsActionResult> {
  if (actingUser.role !== UserRole.ADMIN) {
    return { ok: false, formError: "No tienes permiso para editar la configuración." };
  }

  const companyName = str(raw.companyName);
  const companyTaxId = str(raw.companyTaxId);
  const companyEmail = str(raw.companyEmail);
  const companyPhone = str(raw.companyPhone);
  const companyAddress = str(raw.companyAddress);

  const errors: Record<string, string> = {};
  if (!companyName) errors.companyName = "El nombre de la empresa es obligatorio.";
  if (companyEmail && !isValidEmail(companyEmail)) {
    errors.companyEmail = "El correo no tiene un formato válido.";
  }
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  try {
    await systemSettingsRepository.updateCompanySettings({
      companyName,
      companyTaxId,
      companyEmail,
      companyPhone,
      companyAddress,
    });
    return { ok: true };
  } catch (error) {
    console.error("[configuracion] Failed to update company settings:", error);
    return { ok: false, formError: "No se pudo guardar la configuración. Intenta nuevamente." };
  }
}

// ---------------------------------------------------------------------
// Configuración de ventas
// ---------------------------------------------------------------------

export type RawSaleDefaultsSettingsInput = {
  saleDefaultCurrency?: FormDataEntryValue | null;
  saleMaxInstallments?: FormDataEntryValue | null;
  salePaymentTermDays?: FormDataEntryValue | null;
};

export async function updateSaleDefaultsSettingsForAdmin(
  actingUser: PublicUser,
  raw: RawSaleDefaultsSettingsInput,
): Promise<SettingsActionResult> {
  if (actingUser.role !== UserRole.ADMIN) {
    return { ok: false, formError: "No tienes permiso para editar la configuración." };
  }

  const saleDefaultCurrency = str(raw.saleDefaultCurrency);
  const saleMaxInstallments = int(raw.saleMaxInstallments);
  const salePaymentTermDays = int(raw.salePaymentTermDays);

  const errors: Record<string, string> = {};
  if (!saleDefaultCurrency) errors.saleDefaultCurrency = "La moneda es obligatoria.";
  if (saleMaxInstallments === null || saleMaxInstallments < 1 || saleMaxInstallments > 3) {
    errors.saleMaxInstallments = "El número de cuotas debe estar entre 1 y 3.";
  }
  if (salePaymentTermDays === null || salePaymentTermDays < 1) {
    errors.salePaymentTermDays = "El plazo debe ser un número de días válido.";
  }
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  try {
    await systemSettingsRepository.updateSaleDefaultsSettings({
      saleDefaultCurrency,
      saleMaxInstallments: saleMaxInstallments!,
      salePaymentTermDays: salePaymentTermDays!,
    });
    return { ok: true };
  } catch (error) {
    console.error("[configuracion] Failed to update sale defaults settings:", error);
    return { ok: false, formError: "No se pudo guardar la configuración. Intenta nuevamente." };
  }
}

// ---------------------------------------------------------------------
// Notificaciones
// ---------------------------------------------------------------------

export type RawNotificationSettingsInput = {
  notifyOnNewSale?: FormDataEntryValue | null;
  notifyOnPaymentDue?: FormDataEntryValue | null;
  notifyOnOverduePayment?: FormDataEntryValue | null;
  reminderDaysBefore?: FormDataEntryValue | null;
};

export async function updateNotificationSettingsForAdmin(
  actingUser: PublicUser,
  raw: RawNotificationSettingsInput,
): Promise<SettingsActionResult> {
  if (actingUser.role !== UserRole.ADMIN) {
    return { ok: false, formError: "No tienes permiso para editar la configuración." };
  }

  const reminderDaysBefore = int(raw.reminderDaysBefore);
  const errors: Record<string, string> = {};
  if (reminderDaysBefore === null || reminderDaysBefore < 0) {
    errors.reminderDaysBefore = "Ingresa un número de días válido.";
  }
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  try {
    await systemSettingsRepository.updateNotificationSettings({
      notifyOnNewSale: str(raw.notifyOnNewSale) === "on",
      notifyOnPaymentDue: str(raw.notifyOnPaymentDue) === "on",
      notifyOnOverduePayment: str(raw.notifyOnOverduePayment) === "on",
      reminderDaysBefore: reminderDaysBefore!,
    });
    return { ok: true };
  } catch (error) {
    console.error("[configuracion] Failed to update notification settings:", error);
    return { ok: false, formError: "No se pudo guardar la configuración. Intenta nuevamente." };
  }
}

// ---------------------------------------------------------------------
// Personalización
// ---------------------------------------------------------------------

export type RawPersonalizationSettingsInput = {
  primaryColor?: FormDataEntryValue | null;
  locale?: FormDataEntryValue | null;
  timezone?: FormDataEntryValue | null;
};

export async function updatePersonalizationSettingsForAdmin(
  actingUser: PublicUser,
  raw: RawPersonalizationSettingsInput,
): Promise<SettingsActionResult> {
  if (actingUser.role !== UserRole.ADMIN) {
    return { ok: false, formError: "No tienes permiso para editar la configuración." };
  }

  const primaryColor = str(raw.primaryColor);
  const locale = str(raw.locale);
  const timezone = str(raw.timezone);

  const errors: Record<string, string> = {};
  if (!HEX_COLOR_PATTERN.test(primaryColor)) {
    errors.primaryColor = "Ingresa un color hexadecimal válido (#RRGGBB).";
  }
  if (!locale) errors.locale = "Selecciona un idioma/región.";
  if (!timezone) errors.timezone = "Selecciona una zona horaria.";
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  try {
    await systemSettingsRepository.updatePersonalizationSettings({ primaryColor, locale, timezone });
    return { ok: true };
  } catch (error) {
    console.error("[configuracion] Failed to update personalization settings:", error);
    return { ok: false, formError: "No se pudo guardar la configuración. Intenta nuevamente." };
  }
}
