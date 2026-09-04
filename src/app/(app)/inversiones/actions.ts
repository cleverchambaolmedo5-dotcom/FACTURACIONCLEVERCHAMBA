"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireModuleAccess } from "@/lib/auth/guards";
import {
  createInvestmentForUser,
  createCustomerForInvestmentForm,
  searchCustomersForInvestmentForm,
  approveInvestmentForUser,
  rejectInvestmentForUser,
  cancelInvestmentForUser,
  type InvestmentActionResult,
  type InvestmentValidationResult,
  type InvestmentRejectionResult,
  type InvestmentCancellationResult,
} from "@/server/services/investment-service";
import type { CustomerFormState } from "@/app/(app)/clientes/actions";

export type InvestmentFormState = InvestmentActionResult | undefined;
export type ApproveInvestmentFormState = InvestmentValidationResult | undefined;
export type RejectInvestmentFormState = InvestmentRejectionResult | undefined;
export type CancelInvestmentFormState = InvestmentCancellationResult | undefined;

// Every mutation re-verifies module access itself -- it must never rely on
// the page having already checked it, since a Server Action can be invoked
// directly regardless of which page rendered its form. investmentId is
// always a bound server-side argument, never read from FormData, so a
// submitted request can't retarget a different investment.

export async function createInvestmentAction(
  _prevState: InvestmentFormState,
  formData: FormData,
): Promise<InvestmentFormState> {
  const user = await requireModuleAccess("inversiones");

  const result = await createInvestmentForUser(user, {
    customerId: formData.get("customerId"),
    startDate: formData.get("startDate"),
    principalAmount: formData.get("principalAmount"),
    annualRate: formData.get("annualRate"),
    sellerId: formData.get("sellerId"),
    receipt: formData.get("receipt"),
    contract: formData.get("contract"),
  });

  if (!result.ok) {
    return result;
  }

  redirect(`/inversiones/${result.id}`);
}

/**
 * Backs the customer selector's type-ahead search on the "Nueva inversión"
 * screen. Scoping (SELLER only sees their own customers) is enforced
 * inside searchCustomersForInvestmentForm, never trusted from the caller.
 */
export async function searchCustomersForInvestmentAction(query: string) {
  const user = await requireModuleAccess("inversiones");
  return searchCustomersForInvestmentForm(user, query);
}

/**
 * Backs the "+ Registrar nuevo cliente" modal on the "Nueva inversión"
 * screen. Never redirects -- returns the result so the modal can select
 * the new customer and close itself without losing the rest of the form.
 */
export async function createCustomerForInvestmentAction(
  _prevState: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const user = await requireModuleAccess("inversiones");

  return createCustomerForInvestmentForm(user, {
    fullName: formData.get("fullName"),
    identification: formData.get("identification"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    country: formData.get("country"),
    address: formData.get("address"),
    assignedSellerId: formData.get("assignedSellerId"),
  });
}

// Takes no FormData -- approving has no fields to submit, just a
// confirmation -- so it's called directly from a useTransition handler
// rather than bound to useActionState (mirrors PaymentValidationPanel).
export async function approveInvestmentAction(
  investmentId: string,
): Promise<ApproveInvestmentFormState> {
  const user = await requireModuleAccess("inversiones");
  const result = await approveInvestmentForUser(user, investmentId);

  if (result.ok) {
    revalidatePath("/inversiones");
    revalidatePath(`/inversiones/${investmentId}`);
  }

  return result;
}

export async function rejectInvestmentAction(
  investmentId: string,
  _prevState: RejectInvestmentFormState,
  formData: FormData,
): Promise<RejectInvestmentFormState> {
  const user = await requireModuleAccess("inversiones");
  const result = await rejectInvestmentForUser(user, investmentId, formData.get("reason"));

  if (result.ok) {
    revalidatePath("/inversiones");
    revalidatePath(`/inversiones/${investmentId}`);
  }

  return result;
}

export async function cancelInvestmentAction(
  investmentId: string,
  _prevState: CancelInvestmentFormState,
  formData: FormData,
): Promise<CancelInvestmentFormState> {
  const user = await requireModuleAccess("inversiones");
  const result = await cancelInvestmentForUser(
    user,
    investmentId,
    formData.get("reason"),
    formData.get("cancelledAt"),
  );

  if (result.ok) {
    revalidatePath("/inversiones");
    revalidatePath(`/inversiones/${investmentId}`);
  }

  return result;
}
