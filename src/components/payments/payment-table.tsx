import Link from "next/link";
import { CreditCard, Eye } from "lucide-react";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { InstallmentStatus } from "@/generated/prisma/enums";
import type { DecoratedInstallmentListRow } from "@/server/services/payment-service";

const dateFormatter = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeZone: "UTC" });
const currencyFormatter = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

const STATUS_TONE: Record<InstallmentStatus, StatusTone> = {
  PENDING: "pending",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  OVERDUE: "error",
};

const STATUS_LABELS: Record<InstallmentStatus, string> = {
  PENDING: "Pendiente",
  PARTIALLY_PAID: "Parcial",
  PAID: "Pagada",
  OVERDUE: "Vencida",
};

export function PaymentTable({ installments }: { installments: DecoratedInstallmentListRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-4 py-3">Cliente</th>
              <th scope="col" className="px-4 py-3">Producto</th>
              <th scope="col" className="px-4 py-3">Vendedor</th>
              <th scope="col" className="px-4 py-3">Cuota</th>
              <th scope="col" className="px-4 py-3">Valor</th>
              <th scope="col" className="px-4 py-3">Pagado</th>
              <th scope="col" className="px-4 py-3">Pendiente</th>
              <th scope="col" className="px-4 py-3">Saldo</th>
              <th scope="col" className="px-4 py-3">Vencimiento</th>
              <th scope="col" className="px-4 py-3">Estado</th>
              <th scope="col" className="px-4 py-3 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {installments.map((installment) => (
              <tr key={installment.id} className="hover:bg-black/[0.02]">
                <td className="px-4 py-3 font-medium text-foreground">{installment.sale.customer.fullName}</td>
                <td className="px-4 py-3 text-muted-foreground">{installment.sale.product.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{installment.sale.seller.name}</td>
                <td className="px-4 py-3 text-muted-foreground">N.° {installment.installmentNumber}</td>
                <td className="px-4 py-3 text-foreground">{currencyFormatter.format(installment.totalCents / 100)}</td>
                <td className="px-4 py-3 text-foreground">{currencyFormatter.format(installment.paidCents / 100)}</td>
                <td className="px-4 py-3 text-warning">
                  {currencyFormatter.format(installment.pendingCents / 100)}
                </td>
                <td className="px-4 py-3 font-semibold text-foreground">
                  {currencyFormatter.format(installment.balanceCents / 100)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{dateFormatter.format(installment.dueDate)}</td>
                <td className="px-4 py-3">
                  <StatusBadge tone={STATUS_TONE[installment.effectiveStatus]}>
                    {STATUS_LABELS[installment.effectiveStatus]}
                  </StatusBadge>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    {installment.balanceCents > 0 ? (
                      <Link
                        href={`/pagos/${installment.id}#registrar-pago`}
                        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                      >
                        <CreditCard className="size-3.5" aria-hidden />
                        Pagar
                      </Link>
                    ) : (
                      <Link
                        href={`/pagos/${installment.id}`}
                        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-black/[0.04] hover:text-foreground"
                      >
                        <Eye className="size-3.5" aria-hidden />
                        Ver
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
