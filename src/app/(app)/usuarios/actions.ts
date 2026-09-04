"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireModuleAccess } from "@/lib/auth/guards";
import {
  createUserForAdmin,
  updateUserForAdmin,
  toggleUserStatusForAdmin,
  type ManagedUserActionResult,
  type ToggleUserStatusResult,
} from "@/server/services/user-management-service";

export type ManagedUserFormState = ManagedUserActionResult | undefined;
export type ToggleUserStatusFormState = ToggleUserStatusResult | undefined;

// Every mutation re-verifies module access itself -- a Server Action can be
// invoked directly regardless of which page rendered its form, and
// requireModuleAccess("usuarios") is what actually keeps ACCOUNTANT/SELLER
// out (see MODULE_ACCESS in rbac.ts: only ADMIN has access to this module
// at all). The role check inside createUserForAdmin/updateUserForAdmin/
// toggleUserStatusForAdmin is the authoritative one -- this is defense in
// depth, not a substitute.

export async function createUserAction(
  _prevState: ManagedUserFormState,
  formData: FormData,
): Promise<ManagedUserFormState> {
  const user = await requireModuleAccess("usuarios");

  const result = await createUserForAdmin(user, {
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    role: formData.get("role"),
  });

  if (!result.ok) {
    return result;
  }

  redirect("/usuarios");
}

export async function updateUserAction(
  userId: string,
  _prevState: ManagedUserFormState,
  formData: FormData,
): Promise<ManagedUserFormState> {
  const user = await requireModuleAccess("usuarios");

  const result = await updateUserForAdmin(user, userId, {
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    role: formData.get("role"),
    status: formData.get("status"),
  });

  if (!result.ok) {
    return result;
  }

  redirect("/usuarios");
}

// Takes no FormData -- toggling has no fields to submit, just a
// confirmation -- so it's called directly from a useTransition handler
// (see ToggleUserStatusButton), mirroring approvePaymentAction in
// src/app/(app)/comprobantes/actions.ts. Stays on /usuarios (revalidated
// in place) rather than redirecting, since the listing is already the
// current page.
export async function toggleUserStatusAction(userId: string): Promise<ToggleUserStatusFormState> {
  const user = await requireModuleAccess("usuarios");
  const result = await toggleUserStatusForAdmin(user, userId);

  if (result.ok) {
    revalidatePath("/usuarios");
  }

  return result;
}
