import { BankTransactionType } from "@/generated/prisma/enums";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const TYPE_LABELS: Record<BankTransactionType, string> = {
  INCOME: "Ingreso",
  EXPENSE: "Egreso",
};

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
        <Select
          id="bankAccountId"
          name="bankAccountId"
          label="Cuenta bancaria"
          defaultValue={defaultBankAccountId ?? ""}
          wrapperClassName="w-auto"
        >
          <option value="">Todas</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.bankName} · {account.alias}
              {!account.active ? " (inactiva)" : ""}
            </option>
          ))}
        </Select>
      )}

      <Select id="type" name="type" label="Tipo de movimiento" defaultValue={defaultType ?? ""} wrapperClassName="w-auto">
        <option value="">Todos</option>
        {Object.entries(TYPE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>

      <Input
        id="dateFrom"
        type="date"
        name="dateFrom"
        label="Desde"
        defaultValue={defaultDateFrom ?? ""}
        wrapperClassName="w-auto"
      />

      <Input
        id="dateTo"
        type="date"
        name="dateTo"
        label="Hasta"
        defaultValue={defaultDateTo ?? ""}
        wrapperClassName="w-auto"
      />

      <Button type="submit">Filtrar</Button>
    </div>
  );
}
