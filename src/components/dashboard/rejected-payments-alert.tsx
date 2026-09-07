import Link from "next/link";
import { AlertTriangle, Wrench } from "lucide-react";
import type { RejectedPaymentAlert } from "@/server/services/payment-service";

const dateFormatter = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeZone: "UTC" });
const currencyFormatter = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

// Seller-dashboard-only alert (see dashboard-service.ts#SellerSalesDashboardData):
// surfaces payments Contabilidad rejected that still need a corrected
// re-registration. Renders nothing when there's nothing to fix -- unlike
// DashboardSection's other cards, this section must not appear at all
// (not even an empty state) when `payments` is empty.
export function RejectedPaymentsAlert({ payments }: { payments: RejectedPaymentAlert[] }) {
  if (payments.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-error/30 bg-error/5 p-4">
      <div className="flex items-center gap-2 text-error">
        <AlertTriangle className="size-5 shrink-0" aria-hidden />
        <p className="text-sm font-semibold">
          Tienes {payments.length}{" "}
          {payments.length === 1 ? "pago que requiere corrección" : "pagos que requieren corrección"}
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Contabilidad rechazó estos comprobantes. Vuelve a registrar el pago de cada cuota para que
        quede nuevamente pendiente de validación.
      </p>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-4 py-3">Cliente</th>
                <th scope="col" className="px-4 py-3">Venta</th>
                <th scope="col" className="px-4 py-3">Cuota</th>
                <th scope="col" className="px-4 py-3">Monto</th>
                <th scope="col" className="px-4 py-3">Motivo</th>
                <th scope="col" className="px-4 py-3">Fecha de rechazo</th>
                <th scope="col" className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payments.map((payment) => (
                <tr key={payment.paymentId} className="hover:bg-black/[0.02]">
                  <td className="px-4 py-3 font-medium text-foreground">{payment.customerName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{payment.productName}</td>
                  <td className="px-4 py-3 text-muted-foreground">Cuota {payment.installmentNumber}</td>
                  <td className="px-4 py-3 font-semibold text-foreground">
                    {currencyFormatter.format(payment.amountCents / 100)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{payment.rejectionReason || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {payment.rejectedAt ? dateFormatter.format(payment.rejectedAt) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/pagos/${payment.installmentId}`}
                      className="inline-flex items-center gap-1.5 rounded-md bg-error/10 px-2.5 py-1.5 text-sm font-medium text-error transition-colors hover:bg-error/20"
                    >
                      <Wrench className="size-3.5" aria-hidden />
                      Corregir pago
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
