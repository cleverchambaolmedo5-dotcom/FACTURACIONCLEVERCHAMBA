import Link from "next/link";
import { AlertTriangle, Wrench } from "lucide-react";
import type { RejectedPaymentAlert } from "@/server/services/payment-service";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

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
    <section className="flex flex-col gap-3 rounded-lg border border-error/30 bg-error-soft p-4">
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

      <Table className="min-w-[760px]">
        <TableHeader>
          <tr>
            <TableHead>Cliente</TableHead>
            <TableHead>Venta</TableHead>
            <TableHead>Cuota</TableHead>
            <TableHead>Monto</TableHead>
            <TableHead>Motivo</TableHead>
            <TableHead>Fecha de rechazo</TableHead>
            <TableHead className="text-right">Acción</TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {payments.map((payment) => (
            <TableRow key={payment.paymentId}>
              <TableCell className="font-medium text-foreground">{payment.customerName}</TableCell>
              <TableCell className="text-muted-foreground">{payment.productName}</TableCell>
              <TableCell className="text-muted-foreground">Cuota {payment.installmentNumber}</TableCell>
              <TableCell className="font-semibold text-foreground">
                {currencyFormatter.format(payment.amountCents / 100)}
              </TableCell>
              <TableCell className="text-muted-foreground">{payment.rejectionReason || "—"}</TableCell>
              <TableCell className="text-muted-foreground">
                {payment.rejectedAt ? dateFormatter.format(payment.rejectedAt) : "—"}
              </TableCell>
              <TableCell className="text-right">
                <Link
                  href={`/pagos/${payment.installmentId}`}
                  className="inline-flex items-center gap-1.5 rounded-md bg-error-soft px-2.5 py-1.5 text-sm font-medium text-error transition-colors hover:bg-error/20"
                >
                  <Wrench className="size-3.5" aria-hidden />
                  Corregir pago
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
