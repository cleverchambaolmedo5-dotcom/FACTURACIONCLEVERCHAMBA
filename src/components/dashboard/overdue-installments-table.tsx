import Link from "next/link";
import { Eye } from "lucide-react";
import type { OverdueInstallmentItem } from "@/server/services/dashboard-service";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

const dateFormatter = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeZone: "UTC" });
const currencyFormatter = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

// Installment-level view of "Ventas vencidas" for the ADMIN sales
// dashboard -- mirrors PendingPaymentsTable's layout, but sourced from
// listInstallmentsForUser's effective-status OVERDUE rows
// (payment-service.ts) instead of SaleTable's sale-level rows, so each row
// is one actual overdue cuota (monto pendiente + días vencidos), not a
// whole sale.
export function OverdueInstallmentsTable({ installments }: { installments: OverdueInstallmentItem[] }) {
  return (
    <Table className="min-w-[860px]">
      <TableHeader>
        <tr>
          <TableHead>Cliente</TableHead>
          <TableHead>Producto</TableHead>
          <TableHead>Cuota</TableHead>
          <TableHead>Monto pendiente</TableHead>
          <TableHead>Vencimiento</TableHead>
          <TableHead>Días vencidos</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </tr>
      </TableHeader>
      <TableBody>
        {installments.map((installment) => (
          <TableRow key={installment.id}>
            <TableCell className="font-medium text-foreground">{installment.customerName}</TableCell>
            <TableCell className="text-muted-foreground">{installment.productName}</TableCell>
            <TableCell className="text-muted-foreground">N.° {installment.installmentNumber}</TableCell>
            <TableCell className="font-semibold text-error">
              {currencyFormatter.format(installment.balanceCents / 100)}
            </TableCell>
            <TableCell className="text-muted-foreground">{dateFormatter.format(installment.dueDate)}</TableCell>
            <TableCell className="text-muted-foreground">{installment.daysOverdue}</TableCell>
            <TableCell className="text-right">
              <Link
                href={`/ventas/${installment.saleId}`}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary-soft"
              >
                <Eye className="size-3.5" aria-hidden />
                Ver
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
