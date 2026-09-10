import Link from "next/link";
import { Eye } from "lucide-react";
import type { DecoratedSaleListItem } from "@/server/services/sale-service";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { SaleStatus } from "@/generated/prisma/enums";

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
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-4 py-3">Cliente</th>
              <th scope="col" className="px-4 py-3">Fecha</th>
              <th scope="col" className="px-4 py-3">Precio final</th>
              <th scope="col" className="px-4 py-3">Cuotas</th>
              <th scope="col" className="px-4 py-3">Pagado</th>
              <th scope="col" className="px-4 py-3">Saldo pendiente</th>
              <th scope="col" className="px-4 py-3">Próxima cuota</th>
              <th scope="col" className="px-4 py-3">Estado</th>
              <th scope="col" className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sales.map((sale) => (
              <tr key={sale.id} className="hover:bg-black/[0.02]">
                <td className="px-4 py-3">
                  <p className="font-medium text-foreground">{sale.customer.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {sale.product.name}
                    {showSeller && <> · {sale.seller.name}</>}
                  </p>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{dateFormatter.format(sale.saleDate)}</td>
                <td className="px-4 py-3 font-semibold text-foreground">
                  {currencyFormatter.format(sale.finalPriceCents / 100)}
                </td>
                <td className="px-4 py-3 text-foreground">{sale.installments.length}</td>
                <td className="px-4 py-3 text-foreground">
                  {currencyFormatter.format(sale.paidCents / 100)}
                </td>
                <td className="px-4 py-3 font-semibold text-foreground">
                  {sale.balanceCents > 0 ? (
                    currencyFormatter.format(sale.balanceCents / 100)
                  ) : (
                    <span className="font-normal text-success">$0,00</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {sale.nextInstallment ? (
                    <div className="whitespace-nowrap">
                      <p className="font-medium text-foreground">
                        C{sale.nextInstallment.installmentNumber} ·{" "}
                        {currencyFormatter.format(sale.nextInstallment.balanceCents / 100)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {dateFormatter.format(sale.nextInstallment.dueDate)}
                      </p>
                    </div>
                  ) : (
                    <span className="text-xs text-success">Sin saldo pendiente</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge tone={STATUS_TONE[sale.status]}>{STATUS_LABELS[sale.status]}</StatusBadge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/ventas/${sale.id}`}
                    className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                  >
                    <Eye className="size-3.5" aria-hidden />
                    Ver
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
