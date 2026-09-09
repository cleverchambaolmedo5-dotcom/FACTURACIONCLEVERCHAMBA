"use server";

import { redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/auth/guards";
import {
  createSaleForUser,
  createCustomerForSaleForm,
  searchCustomersForSaleForm,
  type SaleActionResult,
} from "@/server/services/sale-service";
import type { CustomerFormState } from "@/app/(app)/clientes/actions";

export type SaleFormState = SaleActionResult | undefined;

// Every mutation re-verifies module access itself -- it must never rely
// on the page having already checked it, since a Server Action can be
// invoked directly regardless of which page rendered the form.

// Cuota payment fields are submitted under an indexed name (e.g.
// "installmentPaymentMethod-0") rather than a single repeated field name,
// since each cuota's extra fields (amount/voucher/entregado a) only render
// in the DOM when that cuota actually has a forma de pago selected -- a
// shared name read via formData.getAll() would silently misalign once any
// earlier cuota's fields are absent. ALLOWED_INSTALLMENT_COUNTS tops out at
// 3, so indices 0-2 always cover every possible cuota.
const MAX_INSTALLMENTS = 3;

function getIndexed(formData: FormData, prefix: string): FormDataEntryValue[] {
  return Array.from({ length: MAX_INSTALLMENTS }, (_, index) => formData.get(`${prefix}-${index}`) ?? "");
}

export async function createSaleAction(
  _prevState: SaleFormState,
  formData: FormData,
): Promise<SaleFormState> {
  const user = await requireModuleAccess("ventas");

  const result = await createSaleForUser(user, {
    customerId: formData.get("customerId"),
    productId: formData.get("productId"),
    saleDate: formData.get("saleDate"),
    discount: formData.get("discount"),
    installments: formData.get("installments"),
    installmentDueDates: formData.getAll("installmentDueDates"),
    installmentAmounts: formData.getAll("installmentAmounts"),
    sellerId: formData.get("sellerId"),
    bankAccountId: formData.get("bankAccountId"),
    receipt: formData.get("receipt"),
    installmentPaymentMethods: getIndexed(formData, "installmentPaymentMethod"),
    installmentPaymentAmounts: getIndexed(formData, "installmentPaymentAmount"),
    installmentPaymentReceivedByNames: getIndexed(formData, "installmentPaymentReceivedByName"),
    installmentPaymentNotes: getIndexed(formData, "installmentPaymentNotes"),
    installmentPaymentReceipts: getIndexed(formData, "installmentPaymentReceipt"),
  });

  if (!result.ok) {
    return result;
  }

  redirect(`/ventas/${result.id}`);
}

/**
 * Backs the customer selector's type-ahead search on the "Nueva venta"
 * screen. Called directly from a Client Component -- not tied to a
 * <form> -- so it takes the query string as a plain argument. Scoping
 * (SELLER only sees their own customers) is enforced inside
 * searchCustomersForSaleForm, never trusted from the caller.
 */
export async function searchCustomersForSaleAction(query: string) {
  const user = await requireModuleAccess("ventas");
  return searchCustomersForSaleForm(user, query);
}

/**
 * Backs the "+ Registrar nuevo cliente" modal on the "Nueva venta"
 * screen. Unlike createCustomerAction (clientes module), this never
 * redirects -- it returns the result so the modal can select the new
 * customer and close itself without losing the rest of the sale form.
 */
export async function createCustomerForSaleAction(
  _prevState: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const user = await requireModuleAccess("ventas");

  return createCustomerForSaleForm(user, {
    fullName: formData.get("fullName"),
    identification: formData.get("identification"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    country: formData.get("country"),
    address: formData.get("address"),
    assignedSellerId: formData.get("assignedSellerId"),
  });
}
