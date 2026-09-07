import "server-only";
import { UserRole, BankTransactionType } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import type { PublicUser } from "@/lib/auth/session";
import { isValidUuid } from "@/lib/validation";
import * as bankAccountRepository from "@/server/repositories/bank-account-repository";
import type { BankAccountStatusFilter } from "@/server/repositories/bank-account-repository";

// All BankAccount permission logic lives here, not in pages/components/
// actions, mirroring product-service.ts. MODULE_ACCESS["cuentas-bancarias"]
// in rbac.ts already keeps SELLER out of this module entirely via
// requireModuleAccess (only ADMIN/ACCOUNTANT have page access -- see
// rbac.ts), but every function below re-checks actingUser.role again on
// its own, as defense in depth. Within the module, ADMIN has full CRUD and
// ACCOUNTANT is read-only -- rbac.ts's "all"/"scoped"/"none" table only
// gates page-level access, not this read/write distinction, so it's
// enforced here instead. Callers (Server Actions, pages) must still call
// requireModuleAccess("cuentas-bancarias") themselves first.
//
// This module intentionally leaves Payment/Pagos untouched -- Payment
// already has an optional bankAccountId (see schema.prisma), reserved for
// a later phase that lets a payment reference one of these accounts.

export type { BankAccountStatusFilter };

const READ_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.ACCOUNTANT];

function canRead(role: UserRole): boolean {
  return READ_ROLES.includes(role);
}

function str(value: FormDataEntryValue | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function isUniqueError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

function isForeignKeyRestrictionError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2003"
  );
}

export type BankAccountFieldErrors = Partial<
  Record<"bankName" | "alias" | "accountHolder" | "accountType" | "accountNumber" | "currency", string>
>;

export type BankAccountActionResult =
  | { ok: true; id: string }
  | { ok: false; errors?: BankAccountFieldErrors; formError?: string };

export type RawBankAccountInput = {
  bankName?: FormDataEntryValue | null;
  alias?: FormDataEntryValue | null;
  accountHolder?: FormDataEntryValue | null;
  accountType?: FormDataEntryValue | null;
  accountNumber?: FormDataEntryValue | null;
  currency?: FormDataEntryValue | null;
  instructions?: FormDataEntryValue | null;
  // Only read on update -- create always starts an account ACTIVE.
  active?: FormDataEntryValue | null;
};

/** ADMIN/ACCOUNTANT listing -- SELLER (and anyone else) gets an empty list (defense in depth; requireModuleAccess already keeps them off the page entirely). */
export function listBankAccountsForUser(
  actingUser: PublicUser,
  params: { search?: string; status?: BankAccountStatusFilter },
): Promise<bankAccountRepository.BankAccountListItem[]> {
  if (!canRead(actingUser.role)) {
    return Promise.resolve([]);
  }
  return bankAccountRepository.listBankAccounts(params);
}

export async function getBankAccountForUser(actingUser: PublicUser, id: string) {
  if (!canRead(actingUser.role) || !isValidUuid(id)) {
    return null;
  }
  return bankAccountRepository.findBankAccountById(id);
}

// ---------------------------------------------------------------------
// Movimientos: cross-account listing with filters, for the /cuentas-
// bancarias/movimientos page and the Excel export -- ADMIN/ACCOUNTANT only,
// mirroring canRead above.
// ---------------------------------------------------------------------

/** Mirrors payment-service.ts/sale-service.ts's own copy -- parses a "YYYY-MM-DD" <input type="date"> value as UTC midnight. */
function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** End of the UTC calendar day for `date` -- unlike Sale/Payment dates (stored as pure UTC-midnight calendar days), BankTransaction.createdAt is a real timestamp, so a "hasta" filter needs the day's last millisecond, not its first. */
function endOfUtcDay(date: Date): Date {
  return new Date(date.getTime() + 24 * 60 * 60 * 1000 - 1);
}

function toCents(amount: number | string | Prisma.Decimal): number {
  return Math.round(Number(amount) * 100);
}

function isValidBankTransactionType(value: string | undefined): value is BankTransactionType {
  return !!value && (Object.values(BankTransactionType) as string[]).includes(value);
}

export type BankTransactionFilters = {
  bankAccountId?: string;
  type?: string;
  dateFrom?: string;
  dateTo?: string;
};

export type DecoratedBankTransaction = bankAccountRepository.BankTransactionWithAccount & {
  balanceAfterCents: number;
};

