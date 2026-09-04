"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireModuleAccess } from "@/lib/auth/guards";
import {
  createProductForAdmin,
  updateProductForAdmin,
  toggleProductStatusForAdmin,
  deleteProductForAdmin,
  type ProductActionResult,
  type ToggleProductStatusResult,
  type ProductDeletionResult,
} from "@/server/services/product-service";

export type ProductFormState = ProductActionResult | undefined;
export type ToggleProductStatusFormState = ToggleProductStatusResult | undefined;
export type ProductDeletionFormState = ProductDeletionResult | undefined;

// Every mutation re-verifies module access itself -- it must never rely
// on the page having already checked it, since a Server Action can be
// invoked directly regardless of which page rendered its form.
// requireModuleAccess("productos") is what actually keeps ACCOUNTANT/
// SELLER out (MODULE_ACCESS.productos in rbac.ts: only ADMIN has access
// to this module at all). The role check inside each
// *ForAdmin service function is the authoritative one -- defense in
// depth, not a substitute.

export async function createProductAction(
  _prevState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const user = await requireModuleAccess("productos");

  const result = await createProductForAdmin(user, {
    name: formData.get("name"),
    description: formData.get("description"),
    officialPrice: formData.get("officialPrice"),
    currency: formData.get("currency"),
    type: formData.get("type"),
  });

  if (!result.ok) {
    return result;
  }

  redirect("/productos");
}

export async function updateProductAction(
  productId: string,
  _prevState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const user = await requireModuleAccess("productos");

  const result = await updateProductForAdmin(user, productId, {
    name: formData.get("name"),
    description: formData.get("description"),
    officialPrice: formData.get("officialPrice"),
    currency: formData.get("currency"),
    type: formData.get("type"),
    active: formData.get("active"),
  });

  if (!result.ok) {
    return result;
  }

  redirect("/productos");
}

// Takes no FormData -- toggling has no fields to submit, just a
// confirmation -- so it's called directly from a useTransition handler,
// mirroring toggleUserStatusAction in usuarios/actions.ts.
export async function toggleProductStatusAction(
  productId: string,
): Promise<ToggleProductStatusFormState> {
  const user = await requireModuleAccess("productos");
  const result = await toggleProductStatusForAdmin(user, productId);

  if (result.ok) {
    revalidatePath("/productos");
  }

  return result;
}

// Also invoked directly via useTransition, mirroring deleteCustomerAction
// in clientes/actions.ts.
export async function deleteProductAction(
  productId: string,
): Promise<ProductDeletionFormState> {
  const user = await requireModuleAccess("productos");
  const result = await deleteProductForAdmin(user, productId);

  if (result.ok) {
    revalidatePath("/productos");
  }

  return result;
}
