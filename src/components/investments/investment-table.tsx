import Link from "next/link";
import { Eye } from "lucide-react";
import type {
  InvestmentListItem,
  InvestmentSellerListItem,
} from "@/server/repositories/investment-repository";
import { InvestmentStatusBadge } from "./investment-status";

const dateFormatter = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeZone: "UTC" });
const currencyFormatter = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });
const percentFormatter = new Intl.NumberFormat("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Renders one of two column sets depending on `view` -- "financial"
// (ADMIN/ACCOUNTANT) includes monto/tasa; "seller" (SELLER) never does,
// because investmentSellerListSelect (see investment-repository.ts) never
// queried those columns for these rows in the first place. This is a
// single component (not two near-duplicates) precisely because the only
// difference is which columns render -- the security boundary already
// happened server-side, before this component ever received its props.
export function InvestmentTable(
  props:
    | { view: "financial"; items: InvestmentListItem[] }
    | { view: "seller"; items: InvestmentSellerListItem[] },
) {
  const isFinancial = props.view === "financial";

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-4 py-3">Inversionista</th>
              {isFinancial && <th scope="col" className="px-4 py-3">Monto</th>}
              {isFinancial && <th scope="col" className="px-4 py-3">Tasa</th>}
              <th scope="col" className="px-4 py-3">Inicio</th>
              <th scope="col" className="px-4 py-3">1er rendimiento</th>
              <th scope="col" className="px-4 py-3">Vencimiento</th>
              <th scope="col" className="px-4 py-3">Vendedor</th>
              <th scope="col" className="px-4 py-3">Estado</th>
              <th scope="col" className="px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {props.items.map((investment) => (
              <tr key={investment.id} className="hover:bg-black/[0.02]">
                <td className="px-4 py-3 font-medium text-foreground">{investment.customer.fullName}</td>
                {isFinancial && "principalAmount" in investment && (
                  <td className="px-4 py-3 font-semibold text-foreground">
                    {currencyFormatter.format(Number(investment.principalAmount))}
                  </td>
                )}
                {isFinancial && "annualRate" in investment && (
                  <td className="px-4 py-3 text-muted-foreground">
                    {percentFormatter.format(Number(investment.annualRate))}%
                  </td>
                )}
                <td className="px-4 py-3 text-muted-foreground">{dateFormatter.format(investment.startDate)}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {dateFormatter.format(investment.firstReturnDate)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {dateFormatter.format(investment.maturityDate)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{investment.seller.name}</td>
                <td className="px-4 py-3">
                  <InvestmentStatusBadge status={investment.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/inversiones/${investment.id}`}
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
