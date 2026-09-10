import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { BankTransactionType } from "@/generated/prisma/enums";

// Pure data access for BankAccount (the /cuentas-bancarias module). No
// auth/RBAC awareness lives here -- src/server/services/bank-account-service.ts
// decides who's allowed to see or touch these records, mirroring
// product-repository.ts.

// Every read/write here accepts an optional Prisma client so the same
// functions work outside a transaction (plain `prisma`) and inside one
// (the `tx` handed to a `$transaction` callback) -- mirrors
// payment-repository.ts's Db type, used by
// src/server/services/payment-service.ts#approvePaymentForUser to credit a
// bank account atomically together with approving the payment.
type Db = Prisma.TransactionClient | typeof prisma;

const bankAccountListSelect = {
  id: true,
  bankName: true,
  alias: true,
  accountHolder: true,
  accountNumber: true,
  accountType: true,
  currency: true,
  active: true,
  balance: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { payments: true, transactions: true } },
} as const;

export type BankAccountListItem = Awaited<ReturnType<typeof listBankAccounts>>[number];

export type BankAccountStatusFilter = "all" | "active" | "inactive";

export async function listBankAccounts(params: { search?: string; status?: BankAccountStatusFilter }) {
  const search = params.search?.trim();
  const status = params.status ?? "all";

  return prisma.bankAccount.findMany({
    where: {
      ...(status === "active" ? { active: true } : {}),
      ...(status === "inactive" ? { active: false } : {}),
      ...(search
        ? {
            OR: [
              { bankName: { contains: search, mode: "insensitive" as const } },
              { alias: { contains: search, mode: "insensitive" as const } },
              { accountHolder: { contains: search, mode: "insensitive" as const } },
              { accountNumber: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    select: bankAccountListSelect,
    orderBy: { createdAt: "desc" },
  });
}

export async function findBankAccountById(id: string) {
  return prisma.bankAccount.findUnique({ where: { id } });
}

/** Active accounts only, for the "cuenta bancaria de destino" selector on the sale form -- mirrors sale-repository.listActiveProducts. */
export async function listActiveBankAccounts() {
  return prisma.bankAccount.findMany({
    where: { active: true },
    select: { id: true, bankName: true, alias: true, accountHolder: true, accountNumber: true },
    orderBy: { bankName: "asc" },
  });
}

/**
 * Looks up a bank account, but only returns it if it's currently active --
 * mirrors sale-repository.findActiveProductById. `accountNumber` is
 * included (not just id/bankName/alias) so callers that display this
 * account to a user (e.g. sale-service.ts's fixed CARD-payment account)
 * can mask it the same way the account selector does, without a second
 * query.
 */
export async function findActiveBankAccountById(id: string, db: Db = prisma) {
  return db.bankAccount.findFirst({
    where: { id, active: true },
    select: { id: true, bankName: true, alias: true, accountNumber: true },
  });
}

export type BankAccountWriteData = {
  bankName: string;
  alias: string;
  accountHolder: string;
  accountType: string;
  accountNumber: string;
  currency: string;
  instructions: string | null;
  active: boolean;
};

export async function createBankAccount(data: BankAccountWriteData) {
  return prisma.bankAccount.create({ data });
}

export async function updateBankAccount(id: string, data: BankAccountWriteData) {
  return prisma.bankAccount.update({ where: { id }, data });
}

export async function setBankAccountActive(id: string, active: boolean) {
  return prisma.bankAccount.update({ where: { id }, data: { active } });
}

/** Number of Payment rows referencing this account -- used to block deletion, never to touch those payments. */
export async function countBankAccountPayments(id: string) {
  return prisma.payment.count({ where: { bankAccountId: id } });
}

export async function deleteBankAccount(id: string) {
  await prisma.bankAccount.delete({ where: { id } });
}

/**
 * Finds the BankTransaction already tied to a payment, if any -- the
 * pre-check approvePaymentForUser uses to fail fast with a clear message
 * before ever attempting the (also enforced, unique-constraint-backed)
 * insert. Must run against the same `tx` as the rest of the approval, so a
 * concurrent approval of the same payment can't both pass this check.
 */
export async function findBankTransactionByPaymentId(paymentId: string, db: Db = prisma) {
  return db.bankTransaction.findUnique({ where: { paymentId } });
}

export type CreateBankTransactionData = {
  bankAccountId: string;
  saleId?: string;
  paymentId?: string;
  amount: string;
  type: BankTransactionType;
  description?: string;
};

/**
 * Records one bank movement. `paymentId` being `@unique` in the schema is
 * the authoritative guard against crediting the same payment twice -- this
 * insert fails with Prisma's P2002 if a transaction for that payment
 * already exists, even under a race the application-level pre-check
 * (findBankTransactionByPaymentId) alone couldn't fully rule out.
 */
export async function createBankTransaction(db: Db, data: CreateBankTransactionData) {
  return db.bankTransaction.create({
    data: {
      bankAccountId: data.bankAccountId,
      saleId: data.saleId,
      paymentId: data.paymentId,
      amount: data.amount,
      type: data.type,
      description: data.description,
    },
  });
}

/**
 * Atomically credits/debits a bank account's running balance. Must only
 * ever be called inside the same transaction that creates the matching
 * BankTransaction row (see approvePaymentForUser) -- never on its own,
 * so the balance and its audit trail can never drift apart.
 */
export async function incrementBankAccountBalance(db: Db, id: string, amount: string) {
  return db.bankAccount.update({
    where: { id },
    data: { balance: { increment: amount } },
  });
}

const bankTransactionWithAccountInclude = {
  bankAccount: { select: { id: true, bankName: true, alias: true } },
  sale: {
    select: {
      id: true,
      customer: { select: { id: true, fullName: true } },
      product: { select: { id: true, name: true } },
    },
  },
} as const;

export type BankTransactionWithAccount = Awaited<
  ReturnType<typeof listBankTransactionsForBalanceCalc>
>[number];

/**
 * Every BankTransaction for one account (or every account, when
 * `bankAccountId` is omitted), oldest first -- the input
 * bank-account-service.ts#listBankTransactionsForUser needs to compute a
 * running balance per account before applying any date/type filter. Never
 * filtered by date/type here: a filtered fetch would make the running
 * balance wrong for any transaction after the first excluded one.
 */
export async function listBankTransactionsForBalanceCalc(bankAccountId?: string) {
  return prisma.bankTransaction.findMany({
    where: bankAccountId ? { bankAccountId } : {},
    include: bankTransactionWithAccountInclude,
    orderBy: [{ bankAccountId: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });
}

export type BankAccountFilterOption = Awaited<ReturnType<typeof listBankAccountsForFilter>>[number];

/** Every bank account (active and inactive), for the "cuenta bancaria" filter selector -- an inactive account can still have historical movements worth filtering to. */
export async function listBankAccountsForFilter() {
  return prisma.bankAccount.findMany({
    select: { id: true, bankName: true, alias: true, active: true },
    orderBy: { bankName: "asc" },
  });
}
