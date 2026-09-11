import Link from "next/link";
import { Eye } from "lucide-react";
import type { DecoratedSaleListItem } from "@/server/services/sale-service";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { SaleStatus } from "@/generated/prisma/enums";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

const dateFormatter = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeZone: "UTC" });
const currencyFormatter = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

const STATUS_TONE: Record<SaleStatus, StatusTone> = {
  // ACTIVE means "no payment approved yet" (see payment-service.ts's
  // computeSaleStatus) -- shown as "Pendiente" below, not "Activa", so the
  // listing's four visible states read as a clear progression: Pendiente ->
  // Parcialmente pagada -> Pagada (or Vencida).
  ACTIVE: "pending",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  OVERDUE: "error",
  CANCELLED: "neutral",
};

const STATUS_LABELS: Record<SaleStatus, string> = {
  ACTIVE: "Pendiente",
  PARTIALLY_PAID: "Parcialmente pagada",
  PAID: "Pagada",
  OVERDUE: "Vencida",
  CANCELLED: "Cancelada",
};

export function SaleTable({ sales, showSeller }: { sales: DecoratedSaleListItem[]; showSeller: boolean }) {
  return (
    <Table className="min-w-[1180px]">
      <TableHeader>
        <tr>
          <TableHead>Cliente</TableHead>
          <TableHead>Producto</TableHead>
          <TableHead>Precio final</TableHead>
          <TableHead>Cuotas</TableHead>
          <TableHead>Pagado</TableHead>
          <TableHead>Saldo pendiente</TableHead>
          <TableHead>Próxima cuota</TableHead>
          <TableHead>Vencimiento</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </tr>
      </TableHeader>
      <TableBody>
        {sales.map((sale) => (
          <TableRow key={sale.id}>
            <TableCell>
              <div className="flex items-center gap-3">
                <UserAvatar name={sale.customer.fullName} size="sm" />
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{sale.customer.fullName}</p>
                  <p className="text-xs text-muted-foreground">{dateFormatter.format(sale.saleDate)}</p>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <p className="text-foreground">{sale.product.name}</p>
              {showSeller && <p className="text-xs text-muted-foreground">{sale.seller.name}</p>}
            </TableCell>
            <TableCell className="font-semibold text-foreground">
              {currencyFormatter.format(sale.finalPriceCents / 100)}
            </TableCell>
            <TableCell className="text-foreground">{sale.installments.length}</TableCell>
            <TableCell className="text-foreground">{currencyFormatter.format(sale.paidCents / 100)}</TableCell>
            <TableCell className="font-semibold text-foreground">
              {sale.balanceCents > 0 ? (
                currencyFormatter.format(sale.balanceCents / 100)
              ) : (
                <span className="font-normal text-success">$0,00</span>
              )}
            </TableCell>
            <TableCell>
              {sale.nextInstallment ? (
                <span className="whitespace-nowrap font-medium text-foreground">
                  C{sale.nextInstallment.installmentNumber} ·{" "}
                  {currencyFormatter.format(sale.nextInstallment.balanceCents / 100)}
                </span>
              ) : (
                <span className="text-xs text-success">Sin saldo pendiente</span>
              )}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {sale.nextInstallment ? dateFormatter.format(sale.nextInstallment.dueDate) : "—"}
            </TableCell>
            <TableCell>
              <StatusBadge tone={STATUS_TONE[sale.status]}>{STATUS_LABELS[sale.status]}</StatusBadge>
            </TableCell>
            <TableCell className="text-right">
              <Link
                href={`/ventas/${sale.id}`}
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
