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

// One row = one real Payment -- never grouped by installment/cuota. A cuota
// paid through several payments (e.g. part cash, part transfer) always
// shows up here as that many separate rows, each with its own forma de
// pago/cuenta/voucher/fecha real de registro -- see the module design note
// in payment-service.ts. "Ver cuota" reuses the existing cuota detail route
// (/pagos/[id]), which already shows this payment inside that cuota's full
// payment history.
export function PaymentTable({ payments }: { payments: DecoratedPaymentListRow[] }) {
  return (
    <Table className="min-w-[1280px]">
      <TableHeader>
        <tr>
          <TableHead>Cliente</TableHead>
          <TableHead>Producto</TableHead>
          <TableHead>Vendedor</TableHead>
          <TableHead>Cuota</TableHead>
          <TableHead>Monto pagado</TableHead>
          <TableHead>Forma de pago</TableHead>
          <TableHead>Cuenta bancaria</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Registrado por</TableHead>
          <TableHead>Voucher</TableHead>
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
            <TableCell className="text-muted-foreground">{payment.installment.sale.seller.name}</TableCell>
            <TableCell className="text-muted-foreground">N.° {payment.installment.installmentNumber}</TableCell>
            <TableCell className="text-base font-semibold text-foreground">
              {currencyFormatter.format(Number(payment.amount))}
            </TableCell>
            <TableCell className="text-muted-foreground">{METHOD_LABELS[payment.method]}</TableCell>
            <TableCell className="text-muted-foreground">
              {payment.bankAccount ? `${payment.bankAccount.bankName} — ${payment.bankAccount.alias}` : "—"}
            </TableCell>
            <TableCell className="text-muted-foreground">{dateFormatter.format(payment.paymentDate)}</TableCell>
            <TableCell>
              <ValidationStatusBadge status={payment.validationStatus} />
            </TableCell>
            <TableCell className="text-muted-foreground">{payment.registeredBy.name}</TableCell>
            <TableCell>
              {payment.receipt ? (
                <ReceiptLink fileUrl={payment.receipt.fileUrl} />
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell className="text-right">
              <Link
                href={`/pagos/${payment.installment.id}`}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary-soft"
              >
                <Eye className="size-3.5" aria-hidden />
                Ver cuota
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
