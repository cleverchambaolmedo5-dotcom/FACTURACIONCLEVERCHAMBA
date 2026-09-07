"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireModuleAccess } from "@/lib/auth/guards";
import { registerPaymentForUser, type RegisterPaymentResult } from "@/server/services/payment-service";

export type PaymentFormState = RegisterPaymentResult | undefined;

// Every mutation re-verifies module access itself -- it must never rely
// on the page having already checked it, since a Server Action can be
// invoked directly regardless of which page rendered the form. Record-
// level ownership (a SELLER can only pay installments on their own sales)
// is enforced inside registerPaymentForUser, not here.
export async function registerPaymentAction(
  installmentId: string,
  _prevState: PaymentFormState,
  formData: FormData,
): Promise<PaymentFormState> {
  const user = await requireModuleAccess("pagos");

  const result = await registerPaymentForUser(user, installmentId, {
    amount: formData.get("amount"),
    paymentDate: formData.get("paymentDate"),
    method: formData.get("method"),
    reference: formData.get("reference"),
    notes: formData.get("notes"),
    receipt: formData.get("receipt"),
  });

  if (!result.ok) {
    // Missing/invalid receipt, amount, permissions, server error, etc. --
    // stay on the current page and let the form show the error. Never
    // redirect on failure.
    return result;
  }

  // The new payment is only ever created as PENDING_VALIDATION (see
  // registerPaymentForUser) and never itself changes the installment's
  // approved balance -- revalidating here just refreshes the already-
  // correct numbers/status so /pagos and this installment's detail page
  // don't serve stale cached data after the redirect below. /comprobantes
  // and /cuotas read the exact same Payment/Installment rows (see
  // payment-service.ts#listPendingPaymentsForUser and #listCuotasForUser)
  // and must be revalidated too, mirroring approvePaymentAction/
  // rejectPaymentAction in comprobantes/actions.ts -- otherwise a new
  // PENDING_VALIDATION payment can fail to show up in "Comprobantes
  // pendientes de validación" if either page was rendered and cached
  // earlier in the same client session.
  revalidatePath("/pagos");
  revalidatePath(`/pagos/${installmentId}`);
  revalidatePath("/comprobantes");
  revalidatePath("/cuotas");

  // redirect() throws internally -- this only runs, and only reaches here,
  // once registerPaymentForUser has actually committed the Payment.
  redirect("/pagos?pago=registrado");
}
