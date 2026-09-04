import Link from "next/link";
import { Eye } from "lucide-react";
import type { OverdueInstallmentItem } from "@/server/services/dashboard-service";

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
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-4 py-3">Cliente</th>
              <th scope="col" className="px-4 py-3">Producto</th>
              <th scope="col" className="px-4 py-3">Cuota</th>
              <th scope="col" className="px-4 py-3">Monto pendiente</th>
              <th scope="col" className="px-4 py-3">Vencimiento</th>
              <th scope="col" className="px-4 py-3">Días vencidos</th>
              <th scope="col" className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {installments.map((installment) => (
              <tr key={installment.id} className="hover:bg-black/[0.02]">
                <td className="px-4 py-3 font-medium text-foreground">{installment.customerName}</td>
                <td className="px-4 py-3 text-muted-foreground">{installment.productName}</td>
                <td className="px-4 py-3 text-muted-foreground">N.° {installment.installmentNumber}</td>
                <td className="px-4 py-3 font-semibold text-error">
                  {currencyFormatter.format(installment.balanceCents / 100)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{dateFormatter.format(installment.dueDate)}</td>
                <td className="px-4 py-3 text-muted-foreground">{installment.daysOverdue}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/ventas/${installment.saleId}`}
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
