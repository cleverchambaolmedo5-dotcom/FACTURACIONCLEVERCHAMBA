import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type {
  InstallmentStatus,
  PaymentMethod,
  PaymentValidationStatus,
  SaleStatus,
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
  // id/rejectionReason/validatedAt/createdAt beyond amount/validationStatus
  // are only read by payment-service.ts#findRejectedPaymentNeedingCorrection
  // (the seller-dashboard "requiere corrección" alert) -- every existing
  // consumer of this row (computeInstallmentTotals, sumApprovedCents, ...)
  // only ever destructures amount/validationStatus, so widening this select
  // is purely additive and changes no existing calculation.
  payments: {
    select: {
      id: true,
      amount: true,
      validationStatus: true,
      rejectionReason: true,
      validatedAt: true,
      createdAt: true,
    },
  },
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
      // The account this specific payment landed in (see
      // Payment.bankAccountId in schema.prisma) -- shown alongside the
      // voucher/método on the cuota detail page's payment history so a
      // mixed-method cuota (e.g. part cash, part transfer) shows each
      // payment's own account, never a single sale-wide one.
      bankAccount: { select: { id: true, bankName: true, alias: true } },
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
  // The bank account the customer paid into, as selected by whoever
  // registered this payment. payment-service.ts#registerPaymentForUser (the
  // manual "Registrar pago" flow) always passes one -- it's required there.
  // sale-repository.ts#createSaleWithInstallments (the per-cuota forma-de-
  // pago flow at sale creation) passes one too, for BANK_TRANSFER/DEPOSIT/
  // CARD rows (CARD always the one fixed account, see
  // sale-service.ts#getCardPaymentBankAccountForSaleForm) -- only CASH
  // payments never collect an account, and simply keep a null
  // bankAccountId, in which case approvePaymentForUser falls back to the
  // sale's own (legacy) bankAccountId, if any.
  bankAccountId?: string;
  amount: string;
  paymentDate: Date;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
  // Only meaningful for method = CASH ("Entregado a") -- see
  // Payment.receivedByName in schema.prisma. Optional here since the
  // manual "Registrar pago" flow (registerPaymentForUser) never collects
  // it, only the per-cuota forma-de-pago flow at sale creation does.
  receivedByName?: string;
  registeredById: string;
};

export async function createPayment(db: Db, data: CreatePaymentData) {
  return db.payment.create({
    data: {
      installmentId: data.installmentId,
      bankAccountId: data.bankAccountId,
      amount: data.amount,
      paymentDate: data.paymentDate,
      method: data.method,
      reference: data.reference,
      notes: data.notes,
      receivedByName: data.receivedByName,
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

export type SaleForStatusRecompute = Awaited<ReturnType<typeof findSaleForStatusRecompute>>;

/**
 * Everything payment-service.ts#recomputeSaleStatus needs to derive a
 * sale's status from its real payment ledger: the sale's own status/
 * finalPrice, plus every payment amount+validationStatus across all of its
 * installments (not just the one installment a given payment belongs to --
 * a sale's status reflects its whole ledger).
 */
export async function findSaleForStatusRecompute(saleId: string, db: Db = prisma) {
  return db.sale.findUnique({
    where: { id: saleId },
    select: {
      id: true,
      status: true,
      finalPrice: true,
      installments: { select: { payments: { select: { amount: true, validationStatus: true } } } },
    },
  });
}

export async function updateSaleStatus(db: Db, id: string, status: SaleStatus) {
  return db.sale.update({ where: { id }, data: { status } });
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
  // The account this specific payment landed in -- see the same field on
  // installmentDetailInclude.payments above; CASH payments simply have no
  // bankAccount (null).
  bankAccount: { select: { id: true, bankName: true, alias: true } },
  receipt: { select: { id: true, fileUrl: true } },
} as const;

export type PaymentListRow = Awaited<ReturnType<typeof listPayments>>[number];

/**
 * Lists individual Payment rows (not installments) -- shared by the Pagos
 * listing (every role, `sellerId` scoping SELLER to their own sales) and the
 * Comprobantes validation panel (ADMIN/ACCOUNTANT only, `sellerId` there
 * only for defense in depth). One row is always exactly one Payment, never
 * grouped by installment, so a cuota paid through several Payments (e.g.
 * part cash, part transfer) always surfaces as that many separate rows.
 */
export async function listPayments(params: {
  sellerId?: string;
  productId?: string;
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