/**
 * Lists BankTransaction rows across every account the user can see
 * (ADMIN/ACCOUNTANT only -- SELLER gets an empty list, mirroring
 * listBankAccountsForUser), decorated with `balanceAfterCents`: the
 * account's running balance immediately after this movement.
 *
 * The running balance is computed from that account's *entire* unfiltered
 * history (see listBankTransactionsForBalanceCalc) before `type`/date
 * filters are applied -- BankAccount.balance is only ever built up by
 * these same transactions (see schema.prisma), so replaying them in order
 * from zero reproduces the real balance at every point in time. Filtering
 * first and only then summing would silently produce a wrong running
 * balance for any account with a movement outside the selected window.
 */
export async function listBankTransactionsForUser(
  actingUser: PublicUser,
  filters: BankTransactionFilters,
): Promise<DecoratedBankTransaction[]> {
  if (!canRead(actingUser.role)) {
    return [];
  }

  const bankAccountId =
    filters.bankAccountId && isValidUuid(filters.bankAccountId) ? filters.bankAccountId : undefined;

  const all = await bankAccountRepository.listBankTransactionsForBalanceCalc(bankAccountId);

  const runningByAccount = new Map<string, number>();
  const decorated: DecoratedBankTransaction[] = all.map((transaction) => {
    const previous = runningByAccount.get(transaction.bankAccountId) ?? 0;
    const delta = toCents(transaction.amount) * (transaction.type === "INCOME" ? 1 : -1);
    const next = previous + delta;
    runningByAccount.set(transaction.bankAccountId, next);
    return { ...transaction, balanceAfterCents: next };
  });

  const type = isValidBankTransactionType(filters.type) ? filters.type : undefined;
  const dateFrom = filters.dateFrom ? (parseDateOnly(filters.dateFrom) ?? undefined) : undefined;
  const dateToRaw = filters.dateTo ? (parseDateOnly(filters.dateTo) ?? undefined) : undefined;
  const dateTo = dateToRaw ? endOfUtcDay(dateToRaw) : undefined;

  const filtered = decorated.filter((transaction) => {
    if (type && transaction.type !== type) return false;
    if (dateFrom && transaction.createdAt.getTime() < dateFrom.getTime()) return false;
    if (dateTo && transaction.createdAt.getTime() > dateTo.getTime()) return false;
    return true;
  });

  return filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/** Every bank account, for the "cuenta bancaria" filter selector -- ADMIN/ACCOUNTANT only, mirroring canRead above. */
export function listBankAccountsForFilterForUser(
  actingUser: PublicUser,
): Promise<bankAccountRepository.BankAccountFilterOption[]> {
  if (!canRead(actingUser.role)) {
    return Promise.resolve([]);
  }
  return bankAccountRepository.listBankAccountsForFilter();
}

function validateFields(raw: RawBankAccountInput) {
  const bankName = str(raw.bankName);
  const alias = str(raw.alias);
  const accountHolder = str(raw.accountHolder);
  const accountType = str(raw.accountType);
  const accountNumber = str(raw.accountNumber);
  const currency = str(raw.currency) || "USD";
  const instructions = str(raw.instructions);

  const errors: BankAccountFieldErrors = {};
  if (!bankName) errors.bankName = "El banco es obligatorio.";
  if (!alias) errors.alias = "El alias de la cuenta es obligatorio.";
  if (!accountHolder) errors.accountHolder = "El titular es obligatorio.";
  if (!accountType) errors.accountType = "El tipo de cuenta es obligatorio.";
  if (!accountNumber) errors.accountNumber = "El número de cuenta es obligatorio.";
  if (!currency) errors.currency = "La moneda es obligatoria.";

  return { bankName, alias, accountHolder, accountType, accountNumber, currency, instructions, errors };
}

export async function createBankAccountForAdmin(
  actingUser: PublicUser,
  raw: RawBankAccountInput,
): Promise<BankAccountActionResult> {
  if (actingUser.role !== UserRole.ADMIN) {
    return { ok: false, formError: "No tienes permiso para crear cuentas bancarias." };
  }

  const { bankName, alias, accountHolder, accountType, accountNumber, currency, instructions, errors } =
    validateFields(raw);
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  try {
    const account = await bankAccountRepository.createBankAccount({
      bankName,
      alias,
      accountHolder,
      accountType,
      accountNumber,
      currency,
      instructions: instructions || null,
      active: true,
    });
    return { ok: true, id: account.id };
  } catch (error) {
    if (isUniqueError(error)) {
      return { ok: false, formError: "Ya existe una cuenta bancaria con esos datos." };
    }
    console.error("[bank-accounts] Failed to create bank account:", error);
    return { ok: false, formError: "No se pudo crear la cuenta bancaria. Intenta nuevamente." };
  }
}

/**
 * Updates a bank account's data -- ADMIN only. Never touches Payment: a
 * Payment.bankAccountId (once used) is just a reference, so changing this
 * account's data never rewrites historical payments.
 */
export async function updateBankAccountForAdmin(
  actingUser: PublicUser,
  id: string,
  raw: RawBankAccountInput,
): Promise<BankAccountActionResult> {
  if (actingUser.role !== UserRole.ADMIN) {
    return { ok: false, formError: "No tienes permiso para editar cuentas bancarias." };
  }
  if (!isValidUuid(id)) {
    return { ok: false, formError: "La cuenta bancaria indicada no es válida." };
  }

  const existing = await bankAccountRepository.findBankAccountById(id);
  if (!existing) {
    return { ok: false, formError: "La cuenta bancaria indicada no existe." };
  }

  const { bankName, alias, accountHolder, accountType, accountNumber, currency, instructions, errors } =
    validateFields(raw);
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const active = str(raw.active) !== "false";

  try {
    await bankAccountRepository.updateBankAccount(id, {
      bankName,
      alias,
      accountHolder,
      accountType,
      accountNumber,
      currency,
      instructions: instructions || null,
      active,
    });
    return { ok: true, id };
  } catch (error) {
    if (isUniqueError(error)) {
      return { ok: false, formError: "Ya existe una cuenta bancaria con esos datos." };
    }
    console.error("[bank-accounts] Failed to update bank account:", error);
    return { ok: false, formError: "No se pudo actualizar la cuenta bancaria. Intenta nuevamente." };
  }
}

export type ToggleBankAccountStatusResult = { ok: true } | { ok: false; formError: string };

/** Quick activar/desactivar from the listing table -- ADMIN only. An INACTIVE account simply stops appearing in future payment operations; past payments referencing it are untouched. */
export async function toggleBankAccountStatusForAdmin(
  actingUser: PublicUser,
  id: string,
): Promise<ToggleBankAccountStatusResult> {
  if (actingUser.role !== UserRole.ADMIN) {
    return { ok: false, formError: "No tienes permiso para administrar cuentas bancarias." };
  }
  if (!isValidUuid(id)) {
    return { ok: false, formError: "La cuenta bancaria indicada no es válida." };
  }

  const existing = await bankAccountRepository.findBankAccountById(id);
  if (!existing) {
    return { ok: false, formError: "La cuenta bancaria indicada no existe." };
  }

  await bankAccountRepository.setBankAccountActive(id, !existing.active);
  return { ok: true };
}

export type BankAccountDeletionResult =
  | { ok: true }
  | { ok: false; formError: string; hasPayments?: boolean };

const HAS_PAYMENTS_ERROR =
  "Esta cuenta bancaria tiene pagos asociados y no se puede eliminar. Desactívala en su lugar.";

/**
 * Deletes a bank account -- ADMIN only. Refuses when the account has any
 * Payment attached (never touches those payments or anything derived from
 * them); `hasPayments: true` lets the UI offer "desactivar" instead,
 * mirroring deleteProductForAdmin. The FK-restriction catch is defense in
 * depth against a payment being created in the window between the count
 * check and the delete.
 */
export async function deleteBankAccountForAdmin(
  actingUser: PublicUser,
  id: string,
): Promise<BankAccountDeletionResult> {
  if (actingUser.role !== UserRole.ADMIN) {
    return { ok: false, formError: "No tienes permiso para eliminar cuentas bancarias." };
  }
  if (!isValidUuid(id)) {
    return { ok: false, formError: "La cuenta bancaria indicada no es válida." };
  }

  const existing = await bankAccountRepository.findBankAccountById(id);
  if (!existing) {
    return { ok: false, formError: "La cuenta bancaria indicada no existe." };
  }

  const paymentsCount = await bankAccountRepository.countBankAccountPayments(id);
  if (paymentsCount > 0) {
    return { ok: false, formError: HAS_PAYMENTS_ERROR, hasPayments: true };
  }

  try {
    await bankAccountRepository.deleteBankAccount(id);
  } catch (error) {
    if (isForeignKeyRestrictionError(error)) {
      return { ok: false, formError: HAS_PAYMENTS_ERROR, hasPayments: true };
    }
    console.error("[bank-accounts] Failed to delete bank account:", error);
    return { ok: false, formError: "No se pudo eliminar la cuenta bancaria. Intenta nuevamente." };
  }

  return { ok: true };
}
