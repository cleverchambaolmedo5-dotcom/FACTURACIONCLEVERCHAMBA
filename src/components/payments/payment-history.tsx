import Link from "next/link";
import { PaymentMethod, PaymentValidationStatus, UserRole } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { ValidationStatusBadge } from "@/components/payments/validation-status-badge";
import { ReceiptLink } from "@/components/payments/receipt-link";

const dateFormatter = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeZone: "UTC" });
const currencyFormatter = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  BANK_TRANSFER: "Transferencia",
  DEPOSIT: "Depósito",
  CARD: "Tarjeta",
  OTHER: "Otro",
};

// A minimal structural shape (not tied to one repository's exact include)
// so this same "one row per real Payment" table can render both the cuota
// detail page's full payment history (payment-repository.ts's
// installmentDetailInclude) and the sale detail page's per-cuota payments
// (sale-repository.ts's saleDetailInclude) without either query needing to
// match the other field-for-field.
export type PaymentHistoryRow = {
  id: string;
  paymentDate: Date;
  amount: Prisma.Decimal | number | string;
  method: PaymentMethod;
  bankAccount: { bankName: string; alias: string } | null;
  reference: string | null;
  registeredBy: { name: string };
  validationStatus: PaymentValidationStatus;
  rejectionReason: string | null;
  receipt: { fileUrl: string } | null;
};

// `viewerRole` only decides whether the "Revisar" shortcut to
// /comprobantes/[id] is shown -- it's a UX convenience, not a security
// boundary. The Comprobantes module itself (and approvePaymentForUser/
// rejectPaymentForUser) re-checks the role server-side regardless of what
// this component renders.
export function PaymentHistory({
  payments,
  viewerRole,
}: {
  payments: PaymentHistoryRow[];
  viewerRole: UserRole;
}) {
  const canValidate = viewerRole === UserRole.ADMIN || viewerRole === UserRole.ACCOUNTANT;

  if (payments.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface px-4 py-6 text-center text-sm text-muted-foreground">
        Sin pagos registrados todavía.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-4 py-3">Fecha</th>
              <th scope="col" className="px-4 py-3">Monto</th>
              <th scope="col" className="px-4 py-3">Método</th>
              <th scope="col" className="px-4 py-3">Cuenta bancaria</th>
              <th scope="col" className="px-4 py-3">Referencia</th>
              <th scope="col" className="px-4 py-3">Registrado por</th>
              <th scope="col" className="px-4 py-3">Estado</th>
              <th scope="col" className="px-4 py-3">Comprobante</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {payments.map((payment) => (
              <tr key={payment.id}>
                <td className="px-4 py-3 text-muted-foreground">{dateFormatter.format(payment.paymentDate)}</td>
                <td className="px-4 py-3 font-medium text-foreground">
                  {currencyFormatter.format(Number(payment.amount))}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{METHOD_LABELS[payment.method]}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {payment.bankAccount ? `${payment.bankAccount.bankName} — ${payment.bankAccount.alias}` : "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{payment.reference || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{payment.registeredBy.name}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <ValidationStatusBadge status={payment.validationStatus} />
                    {payment.validationStatus === "REJECTED" && payment.rejectionReason && (
                      <span className="text-xs text-muted-foreground">{payment.rejectionReason}</span>
                    )}
                    {canValidate && payment.validationStatus === "PENDING_VALIDATION" && (
                      <Link
                        href={`/comprobantes/${payment.id}`}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Revisar
                      </Link>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {payment.receipt ? (
                    <ReceiptLink fileUrl={payment.receipt.fileUrl} />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
