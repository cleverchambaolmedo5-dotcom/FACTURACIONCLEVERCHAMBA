import Link from "next/link";
import { Eye } from "lucide-react";
import type { SaleListItem } from "@/server/repositories/sale-repository";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { SaleStatus } from "@/generated/prisma/enums";

const dateFormatter = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeZone: "UTC" });
const currencyFormatter = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

const STATUS_TONE: Record<SaleStatus, StatusTone> = {
  ACTIVE: "pending",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  OVERDUE: "error",
  CANCELLED: "neutral",
};

const STATUS_LABELS: Record<SaleStatus, string> = {
  ACTIVE: "Activa",
  PARTIALLY_PAID: "Parcialmente pagada",
  PAID: "Pagada",
  OVERDUE: "Vencida",
  CANCELLED: "Cancelada",
};

export function SaleTable({ sales }: { sales: SaleListItem[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-4 py-3">Cliente</th>
              <th scope="col" className="px-4 py-3">Producto</th>
              <th scope="col" className="px-4 py-3">Vendedor</th>
              <th scope="col" className="px-4 py-3">Fecha</th>
              <th scope="col" className="px-4 py-3">Precio final</th>
              <th scope="col" className="px-4 py-3">Cuotas</th>
              <th scope="col" className="px-4 py-3">Estado</th>
              <th scope="col" className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sales.map((sale) => (
              <tr key={sale.id} className="hover:bg-black/[0.02]">
                <td className="px-4 py-3 font-medium text-foreground">{sale.customer.fullName}</td>
                <td className="px-4 py-3 text-muted-foreground">{sale.product.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{sale.seller.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{dateFormatter.format(sale.saleDate)}</td>
                <td className="px-4 py-3 font-semibold text-foreground">
                  {currencyFormatter.format(Number(sale.finalPrice))}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{sale.installments.length}</td>
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
