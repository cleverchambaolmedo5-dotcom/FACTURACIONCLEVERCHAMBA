import "server-only";
import { prisma } from "@/lib/prisma";
import type { SaleStatus } from "@/generated/prisma/enums";

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
  installments: { select: { id: true } },
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

const saleDetailInclude = {
  customer: { select: { id: true, fullName: true } },
  product: { select: { id: true, name: true } },
  seller: { select: { id: true, name: true } },
  // Absent for sales created before this field existed -- the detail page
  // must handle a null bankAccount, mirroring the null receipt case below.
  bankAccount: { select: { id: true, bankName: true, alias: true, accountNumber: true } },
  installments: {
    orderBy: { installmentNumber: "asc" as const },
    // `amount`/`validationStatus` (not just `id`) are included so the sale
    // detail page can show each installment's approved paid total/pending
    // total/saldo/estado -- see
    // src/server/services/payment-service.ts#computeInstallmentTotals.
    include: { payments: { select: { id: true, amount: true, validationStatus: true } } },
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

export type CreateSaleData = {
  customerId: string;
  sellerId: string;
  productId: string;
  // The bank account selected as this sale's payment destination. Required
  // by application logic (sale-service.ts#createSaleForUser) for every new
  // sale -- optional here only so the column itself doesn't force the
  // relation beyond what that validation already guarantees.
  bankAccountId: string;
  saleDate: Date;
  originalPrice: string;
  discount: string;
  finalPrice: string;
  installments: CreateSaleInstallmentData[];
  // Required -- see sale-service.ts#createSaleForUser, which never reaches
  // this call without an already-saved receipt file.
  receipt: CreateSaleReceiptData;
};

/**
 * Creates a Sale together with all of its Installments and its
 * SaleReceipt in a single transaction: it must never be possible to end up
 * with a Sale that has no installments (or installments without a Sale),
 * or a Sale with no receipt, due to a partial failure.
 */
export async function createSaleWithInstallments(data: CreateSaleData) {
  return prisma.$transaction(async (tx) => {
    return tx.sale.create({
      data: {
        customerId: data.customerId,
        sellerId: data.sellerId,
        productId: data.productId,
        bankAccountId: data.bankAccountId,
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
        receipt: {
          create: {
            fileUrl: data.receipt.fileUrl,
            fileName: data.receipt.fileName,
            fileType: data.receipt.fileType,
            uploadedById: data.receipt.uploadedById,
          },
        },
      },
      select: { id: true },
    });
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
