import Link from "next/link";
import { Eye, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import type { DecoratedSaleListItem, DecoratedSaleInstallment } from "@/server/services/sale-service";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { SaleStatus, InstallmentStatus } from "@/generated/prisma/enums";

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

const INSTALLMENT_ICON: Record<InstallmentStatus, typeof CheckCircle2> = {
  PAID: CheckCircle2,
  PARTIALLY_PAID: Clock,
  PENDING: Clock,
  OVERDUE: AlertTriangle,
};

const INSTALLMENT_ICON_CLASS: Record<InstallmentStatus, string> = {
  PAID: "text-success",
  PARTIALLY_PAID: "text-warning",
  PENDING: "text-muted-foreground",
  OVERDUE: "text-error",
};

/** One "C1 $300" row inside the compact Cuotas cell, with an icon for its real (APPROVED-payments-based) status -- never just the stored/possibly-stale status column. */
function InstallmentBadgeRow({ installment }: { installment: DecoratedSaleInstallment }) {
  const Icon = INSTALLMENT_ICON[installment.effectiveStatus];
  return (
    <div className="flex items-center gap-1 whitespace-nowrap">
      <Icon className={`size-3.5 shrink-0 ${INSTALLMENT_ICON_CLASS[installment.effectiveStatus]}`} aria-hidden />
      <span className="text-muted-foreground">C{installment.installmentNumber}</span>
      <span className="font-medium text-foreground">
        {currencyFormatter.format(installment.totalCents / 100)}
      </span>
    </div>
  );
}

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
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-0.5 text-xs">
                    {sale.installments.map((installment) => (
                      <InstallmentBadgeRow key={installment.id} installment={installment} />
                    ))}
                  </div>
                </td>
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
                      <span className="font-medium text-foreground">
                        C{sale.nextInstallment.installmentNumber} ·{" "}
                        {currencyFormatter.format(sale.nextInstallment.balanceCents / 100)}
                      </span>
                      {sale.nextInstallment.paidCents > 0 && (
                        <p className="text-xs text-muted-foreground">pendiente</p>
                      )}
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
