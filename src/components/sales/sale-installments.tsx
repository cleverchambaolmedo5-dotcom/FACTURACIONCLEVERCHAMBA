import Link from "next/link";
import { CreditCard, History } from "lucide-react";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { InstallmentStatus } from "@/generated/prisma/enums";
import type { InstallmentWithTotals } from "@/server/services/payment-service";
import type { SaleDetail } from "@/server/repositories/sale-repository";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

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
    <div className="space-y-2">
      <Table className="min-w-[880px]">
        <TableHeader>
          <tr>
            <TableHead>N°</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Pagado aprobado</TableHead>
            <TableHead>Pendiente de validación</TableHead>
            <TableHead>Saldo</TableHead>
            <TableHead>Vencimiento</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </tr>
        </TableHeader>
        <TableBody>
          {installments.map((installment) => (
            <TableRow key={installment.id}>
              <TableCell className="font-medium text-foreground">{installment.installmentNumber}</TableCell>
              <TableCell>{currencyFormatter.format(installment.totalCents / 100)}</TableCell>
              <TableCell>{currencyFormatter.format(installment.paidCents / 100)}</TableCell>
              <TableCell className="text-warning">
                {currencyFormatter.format(installment.pendingCents / 100)}
              </TableCell>
              <TableCell className="font-medium">{currencyFormatter.format(installment.balanceCents / 100)}</TableCell>
              <TableCell className="text-muted-foreground">{dateFormatter.format(installment.dueDate)}</TableCell>
              <TableCell>
                <StatusBadge tone={STATUS_TONE[installment.effectiveStatus]}>
                  {STATUS_LABELS[installment.effectiveStatus]}
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
                    <History className="size-3.5" aria-hidden />
                    Historial
                  </Link>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!hasAnyPayment && <p className="text-sm text-muted-foreground">Sin pagos registrados.</p>}
    </div>
  );
}
