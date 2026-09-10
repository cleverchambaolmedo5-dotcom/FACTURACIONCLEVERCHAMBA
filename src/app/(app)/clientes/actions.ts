"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireModuleAccess } from "@/lib/auth/guards";
import {
  createCustomerForUser,
  updateCustomerForUser,
  deleteCustomerForUser,
  type CustomerActionResult,
  type CustomerDeletionResult,
} from "@/server/services/customer-service";

export type CustomerFormState = CustomerActionResult | undefined;
export type CustomerDeletionFormState = CustomerDeletionResult | undefined;

// Every mutation re-verifies module access itself -- it must never rely
// on the page having already checked it, since a Server Action can be
// invoked directly regardless of which page rendered the form.

export async function createCustomerAction(
  _prevState: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const user = await requireModuleAccess("clientes");

  const result = await createCustomerForUser(user, {
    fullName: formData.get("fullName"),
    identification: formData.get("identification"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    country: formData.get("country"),
    address: formData.get("address"),
    assignedSellerId: formData.get("assignedSellerId"),
    confirmDuplicate: formData.get("confirmDuplicate"),
  });

  if (!result.ok) {
    return result;
  }

  redirect("/clientes");
}

// Invoked directly (no form/FormData) via useTransition, mirroring
// toggleUserStatusAction -- deleting has no fields to submit, just a
// confirmation. ADMIN-only is re-checked inside deleteCustomerForUser
// regardless of what the UI shows.
export async function deleteCustomerAction(
  customerId: string,
): Promise<CustomerDeletionFormState> {
  const user = await requireModuleAccess("clientes");
  const result = await deleteCustomerForUser(user, customerId);

  if (result.ok) {
    revalidatePath("/clientes");
  }

  return result;
}

export async function updateCustomerAction(
  customerId: string,
  _prevState: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const user = await requireModuleAccess("clientes");

  const result = await updateCustomerForUser(user, customerId, {
    fullName: formData.get("fullName"),
    identification: formData.get("identification"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    country: formData.get("country"),
    address: formData.get("address"),
    assignedSellerId: formData.get("assignedSellerId"),
    confirmDuplicate: formData.get("confirmDuplicate"),
  });

  if (!result.ok) {
    return result;
  }

  redirect("/clientes");
}
