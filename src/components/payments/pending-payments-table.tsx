import Link from "next/link";
import { Eye } from "lucide-react";
import { PaymentMethod } from "@/generated/prisma/enums";
import type { DecoratedPaymentListRow } from "@/server/services/payment-service";
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

// Purely presentational, mirroring PaymentTable/SaleInstallments -- the
// page (server component) fetches and filters the rows, this only renders
// them. Approve/reject actions live on the detail page (/comprobantes/[id])
// rather than inline here, so every validation decision goes through one
// place that re-checks role and re-reads the fresh balance.
export function PendingPaymentsTable({ payments }: { payments: DecoratedPaymentListRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-4 py-3">Cliente</th>
              <th scope="col" className="px-4 py-3">Producto</th>
              <th scope="col" className="px-4 py-3">Cuota</th>
              <th scope="col" className="px-4 py-3">Monto</th>
              <th scope="col" className="px-4 py-3">Método</th>
              <th scope="col" className="px-4 py-3">Fecha</th>
              <th scope="col" className="px-4 py-3">Estado</th>
              <th scope="col" className="px-4 py-3">Comprobante</th>
              <th scope="col" className="px-4 py-3 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {payments.map((payment) => (
              <tr key={payment.id} className="hover:bg-black/[0.02]">
                <td className="px-4 py-3 font-medium text-foreground">
                  {payment.installment.sale.customer.fullName}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{payment.installment.sale.product.name}</td>
                <td className="px-4 py-3 text-muted-foreground">N.° {payment.installment.installmentNumber}</td>
                <td className="px-4 py-3 text-foreground">{currencyFormatter.format(Number(payment.amount))}</td>
                <td className="px-4 py-3 text-muted-foreground">{METHOD_LABELS[payment.method]}</td>
                <td className="px-4 py-3 text-muted-foreground">{dateFormatter.format(payment.paymentDate)}</td>
                <td className="px-4 py-3">
                  <ValidationStatusBadge status={payment.validationStatus} />
                </td>
                <td className="px-4 py-3">
                  {payment.receipt ? (
                    <ReceiptLink fileUrl={payment.receipt.fileUrl} />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/comprobantes/${payment.id}`}
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                  >
                    <Eye className="size-3.5" aria-hidden />
                    Revisar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
