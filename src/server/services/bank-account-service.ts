import "server-only";
import { UserRole } from "@/generated/prisma/enums";
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

export type BankAccountDetailForUser = {
  account: NonNullable<Awaited<ReturnType<typeof bankAccountRepository.findBankAccountById>>>;
  transactions: bankAccountRepository.BankTransactionListItem[];
};

/**
 * Account data (including its current balance) together with its full
 * movement history, most recent first, for the /cuentas-bancarias/[id]
 * detail page -- ADMIN/ACCOUNTANT only, mirroring getBankAccountForUser.
 */
export async function getBankAccountDetailForUser(
  actingUser: PublicUser,
  id: string,
): Promise<BankAccountDetailForUser | null> {
  if (!canRead(actingUser.role) || !isValidUuid(id)) {
    return null;
  }

  const account = await bankAccountRepository.findBankAccountById(id);
  if (!account) {
    return null;
  }

  const transactions = await bankAccountRepository.listBankAccountTransactions(id);
  return { account, transactions };
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
