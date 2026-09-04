import Link from "next/link";
import { Eye } from "lucide-react";
import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import type { CuotaBucket, DecoratedCuotaRow } from "@/server/services/payment-service";

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
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-4 py-3">Cliente</th>
              <th scope="col" className="px-4 py-3">Producto</th>
              <th scope="col" className="px-4 py-3">Cuota</th>
              <th scope="col" className="px-4 py-3">Monto</th>
              <th scope="col" className="px-4 py-3">Vencimiento</th>
              <th scope="col" className="px-4 py-3">Estado</th>
              <th scope="col" className="px-4 py-3 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {installments.map((installment) => (
              <tr key={installment.id} className="hover:bg-black/[0.02]">
                <td className="px-4 py-3 font-medium text-foreground">
                  {installment.sale.customer.fullName}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{installment.sale.product.name}</td>
                <td className="px-4 py-3 text-muted-foreground">N.º {installment.installmentNumber}</td>
                <td className="px-4 py-3 text-foreground">
                  {currencyFormatter.format(installment.totalCents / 100)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{dateFormatter.format(installment.dueDate)}</td>
                <td className="px-4 py-3">
                  <StatusBadge tone={STATUS_TONE[installment.bucket]}>
                    {STATUS_LABELS[installment.bucket]}
                  </StatusBadge>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/pagos/${installment.id}`}
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
