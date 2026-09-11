import Link from "next/link";
import { Eye } from "lucide-react";
import { PaymentMethod } from "@/generated/prisma/enums";
import type { DecoratedPaymentListRow } from "@/server/services/payment-service";
import { ValidationStatusBadge } from "@/components/payments/validation-status-badge";
import { ReceiptLink } from "@/components/payments/receipt-link";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

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
// place that re-checks role and re-reads the fresh balance. Reused as-is by
// the ADMIN/ACCOUNTANT sales dashboards ("Comprobantes pendientes de
// validación") -- this table has no logic of its own to diverge between
// the two call sites.
export function PendingPaymentsTable({ payments }: { payments: DecoratedPaymentListRow[] }) {
  return (
    <Table className="min-w-[980px]">
      <TableHeader>
        <tr>
          <TableHead>Cliente</TableHead>
          <TableHead>Producto</TableHead>
          <TableHead>Cuota</TableHead>
          <TableHead>Monto</TableHead>
          <TableHead>Método</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Comprobante</TableHead>
          <TableHead className="text-right">Acción</TableHead>
        </tr>
      </TableHeader>
      <TableBody>
        {payments.map((payment) => (
          <TableRow key={payment.id}>
            <TableCell>
              <div className="flex items-center gap-3">
                <UserAvatar name={payment.installment.sale.customer.fullName} size="sm" />
                <span className="font-medium text-foreground">
                  {payment.installment.sale.customer.fullName}
                </span>
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground">{payment.installment.sale.product.name}</TableCell>
            <TableCell className="text-muted-foreground">N.° {payment.installment.installmentNumber}</TableCell>
            <TableCell className="text-base font-semibold text-foreground">
              {currencyFormatter.format(Number(payment.amount))}
            </TableCell>
            <TableCell className="text-muted-foreground">{METHOD_LABELS[payment.method]}</TableCell>
            <TableCell className="text-muted-foreground">{dateFormatter.format(payment.paymentDate)}</TableCell>
            <TableCell>
              <ValidationStatusBadge status={payment.validationStatus} />
            </TableCell>
            <TableCell>
              {payment.receipt ? (
                <ReceiptLink fileUrl={payment.receipt.fileUrl} />
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell className="text-right">
              <Link
                href={`/comprobantes/${payment.id}`}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary-soft"
              >
                <Eye className="size-3.5" aria-hidden />
                Revisar
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
