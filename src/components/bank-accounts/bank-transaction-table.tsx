import type { DecoratedBankTransaction } from "@/server/services/bank-account-service";

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
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-4 py-3">Fecha</th>
              <th scope="col" className="px-4 py-3">Cuenta bancaria</th>
              <th scope="col" className="px-4 py-3">Tipo</th>
              <th scope="col" className="px-4 py-3">Descripción</th>
              <th scope="col" className="px-4 py-3 text-right">Ingreso</th>
              <th scope="col" className="px-4 py-3 text-right">Egreso</th>
              <th scope="col" className="px-4 py-3 text-right">Saldo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {transactions.map((transaction) => {
              const isIncome = transaction.type === "INCOME";
              return (
                <tr key={transaction.id} className="hover:bg-black/[0.02]">
                  <td className="px-4 py-3 text-muted-foreground">
                    {dateFormatter.format(transaction.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-foreground">
                    {transaction.bankAccount.bankName} · {transaction.bankAccount.alias}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{isIncome ? "Ingreso" : "Egreso"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {transaction.description ??
                      (transaction.sale
                        ? `${transaction.sale.customer.fullName} · ${transaction.sale.product.name}`
                        : "—")}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-success">
                    {isIncome ? currencyFormatter.format(Number(transaction.amount)) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-error">
                    {!isIncome ? currencyFormatter.format(Number(transaction.amount)) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground">
                    {currencyFormatter.format(centsToAmount(transaction.balanceAfterCents))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
