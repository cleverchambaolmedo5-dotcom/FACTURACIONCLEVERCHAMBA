import "server-only";
import { prisma } from "@/lib/prisma";
import type { PaymentMethod, SaleStatus } from "@/generated/prisma/enums";
import * as paymentRepository from "@/server/repositories/payment-repository";

// Pure data access for Sale/Installment/Product (read side used by the
// sales form). No auth/RBAC awareness lives here -- callers
// (src/server/services/sale-service.ts) decide *which* records a given
// user is allowed to see or touch and pass that down as plain query
// params (e.g. `sellerId`).

const saleListSelect = {
  id: true,
  saleDate: true,
  finalPrice: true,
  status: true,
  customer: { select: { id: true, fullName: true } },
  product: { select: { id: true, name: true } },
  seller: { select: { id: true, name: true } },
  // `amount`/`dueDate`/`payments` (not just `id`) so sale-service.ts's
  // listSalesForUser can decorate each row with real paid/pending totals
  // and identify the next cuota with a balance -- via
  // payment-service.ts#computeInstallmentTotals, the same math the sale
  // detail page and Cuotas module already use. Ordered by installmentNumber
  // so "próxima cuota" is always the first one with a balance, in cuota
  // order.
  installments: {
    orderBy: { installmentNumber: "asc" as const },
    select: {
      id: true,
      installmentNumber: true,
      amount: true,
      dueDate: true,
      payments: { select: { amount: true, validationStatus: true } },
    },
  },
  // Absent for sales created before this field existed -- see
  // Sale.bankAccountId in schema.prisma.
  bankAccount: { select: { id: true, bankName: true, alias: true } },
} as const;

export type SaleListItem = Awaited<ReturnType<typeof listSales>>[number];

