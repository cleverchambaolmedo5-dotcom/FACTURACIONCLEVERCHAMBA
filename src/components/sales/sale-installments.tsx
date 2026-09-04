import Link from "next/link";
import { CreditCard, History } from "lucide-react";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { InstallmentStatus } from "@/generated/prisma/enums";
import type { InstallmentWithTotals } from "@/server/services/payment-service";
import type { SaleDetail } from "@/server/repositories/sale-repository";

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

type NonNullSaleDetail = NonNullable<SaleDetail>;
type DecoratedSaleInstallment = InstallmentWithTotals<NonNullSaleDetail["installments"][number]>;

// Purely presentational -- totals/effectiveStatus are computed by the page
// via payment-service.ts#computeInstallmentTotals before this renders, the
// same "page/service computes, component renders" split used everywhere
// else (see SaleTable, PaymentTable).
export function SaleInstallments({ installments }: { installments: DecoratedSaleInstallment[] }) {
  const hasAnyPayment = installments.some((installment) => installment.paidCents > 0);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-4 py-3">N°</th>
              <th scope="col" className="px-4 py-3">Valor</th>
              <th scope="col" className="px-4 py-3">Pagado aprobado</th>
              <th scope="col" className="px-4 py-3">Pendiente de validación</th>
              <th scope="col" className="px-4 py-3">Saldo</th>
              <th scope="col" className="px-4 py-3">Vencimiento</th>
              <th scope="col" className="px-4 py-3">Estado</th>
              <th scope="col" className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {installments.map((installment) => (
              <tr key={installment.id}>
                <td className="px-4 py-3 font-medium text-foreground">{installment.installmentNumber}</td>
                <td className="px-4 py-3 text-foreground">{currencyFormatter.format(installment.totalCents / 100)}</td>
                <td className="px-4 py-3 text-foreground">{currencyFormatter.format(installment.paidCents / 100)}</td>
                <td className="px-4 py-3 text-warning">
                  {currencyFormatter.format(installment.pendingCents / 100)}
                </td>
                <td className="px-4 py-3 font-medium text-foreground">
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
                    {installment.balanceCents > 0 && (
                      <Link
                        href={`/pagos/${installment.id}#registrar-pago`}
                        className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                      >
                        <CreditCard className="size-3.5" aria-hidden />
                        Pagar
                      </Link>
                    )}
                    <Link
                      href={`/pagos/${installment.id}`}
                      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-black/[0.04] hover:text-foreground"
                    >
                      <History className="size-3.5" aria-hidden />
                      Historial
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!hasAnyPayment && (
        <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
          Sin pagos registrados.
        </p>
      )}
    </div>
  );
}
