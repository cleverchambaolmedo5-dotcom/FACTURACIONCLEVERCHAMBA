import "server-only";
import { prisma } from "@/lib/prisma";

// Pure data access for SystemSettings (the /configuracion module). No
// auth/RBAC awareness lives here -- src/server/services/system-settings-service.ts
// decides who's allowed to read or change these, mirroring
// bank-account-repository.ts.

const SETTINGS_ID = "singleton";

/**
 * Returns the single SystemSettings row, creating it with schema defaults
 * on first read (upsert with no-op update) so the app never has to reason
 * about a missing settings row anywhere else.
 */
export async function getSystemSettings() {
  return prisma.systemSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  });
}

export type CompanySettingsData = {
  companyName: string;
  companyTaxId: string;
  companyEmail: string;
  companyPhone: string;
  companyAddress: string;
};

export async function updateCompanySettings(data: CompanySettingsData) {
  return prisma.systemSettings.upsert({
    where: { id: SETTINGS_ID },
    update: data,
    create: { id: SETTINGS_ID, ...data },
  });
}

export type SaleDefaultsSettingsData = {
  saleDefaultCurrency: string;
  saleMaxInstallments: number;
  salePaymentTermDays: number;
};

export async function updateSaleDefaultsSettings(data: SaleDefaultsSettingsData) {
  return prisma.systemSettings.upsert({
    where: { id: SETTINGS_ID },
    update: data,
    create: { id: SETTINGS_ID, ...data },
  });
}

export type NotificationSettingsData = {
  notifyOnNewSale: boolean;
  notifyOnPaymentDue: boolean;
  notifyOnOverduePayment: boolean;
  reminderDaysBefore: number;
};

export async function updateNotificationSettings(data: NotificationSettingsData) {
  return prisma.systemSettings.upsert({
    where: { id: SETTINGS_ID },
    update: data,
    create: { id: SETTINGS_ID, ...data },
  });
}

export type PersonalizationSettingsData = {
  primaryColor: string;
  locale: string;
  timezone: string;
};

export async function updatePersonalizationSettings(data: PersonalizationSettingsData) {
  return prisma.systemSettings.upsert({
    where: { id: SETTINGS_ID },
    update: data,
    create: { id: SETTINGS_ID, ...data },
  });
}
