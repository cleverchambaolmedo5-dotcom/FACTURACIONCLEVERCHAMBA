"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/guards";
import {
  changePasswordForUser,
  updateProfileForUser,
  type PasswordActionResult,
  type ProfileActionResult,
} from "@/server/services/profile-service";

export type ProfileFormState = ProfileActionResult | undefined;
export type PasswordFormState = PasswordActionResult | undefined;

// Every mutation re-derives the acting user from the session itself
// (requireUser -> getCurrentUser) -- no userId is ever taken from the
// submitted form, so a user can never target another account's profile
// or password, regardless of what a crafted request sends.

export async function updateProfileAction(
  _prevState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await requireUser();

  const result = await updateProfileForUser(user, {
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    country: formData.get("country"),
    city: formData.get("city"),
    avatar: formData.get("avatar"),
  });

  if (result.ok) {
    // The Header/Sidebar (name + avatar) live in the shared (app) layout,
    // outside this page -- revalidate the whole tree so they pick up the
    // change immediately instead of only on the next navigation.
    revalidatePath("/", "layout");
  }

  return result;
}

export async function changePasswordAction(
  _prevState: PasswordFormState,
  formData: FormData,
): Promise<PasswordFormState> {
  const user = await requireUser();

  return changePasswordForUser(user, {
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
}
