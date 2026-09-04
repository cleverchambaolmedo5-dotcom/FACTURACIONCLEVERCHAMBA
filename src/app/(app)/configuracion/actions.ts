"use server";

import { revalidatePath } from "next/cache";
import { requireModuleAccess } from "@/lib/auth/guards";
import {
  updateCompanySettingsForAdmin,
  updateSaleDefaultsSettingsForAdmin,
  updateNotificationSettingsForAdmin,
  updatePersonalizationSettingsForAdmin,
  type SettingsActionResult,
} from "@/server/services/system-settings-service";

export type SettingsFormState = SettingsActionResult | undefined;

// Every mutation re-verifies module access itself -- a Server Action can be
// invoked directly regardless of which page rendered its form, and
// requireModuleAccess("configuracion") is what actually keeps
// ACCOUNTANT/SELLER out (see MODULE_ACCESS in rbac.ts: only ADMIN has
// access to this module at all). The role check inside each
// *SettingsForAdmin function is the authoritative one -- this is defense
// in depth, not a substitute. Each action stays on /configuracion
// (revalidated in place) rather than redirecting, mirroring
// toggleUserStatusAction.

export async function updateCompanySettingsAction(
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const user = await requireModuleAccess("configuracion");
  const result = await updateCompanySettingsForAdmin(user, {
    companyName: formData.get("companyName"),
    companyTaxId: formData.get("companyTaxId"),
    companyEmail: formData.get("companyEmail"),
    companyPhone: formData.get("companyPhone"),
    companyAddress: formData.get("companyAddress"),
  });
  if (result.ok) revalidatePath("/configuracion");
  return result;
}

export async function updateSaleDefaultsSettingsAction(
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const user = await requireModuleAccess("configuracion");
  const result = await updateSaleDefaultsSettingsForAdmin(user, {
    saleDefaultCurrency: formData.get("saleDefaultCurrency"),
    saleMaxInstallments: formData.get("saleMaxInstallments"),
    salePaymentTermDays: formData.get("salePaymentTermDays"),
  });
  if (result.ok) revalidatePath("/configuracion");
  return result;
}

export async function updateNotificationSettingsAction(
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const user = await requireModuleAccess("configuracion");
  const result = await updateNotificationSettingsForAdmin(user, {
    notifyOnNewSale: formData.get("notifyOnNewSale"),
    notifyOnPaymentDue: formData.get("notifyOnPaymentDue"),
    notifyOnOverduePayment: formData.get("notifyOnOverduePayment"),
    reminderDaysBefore: formData.get("reminderDaysBefore"),
  });
  if (result.ok) revalidatePath("/configuracion");
  return result;
}

export async function updatePersonalizationSettingsAction(
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const user = await requireModuleAccess("configuracion");
  const result = await updatePersonalizationSettingsForAdmin(user, {
    primaryColor: formData.get("primaryColor"),
    locale: formData.get("locale"),
    timezone: formData.get("timezone"),
  });
  if (result.ok) revalidatePath("/configuracion");
  return result;
}
