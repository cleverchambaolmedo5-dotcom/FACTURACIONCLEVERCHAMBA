"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/auth/guards";
import {
  approvePaymentForUser,
  rejectPaymentForUser,
  type PaymentValidationResult,
  type RejectPaymentResult,
} from "@/server/services/payment-service";

export type ApprovePaymentFormState = PaymentValidationResult | undefined;
export type RejectPaymentFormState = RejectPaymentResult | undefined;

// Every mutation re-verifies module access itself -- a Server Action can be
// invoked directly regardless of which page rendered its form, and
// requireModuleAccess("comprobantes") is what actually keeps SELLER out
// (see MODULE_ACCESS in rbac.ts: SELLER has no access to this module at
// all). The role check inside approvePaymentForUser/rejectPaymentForUser is
// the authoritative one -- this is defense in depth, not a substitute.
// paymentId is always the bound server-side argument, never read from
// FormData, so a submitted request can't retarget a different payment by
// editing hidden form fields.

// Takes no FormData -- approving has no fields to submit, just a
// confirmation -- so it's called directly from a useTransition handler
// (see PaymentValidationPanel) rather than bound to useActionState.
export async function approvePaymentAction(paymentId: string): Promise<ApprovePaymentFormState> {
  const user = await requireModuleAccess("comprobantes");
  const result = await approvePaymentForUser(user, paymentId);

  if (result.ok) {
    revalidatePath("/comprobantes");
    revalidatePath(`/comprobantes/${paymentId}`);
    revalidatePath("/pagos");
    // redirect() throws, so nothing after this line runs on success -- the
    // caller (PaymentValidationPanel) never sees a returned ApprovePaymentFormState
    // in that case, only on failure below.
    redirect("/comprobantes");
  }

  return result;
}

export async function rejectPaymentAction(
  paymentId: string,
  _prevState: RejectPaymentFormState,
  formData: FormData,
): Promise<RejectPaymentFormState> {
  const user = await requireModuleAccess("comprobantes");
  const result = await rejectPaymentForUser(user, paymentId, formData.get("reason"));

  if (result.ok) {
    revalidatePath("/comprobantes");
    revalidatePath(`/comprobantes/${paymentId}`);
    revalidatePath("/pagos");
    // redirect() throws, so nothing after this line runs on success -- the
    // caller (PaymentValidationPanel's useActionState) never receives a
    // returned RejectPaymentFormState in that case, only on failure below.
    redirect("/comprobantes");
  }

  return result;
}
