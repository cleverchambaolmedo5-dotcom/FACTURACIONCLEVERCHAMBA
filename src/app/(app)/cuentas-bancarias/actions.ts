"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireModuleAccess } from "@/lib/auth/guards";
import {
  createBankAccountForAdmin,
  updateBankAccountForAdmin,
  toggleBankAccountStatusForAdmin,
  deleteBankAccountForAdmin,
  type BankAccountActionResult,
  type ToggleBankAccountStatusResult,
  type BankAccountDeletionResult,
} from "@/server/services/bank-account-service";

export type BankAccountFormState = BankAccountActionResult | undefined;
export type ToggleBankAccountStatusFormState = ToggleBankAccountStatusResult | undefined;
export type BankAccountDeletionFormState = BankAccountDeletionResult | undefined;

// Every mutation re-verifies module access itself -- it must never rely on
// the page having already checked it, since a Server Action can be invoked
// directly regardless of which page rendered its form. requireModuleAccess
// ("cuentas-bancarias") only gates page-level access (ADMIN/ACCOUNTANT);
// the role check inside each *ForAdmin service function is the
// authoritative one that keeps ACCOUNTANT read-only -- defense in depth,
// not a substitute. Mirrors productos/actions.ts.

export async function createBankAccountAction(
  _prevState: BankAccountFormState,
  formData: FormData,
): Promise<BankAccountFormState> {
  const user = await requireModuleAccess("cuentas-bancarias");

  const result = await createBankAccountForAdmin(user, {
    bankName: formData.get("bankName"),
    alias: formData.get("alias"),
    accountHolder: formData.get("accountHolder"),
    accountType: formData.get("accountType"),
    accountNumber: formData.get("accountNumber"),
    currency: formData.get("currency"),
    instructions: formData.get("instructions"),
  });

  if (!result.ok) {
    return result;
  }

  redirect("/cuentas-bancarias");
}

export async function updateBankAccountAction(
  bankAccountId: string,
  _prevState: BankAccountFormState,
  formData: FormData,
): Promise<BankAccountFormState> {
  const user = await requireModuleAccess("cuentas-bancarias");

  const result = await updateBankAccountForAdmin(user, bankAccountId, {
    bankName: formData.get("bankName"),
    alias: formData.get("alias"),
    accountHolder: formData.get("accountHolder"),
    accountType: formData.get("accountType"),
    accountNumber: formData.get("accountNumber"),
    currency: formData.get("currency"),
    instructions: formData.get("instructions"),
    active: formData.get("active"),
  });

  if (!result.ok) {
    return result;
  }

  redirect("/cuentas-bancarias");
}

// Takes no FormData -- toggling has no fields to submit, just a
// confirmation -- so it's called directly from a useTransition handler,
// mirroring toggleProductStatusAction.
export async function toggleBankAccountStatusAction(
  bankAccountId: string,
): Promise<ToggleBankAccountStatusFormState> {
  const user = await requireModuleAccess("cuentas-bancarias");
  const result = await toggleBankAccountStatusForAdmin(user, bankAccountId);

  if (result.ok) {
    revalidatePath("/cuentas-bancarias");
  }

  return result;
}

// Also invoked directly via useTransition, mirroring deleteProductAction.
export async function deleteBankAccountAction(
  bankAccountId: string,
): Promise<BankAccountDeletionFormState> {
  const user = await requireModuleAccess("cuentas-bancarias");
  const result = await deleteBankAccountForAdmin(user, bankAccountId);

  if (result.ok) {
    revalidatePath("/cuentas-bancarias");
  }

  return result;
}
