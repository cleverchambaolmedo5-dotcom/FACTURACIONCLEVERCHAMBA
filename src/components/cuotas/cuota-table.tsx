import Link from "next/link";
import { Eye, CreditCard } from "lucide-react";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import type { CuotaBucket, DecoratedCuotaRow } from "@/server/services/payment-service";
import { UserAvatar } from "@/components/shared/user-avatar";
import { cn } from "@/lib/utils";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

const dateFormatter = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeZone: "UTC" });
const currencyFormatter = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

const STATUS_TONE: Record<CuotaBucket, StatusTone> = {
  PENDING: "pending",
  PAID: "success",
  OVERDUE: "error",
};

const STATUS_LABELS: Record<CuotaBucket, string> = {
  PENDING: "Pendiente",
  PAID: "Pagada",
  OVERDUE: "Vencida",
};

// Read-only listing -- "Ver" reuses the existing cuota detail route
// (/pagos/[id], see src/app/(app)/pagos/[id]/page.tsx) rather than a new
// Cuotas-specific detail page, since that page already shows everything
// this module points at: venta, cliente, producto, monto, vencimiento,
// estado and full payment history.
export function CuotaTable({ installments }: { installments: DecoratedCuotaRow[] }) {
  return (
    <Table className="min-w-[1080px]">
      <TableHeader>
        <tr>
          <TableHead>Cliente</TableHead>
          <TableHead>Producto</TableHead>
          <TableHead>Cuota</TableHead>
          <TableHead>Monto acordado</TableHead>
          <TableHead>Pagado</TableHead>
          <TableHead>Saldo pendiente</TableHead>
          <TableHead>Vencimiento</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Acción</TableHead>
        </tr>
      </TableHeader>
      <TableBody>
        {installments.map((installment) => (
          <TableRow key={installment.id}>
            <TableCell>
              <div className="flex items-center gap-3">
                <UserAvatar name={installment.sale.customer.fullName} size="sm" />
                <span className="font-medium text-foreground">{installment.sale.customer.fullName}</span>
              </div>
            </TableCell>
            <TableCell className="text-muted-foreground">{installment.sale.product.name}</TableCell>
            <TableCell className="text-muted-foreground">N.º {installment.installmentNumber}</TableCell>
            <TableCell className="text-foreground">
              {currencyFormatter.format(installment.totalCents / 100)}
            </TableCell>
            <TableCell className="text-foreground">
              {currencyFormatter.format(installment.paidCents / 100)}
            </TableCell>
            <TableCell className="font-semibold text-foreground">
              {currencyFormatter.format(installment.balanceCents / 100)}
            </TableCell>
            <TableCell
              className={cn(
                installment.bucket === "OVERDUE" ? "font-medium text-error" : "text-muted-foreground",
              )}
            >
              {dateFormatter.format(installment.dueDate)}
            </TableCell>
            <TableCell>
              <StatusBadge tone={STATUS_TONE[installment.bucket]}>
                {STATUS_LABELS[installment.bucket]}
              </StatusBadge>
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                {installment.balanceCents > 0 && (
                  <Link
                    href={`/pagos/${installment.id}#registrar-pago`}
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary-soft"
                  >
                    <CreditCard className="size-3.5" aria-hidden />
                    Pagar
                  </Link>
                )}
                <Link
                  href={`/pagos/${installment.id}`}
                  className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-black/[0.04] hover:text-foreground"
                >
                  <Eye className="size-3.5" aria-hidden />
                  Ver
                </Link>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
