import { BankTransactionType } from "@/generated/prisma/enums";

const TYPE_LABELS: Record<BankTransactionType, string> = {
  INCOME: "Ingreso",
  EXPENSE: "Egreso",
};

const selectClass =
  "rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary";

// Renders only the filter controls, no <form> of its own -- meant to be
// rendered inside a shared GET form, mirroring PaymentValidationFilters/
// SaleFilters. `accounts` is omitted on the single-account detail page
// (the account is already fixed by the route), and passed on the
// cross-account /cuentas-bancarias/movimientos page.
export function BankTransactionFilters({
  accounts,
  defaultBankAccountId,
  defaultType,
  defaultDateFrom,
  defaultDateTo,
}: {
  accounts?: { id: string; bankName: string; alias: string; active: boolean }[];
  defaultBankAccountId?: string;
  defaultType?: string;
  defaultDateFrom?: string;
  defaultDateTo?: string;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      {accounts && (
        <div className="space-y-1">
          <label htmlFor="bankAccountId" className="text-xs font-medium text-muted-foreground">
            Cuenta bancaria
          </label>
          <select
            id="bankAccountId"
            name="bankAccountId"
            defaultValue={defaultBankAccountId ?? ""}
            className={selectClass}
          >
            <option value="">Todas</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.bankName} · {account.alias}
                {!account.active ? " (inactiva)" : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-1">
        <label htmlFor="type" className="text-xs font-medium text-muted-foreground">
          Tipo de movimiento
        </label>
        <select id="type" name="type" defaultValue={defaultType ?? ""} className={selectClass}>
          <option value="">Todos</option>
          {Object.entries(TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label htmlFor="dateFrom" className="text-xs font-medium text-muted-foreground">
          Desde
        </label>
        <input
          id="dateFrom"
          type="date"
          name="dateFrom"
          defaultValue={defaultDateFrom ?? ""}
          className={selectClass}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="dateTo" className="text-xs font-medium text-muted-foreground">
          Hasta
        </label>
        <input id="dateTo" type="date" name="dateTo" defaultValue={defaultDateTo ?? ""} className={selectClass} />
      </div>

      <button
        type="submit"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-dark"
      >
        Filtrar
      </button>
    </div>
  );
}
