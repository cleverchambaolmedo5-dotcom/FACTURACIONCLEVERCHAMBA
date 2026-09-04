import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type {
  InstallmentStatus,
  PaymentMethod,
  PaymentValidationStatus,
} from "@/generated/prisma/enums";

// Pure data access for Installment/Payment. No auth/RBAC awareness lives
// here -- callers (src/server/services/payment-service.ts) decide *which*
// records a given user is allowed to see or touch, and own every financial
// calculation (totals, balances, status transitions). This file only reads
// and writes rows.

// Every read/write here accepts an optional Prisma client so the same
// functions work outside a transaction (plain `prisma`) and inside one
// (the `tx` handed to a `$transaction` callback) -- see runSerializable
// below, used by payment-service.ts#registerPaymentForUser.
type Db = Prisma.TransactionClient | typeof prisma;

const installmentListInclude = {
  sale: {
    select: {
      id: true,
      sellerId: true,
      customer: { select: { id: true, fullName: true } },
      product: { select: { id: true, name: true } },
      seller: { select: { id: true, name: true } },
    },
  },
  payments: { select: { amount: true, validationStatus: true } },
} as const;

export type InstallmentListRow = Awaited<ReturnType<typeof listInstallments>>[number];

export async function listInstallments(params: {
  sellerId?: string;
  productId?: string;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
}) {
  const search = params.search?.trim();

  return prisma.installment.findMany({
    where: {
      sale: {
        ...(params.sellerId ? { sellerId: params.sellerId } : {}),
        ...(params.productId ? { productId: params.productId } : {}),
        ...(search
          ? {
              OR: [
                { customer: { fullName: { contains: search, mode: "insensitive" as const } } },
                { product: { name: { contains: search, mode: "insensitive" as const } } },
              ],
            }
          : {}),
      },
      ...(params.dateFrom || params.dateTo
        ? {
            dueDate: {
              ...(params.dateFrom ? { gte: params.dateFrom } : {}),
              ...(params.dateTo ? { lte: params.dateTo } : {}),
            },
          }
        : {}),
    },
    include: installmentListInclude,
    orderBy: [{ dueDate: "asc" }],
  });
}

const installmentDetailInclude = {
  sale: {
    select: {
      id: true,
      sellerId: true,
      customer: { select: { id: true, fullName: true } },
      product: { select: { id: true, name: true } },
      seller: { select: { id: true, name: true } },
    },
  },
  payments: {
    orderBy: { paymentDate: "desc" as const },
    include: {
      registeredBy: { select: { id: true, name: true } },
      validatedBy: { select: { id: true, name: true } },
      receipt: true,
    },
  },
} as const;

export type InstallmentDetail = Awaited<ReturnType<typeof findInstallmentById>>;

export async function findInstallmentById(id: string, db: Db = prisma) {
  return db.installment.findUnique({
    where: { id },
    include: installmentDetailInclude,
  });
}

export type CreatePaymentData = {
  installmentId: string;
  amount: string;
  paymentDate: Date;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
  registeredById: string;
};

export async function createPayment(db: Db, data: CreatePaymentData) {
  return db.payment.create({
    data: {
      installmentId: data.installmentId,
      amount: data.amount,
      paymentDate: data.paymentDate,
      method: data.method,
      reference: data.reference,
      notes: data.notes,
      registeredById: data.registeredById,
    },
  });
}

export type CreatePaymentReceiptData = {
  paymentId: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  uploadedById: string;
};

export async function createPaymentReceipt(db: Db, data: CreatePaymentReceiptData) {
  return db.paymentReceipt.create({ data });
}

export async function updateInstallmentStatus(db: Db, id: string, status: InstallmentStatus) {
  return db.installment.update({ where: { id }, data: { status } });
}

const paymentDetailInclude = {
  installment: {
    include: {
      sale: {
        select: {
          id: true,
          sellerId: true,
          // Needed by payment-service.ts#approvePaymentForUser to know
          // which BankAccount (if any) to credit once this payment is
          // approved -- null for sales created before that field existed.
          bankAccountId: true,
          customer: { select: { id: true, fullName: true } },
          product: { select: { id: true, name: true } },
          seller: { select: { id: true, name: true } },
        },
      },
      payments: { select: { id: true, amount: true, validationStatus: true } },
    },
  },
  registeredBy: { select: { id: true, name: true } },
  validatedBy: { select: { id: true, name: true } },
  receipt: true,
} as const;

export type PaymentDetail = Awaited<ReturnType<typeof findPaymentById>>;

export async function findPaymentById(id: string, db: Db = prisma) {
  return db.payment.findUnique({
    where: { id },
    include: paymentDetailInclude,
  });
}

const paymentListInclude = {
  installment: {
    select: {
      id: true,
      installmentNumber: true,
      amount: true,
      sale: {
        select: {
          id: true,
          sellerId: true,
          customer: { select: { id: true, fullName: true } },
          product: { select: { id: true, name: true } },
          seller: { select: { id: true, name: true } },
        },
      },
    },
  },
  registeredBy: { select: { id: true, name: true } },
  receipt: { select: { id: true, fileUrl: true } },
} as const;

export type PaymentListRow = Awaited<ReturnType<typeof listPayments>>[number];

/**
 * Lists individual Payment rows (not installments) for the Comprobantes
 * validation panel -- ADMIN/ACCOUNTANT only (enforced by the caller's
 * requireModuleAccess("comprobantes") check, `sellerId` is only ever
 * passed for defense in depth).
 */
export async function listPayments(params: {
  sellerId?: string;
  status?: PaymentValidationStatus;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
}) {
  const search = params.search?.trim();

  return prisma.payment.findMany({
    where: {
      ...(params.status ? { validationStatus: params.status } : {}),
      installment: {
        sale: {
          ...(params.sellerId ? { sellerId: params.sellerId } : {}),
          ...(search
            ? {
                OR: [
                  { customer: { fullName: { contains: search, mode: "insensitive" as const } } },
                  { product: { name: { contains: search, mode: "insensitive" as const } } },
                ],
              }
            : {}),
        },
      },
      ...(params.dateFrom || params.dateTo
        ? {
            paymentDate: {
              ...(params.dateFrom ? { gte: params.dateFrom } : {}),
              ...(params.dateTo ? { lte: params.dateTo } : {}),
            },
          }
        : {}),
    },
    include: paymentListInclude,
    orderBy: [{ createdAt: "desc" }],
  });
}

export type ApprovePaymentData = {
  paymentId: string;
  validatedById: string;
};

export async function approvePayment(db: Db, data: ApprovePaymentData) {
  return db.payment.update({
    where: { id: data.paymentId },
    data: {
      validationStatus: "APPROVED",
      validatedById: data.validatedById,
      validatedAt: new Date(),
    },
  });
}

export type RejectPaymentData = {
  paymentId: string;
  validatedById: string;
  rejectionReason: string;
};

export async function rejectPayment(db: Db, data: RejectPaymentData) {
  return db.payment.update({
    where: { id: data.paymentId },
    data: {
      validationStatus: "REJECTED",
      validatedById: data.validatedById,
      validatedAt: new Date(),
      rejectionReason: data.rejectionReason,
    },
  });
}

/**
 * Runs `fn` inside a Prisma transaction using SERIALIZABLE isolation, so
 * two concurrent payment registrations against the same installment can
 * never both read the same "balance so far" and jointly overpay it --
 * PostgreSQL aborts the losing transaction with a serialization failure
 * instead. Callers retry on that failure (see payment-service.ts).
 */
export async function runSerializable<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(fn, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
}