export async function listSales(params: {
  sellerId?: string;
  search?: string;
  productId?: string;
  status?: SaleStatus;
  dateFrom?: Date;
  dateTo?: Date;
}) {
  const search = params.search?.trim();

  return prisma.sale.findMany({
    where: {
      ...(params.sellerId ? { sellerId: params.sellerId } : {}),
      ...(params.productId ? { productId: params.productId } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.dateFrom || params.dateTo
        ? {
            saleDate: {
              ...(params.dateFrom ? { gte: params.dateFrom } : {}),
              ...(params.dateTo ? { lte: params.dateTo } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { customer: { fullName: { contains: search, mode: "insensitive" as const } } },
              { product: { name: { contains: search, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    },
    select: saleListSelect,
    orderBy: { saleDate: "desc" },
  });
}

const saleExportSelect = {
  id: true,
  saleDate: true,
  finalPrice: true,
  status: true,
  customer: { select: { id: true, fullName: true } },
  product: { select: { id: true, name: true } },
  seller: { select: { id: true, name: true } },
  // `payments` (not just `id`) so sale-service.ts#listSalesForExportForUser
  // can compute "Total pagado"/"Saldo pendiente" from APPROVED payments
  // only, reusing payment-service.ts#sumApprovedCents -- mirrors
  // saleDetailInclude.installments below.
  installments: { select: { payments: { select: { amount: true, validationStatus: true } } } },
} as const;

export type SaleExportRow = Awaited<ReturnType<typeof listSalesForExport>>[number];

/** Same filters/scoping as listSales, but with each installment's payments included for the Ventas Excel export -- kept separate from listSales so the plain Ventas listing query never pays for that extra join. */
export async function listSalesForExport(params: {
  sellerId?: string;
  search?: string;
  productId?: string;
  status?: SaleStatus;
  dateFrom?: Date;
  dateTo?: Date;
}) {
  const search = params.search?.trim();

  return prisma.sale.findMany({
    where: {
      ...(params.sellerId ? { sellerId: params.sellerId } : {}),
      ...(params.productId ? { productId: params.productId } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.dateFrom || params.dateTo
        ? {
            saleDate: {
              ...(params.dateFrom ? { gte: params.dateFrom } : {}),
              ...(params.dateTo ? { lte: params.dateTo } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { customer: { fullName: { contains: search, mode: "insensitive" as const } } },
              { product: { name: { contains: search, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    },
    select: saleExportSelect,
    orderBy: { saleDate: "desc" },
  });
}

const saleDetailInclude = {
  customer: { select: { id: true, fullName: true } },
  product: { select: { id: true, name: true } },
  seller: { select: { id: true, name: true } },
  // Absent for sales created before this field existed -- the detail page
  // must handle a null bankAccount, mirroring the null receipt case below.
  bankAccount: { select: { id: true, bankName: true, alias: true, accountNumber: true } },
  installments: {
    orderBy: { installmentNumber: "asc" as const },
    // Full payment rows (not just amount/validationStatus) so the sale
    // detail page can show each installment's approved paid total/pending
    // total/saldo/estado (via
    // src/server/services/payment-service.ts#computeInstallmentTotals) and
    // also list every individual Payment underneath its cuota (forma de
    // pago, cuenta, voucher, fecha real, registrado por) -- a cuota paid
    // through several payments must show each one separately, never
    // collapsed into a single row.
    include: {
      payments: {
        orderBy: { paymentDate: "desc" as const },
        include: {
          bankAccount: { select: { id: true, bankName: true, alias: true } },
          registeredBy: { select: { id: true, name: true } },
          receipt: { select: { fileUrl: true } },
        },
      },
    },
  },
  // Absent for sales created before the receipt requirement existed --
  // the detail page must handle a null receipt.
  receipt: { select: { fileUrl: true, fileName: true, fileType: true, createdAt: true } },
} as const;

export type SaleDetail = Awaited<ReturnType<typeof findSaleById>>;

export async function findSaleById(id: string) {
  return prisma.sale.findUnique({
    where: { id },
    include: saleDetailInclude,
  });
}

export type CreateSaleInstallmentData = {
  installmentNumber: number;
  amount: string;
  dueDate: Date;
};

export type CreateSaleReceiptData = {
  fileUrl: string;
  fileName: string;
  fileType: string;
  uploadedById: string;
};

// Optional Payment (+ PaymentReceipt, when the method requires a voucher)
// created against one specific installment in the same transaction as the
// sale, when the customer already paid that cuota at the moment the sale is
// registered -- see sale-service.ts#createSaleForUser's per-cuota "forma de
// pago" handling. Mirrors RawPaymentInput/CreatePaymentData in
// payment-service.ts/payment-repository.ts exactly, since this produces the
// exact same kind of row (PENDING_VALIDATION, awaiting Contabilidad's
// approval in Comprobantes) -- just created eagerly instead of through the
// separate "Pagar" flow. One of these can be provided per installment
// (never more than one, and never for an installment that doesn't exist on
// this sale).
export type CreateSaleInstallmentPaymentData = {
  installmentNumber: number;
  amount: string;
  paymentDate: Date;
  method: PaymentMethod;
  notes?: string;
  // Only set for method = CASH ("Entregado a") -- see Payment.receivedByName.
  receivedByName?: string;
  // Only set for method = BANK_TRANSFER/DEPOSIT/CARD -- see
  // Payment.bankAccountId. Each payment row keeps its own account rather
  // than sharing one sale-wide value, since a sale's cuotas (or several
  // payments within one cuota) can each land in a different bank account;
  // for CARD, sale-service.ts always resolves this to the one fixed
  // CARD-payment account, never a seller choice.
  bankAccountId?: string;
  registeredById: string;
  // Absent for method = CASH (no voucher collected for cash payments).
  receipt?: CreateSaleReceiptData;
};

export type CreateSaleData = {
  customerId: string;
  sellerId: string;
  productId: string;
  saleDate: Date;
  originalPrice: string;
  discount: string;
  finalPrice: string;
  installments: CreateSaleInstallmentData[];
  // Optional -- the "Nueva venta" flow no longer requires a general
  // receipt (each installment's own payment record backs the sale
  // instead); see the validation in sale-service.ts#createSaleForUser.
  receipt?: CreateSaleReceiptData;
  // One entry per installment that already had a "forma de pago" selected
  // at sale creation time -- see CreateSaleInstallmentPaymentData above.
  // Never more entries than `installments`, and always empty for a sale
  // where no cuota was marked as already paid.
  installmentPayments?: CreateSaleInstallmentPaymentData[];
};

/**
 * Creates a Sale together with all of its Installments (and its
 * SaleReceipt, only when one is provided) in a single transaction: it must
 * never be possible to end up with a Sale that has no installments (or
 * installments without a Sale), or a partially-created receipt, due to a
 * partial failure. When `installmentPayments` entries are present, the
 * Payment (+ PaymentReceipt, when the method requires a voucher) for each
 * of those specific installments is created in this same transaction, so a
 * sale can never end up "missing" a cuota payment its own creation reported
 * succeeding.
 */
export async function createSaleWithInstallments(data: CreateSaleData) {
  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.create({
      data: {
        customerId: data.customerId,
        sellerId: data.sellerId,
        productId: data.productId,
        saleDate: data.saleDate,
        originalPrice: data.originalPrice,
        discount: data.discount,
        finalPrice: data.finalPrice,
        installments: {
          create: data.installments.map((installment) => ({
            installmentNumber: installment.installmentNumber,
            amount: installment.amount,
            dueDate: installment.dueDate,
          })),
        },
        ...(data.receipt
          ? {
              receipt: {
                create: {
                  fileUrl: data.receipt.fileUrl,
                  fileName: data.receipt.fileName,
                  fileType: data.receipt.fileType,
                  uploadedById: data.receipt.uploadedById,
                },
              },
            }
          : {}),
      },
      select: { id: true, installments: { select: { id: true, installmentNumber: true } } },
    });

    for (const installmentPayment of data.installmentPayments ?? []) {
      const targetInstallment = sale.installments.find(
        (i) => i.installmentNumber === installmentPayment.installmentNumber,
      );
      if (!targetInstallment) continue;

      const payment = await paymentRepository.createPayment(tx, {
        installmentId: targetInstallment.id,
        bankAccountId: installmentPayment.bankAccountId,
        amount: installmentPayment.amount,
        paymentDate: installmentPayment.paymentDate,
        method: installmentPayment.method,
        notes: installmentPayment.notes,
        receivedByName: installmentPayment.receivedByName,
        registeredById: installmentPayment.registeredById,
      });
      if (installmentPayment.receipt) {
        await paymentRepository.createPaymentReceipt(tx, {
          paymentId: payment.id,
          fileUrl: installmentPayment.receipt.fileUrl,
          fileName: installmentPayment.receipt.fileName,
          fileType: installmentPayment.receipt.fileType,
          uploadedById: installmentPayment.receipt.uploadedById,
        });
      }
    }

    return { id: sale.id };
  });
}

/** Active products only, for the "producto" selector in the sale form. */
export async function listActiveProducts() {
  return prisma.product.findMany({
    where: { active: true },
    select: { id: true, name: true, officialPrice: true },
    orderBy: { name: "asc" },
  });
}

/** Looks up a product, but only returns it if it's currently active. */
export async function findActiveProductById(id: string) {
  return prisma.product.findFirst({
    where: { id, active: true },
    select: { id: true, name: true, officialPrice: true },
  });
}
