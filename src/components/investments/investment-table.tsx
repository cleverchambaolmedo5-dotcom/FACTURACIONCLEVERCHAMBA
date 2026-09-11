import Link from "next/link";
import { Eye } from "lucide-react";
import type {
  InvestmentListItem,
  InvestmentSellerListItem,
} from "@/server/repositories/investment-repository";
import { InvestmentStatusBadge } from "./investment-status";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

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
    <Table className="min-w-[760px]">
      <TableHeader>
        <tr>
          <TableHead>Inversionista</TableHead>
          {isFinancial && <TableHead>Monto</TableHead>}
          {isFinancial && <TableHead>Tasa</TableHead>}
          <TableHead>Inicio</TableHead>
          <TableHead>1er rendimiento</TableHead>
          <TableHead>Vencimiento</TableHead>
          <TableHead>Vendedor</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </tr>
      </TableHeader>
      <TableBody>
        {props.items.map((investment) => (
          <TableRow key={investment.id}>
            <TableCell className="font-medium text-foreground">{investment.customer.fullName}</TableCell>
            {isFinancial && "principalAmount" in investment && (
              <TableCell className="font-semibold text-foreground">
                {currencyFormatter.format(Number(investment.principalAmount))}
              </TableCell>
            )}
            {isFinancial && "annualRate" in investment && (
              <TableCell className="text-muted-foreground">
                {percentFormatter.format(Number(investment.annualRate))}%
              </TableCell>
            )}
            <TableCell className="text-muted-foreground">{dateFormatter.format(investment.startDate)}</TableCell>
            <TableCell className="text-muted-foreground">
              {dateFormatter.format(investment.firstReturnDate)}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {dateFormatter.format(investment.maturityDate)}
            </TableCell>
            <TableCell className="text-muted-foreground">{investment.seller.name}</TableCell>
            <TableCell>
              <InvestmentStatusBadge status={investment.status} />
            </TableCell>
            <TableCell className="text-right">
              <Link
                href={`/inversiones/${investment.id}`}
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
