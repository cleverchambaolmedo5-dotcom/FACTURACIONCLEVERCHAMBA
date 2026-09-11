import type { DecoratedBankTransaction } from "@/server/services/bank-account-service";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";

const dateFormatter = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short" });
const currencyFormatter = new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" });

function centsToAmount(cents: number): number {
  return cents / 100;
}

// Cross-account movement table for /cuentas-bancarias/movimientos --
// includes a "Cuenta" column (unlike the single-account detail page's
// table) and the running balance already computed by
// bank-account-service.ts#listBankTransactionsForUser.
export function BankTransactionTable({ transactions }: { transactions: DecoratedBankTransaction[] }) {
  return (
    <Table className="min-w-[900px]">
      <TableHeader>
        <tr>
          <TableHead>Fecha</TableHead>
          <TableHead>Cuenta bancaria</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Descripción</TableHead>
          <TableHead className="text-right">Ingreso</TableHead>
          <TableHead className="text-right">Egreso</TableHead>
          <TableHead className="text-right">Saldo</TableHead>
        </tr>
      </TableHeader>
      <TableBody>
        {transactions.map((transaction) => {
          const isIncome = transaction.type === "INCOME";
          return (
            <TableRow key={transaction.id}>
              <TableCell className="text-muted-foreground">
                {dateFormatter.format(transaction.createdAt)}
              </TableCell>
              <TableCell>
                {transaction.bankAccount.bankName} · {transaction.bankAccount.alias}
              </TableCell>
              <TableCell className="text-muted-foreground">{isIncome ? "Ingreso" : "Egreso"}</TableCell>
              <TableCell className="text-muted-foreground">
                {transaction.description ??
                  (transaction.sale
                    ? `${transaction.sale.customer.fullName} · ${transaction.sale.product.name}`
                    : "—")}
              </TableCell>
              <TableCell className="text-right font-medium text-success">
                {isIncome ? currencyFormatter.format(Number(transaction.amount)) : "—"}
              </TableCell>
              <TableCell className="text-right font-medium text-error">
                {!isIncome ? currencyFormatter.format(Number(transaction.amount)) : "—"}
              </TableCell>
              <TableCell className="text-right font-semibold text-foreground">
                {currencyFormatter.format(centsToAmount(transaction.balanceAfterCents))}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
