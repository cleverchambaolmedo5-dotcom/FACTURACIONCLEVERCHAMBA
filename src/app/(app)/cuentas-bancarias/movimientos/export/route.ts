import { requireModuleAccess } from "@/lib/auth/guards";
import { listBankTransactionsForUser } from "@/server/services/bank-account-service";
import type { DecoratedBankTransaction } from "@/server/services/bank-account-service";
import { buildXlsxFile, xlsxResponse, exportTimestamp } from "@/server/services/excel-export";

// requireModuleAccess("cuentas-bancarias") gates this exactly like the
// module's pages (ADMIN/ACCOUNTANT only, see rbac.ts) -- a Route Handler
// can be requested directly regardless of which page linked to it, so this
// re-check is authoritative, not just defense in depth. The underlying
// listBankTransactionsForUser also re-checks the role on its own.
export async function GET(request: Request) {
  const user = await requireModuleAccess("cuentas-bancarias");

  const { searchParams } = new URL(request.url);
  const transactions = await listBankTransactionsForUser(user, {
    bankAccountId: searchParams.get("bankAccountId") ?? undefined,
    type: searchParams.get("type") ?? undefined,
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
  });

  const buffer = await buildXlsxFile<DecoratedBankTransaction>(
    "Movimientos",
    [
      {
        header: "Fecha",
        width: 20,
        value: (row) => row.createdAt,
        numFmt: "dd/mm/yyyy hh:mm",
      },
      {
        header: "Cuenta bancaria",
        width: 28,
        value: (row) => `${row.bankAccount.bankName} - ${row.bankAccount.alias}`,
      },
      {
        header: "Tipo de movimiento",
        width: 16,
        value: (row) => (row.type === "INCOME" ? "Ingreso" : "Egreso"),
      },
      {
        header: "Descripción",
        width: 40,
        value: (row) =>
          row.description ??
          (row.sale ? `${row.sale.customer.fullName} - ${row.sale.product.name}` : "-"),
      },
      {
        header: "Monto ingreso",
        width: 16,
        numFmt: "#,##0.00",
        value: (row) => (row.type === "INCOME" ? Number(row.amount) : 0),
      },
      {
        header: "Monto egreso",
        width: 16,
        numFmt: "#,##0.00",
        value: (row) => (row.type === "EXPENSE" ? Number(row.amount) : 0),
      },
      {
        header: "Saldo",
        width: 16,
        numFmt: "#,##0.00",
        value: (row) => row.balanceAfterCents / 100,
      },
    ],
    transactions,
  );

  return xlsxResponse(buffer, `movimientos-bancarios-${exportTimestamp()}.xlsx`);
}
