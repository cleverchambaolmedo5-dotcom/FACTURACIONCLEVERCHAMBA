import "server-only";
import { prisma } from "@/lib/prisma";
import type { InvestmentStatus } from "@/generated/prisma/enums";

// Pure data access for Investment. No auth/RBAC awareness lives here --
// callers (src/server/services/investment-service.ts) decide *which*
// records a given user is allowed to see or touch and pass that down as
// plain query params (e.g. `sellerId`).
//
// Financial fields (principalAmount, annualRate) are deliberately absent
// from every "ForSeller"/"SellerView" select below -- this is the DTO-level
// restriction the module's security rules require for SELLER: the database
// itself never returns those columns for these queries, rather than
// fetching them and hiding them in the UI layer.

const investmentListSelect = {
  id: true,
  principalAmount: true,
  annualRate: true,
  startDate: true,
  firstReturnDate: true,
  maturityDate: true,
  status: true,
  customer: { select: { id: true, fullName: true } },
  seller: { select: { id: true, name: true } },
} as const;

export type InvestmentListItem = Awaited<ReturnType<typeof listInvestments>>[number];

export async function listInvestments(params: {
  search?: string;
  status?: InvestmentStatus;
  dateFrom?: Date;
  dateTo?: Date;
}) {
  const search = params.search?.trim();

  return prisma.investment.findMany({
    where: {
      ...(params.status ? { status: params.status } : {}),
      ...(params.dateFrom || params.dateTo
        ? {
            startDate: {
              ...(params.dateFrom ? { gte: params.dateFrom } : {}),
              ...(params.dateTo ? { lte: params.dateTo } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { customer: { fullName: { contains: search, mode: "insensitive" as const } } },
              { seller: { name: { contains: search, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    },
    select: investmentListSelect,
    orderBy: { createdAt: "desc" },
  });
}

const investmentSellerListSelect = {
  id: true,
  startDate: true,
  firstReturnDate: true,
  maturityDate: true,
  status: true,
  customer: { select: { id: true, fullName: true } },
  seller: { select: { id: true, name: true } },
} as const;

export type InvestmentSellerListItem = Awaited<
  ReturnType<typeof listInvestmentsForSeller>
>[number];

/** SELLER's own investments only, with financial columns never queried at all. */
export async function listInvestmentsForSeller(
  sellerId: string,
  params: { search?: string; status?: InvestmentStatus; dateFrom?: Date; dateTo?: Date },
) {
  const search = params.search?.trim();

  return prisma.investment.findMany({
    where: {
      sellerId,
      ...(params.status ? { status: params.status } : {}),
      ...(params.dateFrom || params.dateTo
        ? {
            startDate: {
              ...(params.dateFrom ? { gte: params.dateFrom } : {}),
              ...(params.dateTo ? { lte: params.dateTo } : {}),
            },
          }
        : {}),
      ...(search
        ? { customer: { fullName: { contains: search, mode: "insensitive" as const } } }
        : {}),
    },
    select: investmentSellerListSelect,
    orderBy: { createdAt: "desc" },
  });
}

const investmentDetailSelect = {
  id: true,
  principalAmount: true,
  annualRate: true,
  startDate: true,
  firstReturnDate: true,
  maturityDate: true,
  status: true,
  rejectionReason: true,
  validatedAt: true,
  cancelledAt: true,
  cancellationReason: true,
  createdAt: true,
  customer: { select: { id: true, fullName: true, identification: true, phone: true, address: true } },
  seller: { select: { id: true, name: true } },
  validatedBy: { select: { id: true, name: true } },
  cancelledBy: { select: { id: true, name: true } },
  receipt: { select: { fileUrl: true, fileName: true, fileType: true, createdAt: true } },
  contract: { select: { fileUrl: true, fileName: true, fileType: true, createdAt: true } },
} as const;

export type InvestmentDetail = Awaited<ReturnType<typeof findInvestmentById>>;

/** Full detail, for ADMIN/ACCOUNTANT. No ownership scoping -- both roles see every investment. */
export async function findInvestmentById(id: string) {
  return prisma.investment.findUnique({
    where: { id },
    select: investmentDetailSelect,
  });
}

const investmentSellerDetailSelect = {
  id: true,
  startDate: true,
  firstReturnDate: true,
  maturityDate: true,
  status: true,
  createdAt: true,
  customer: { select: { id: true, fullName: true } },
  seller: { select: { id: true, name: true } },
} as const;

export type InvestmentSellerDetail = Awaited<ReturnType<typeof findInvestmentForSeller>>;

/**
 * Full detail for SELLER, but scoped to their own investments at the query
 * level (`where: { id, sellerId }`) rather than fetched-then-filtered, and
 * selecting only the non-financial columns the security rules allow. A
 * mismatched id or a foreign investment both resolve to `null` -- the two
 * cases must be indistinguishable to the caller (see
 * investment-service.ts#getInvestmentForUser).
 */
export async function findInvestmentForSeller(id: string, sellerId: string) {
  return prisma.investment.findFirst({
    where: { id, sellerId },
    select: investmentSellerDetailSelect,
  });
}

export type CreateInvestmentData = {
  customerId: string;
  sellerId: string;
  principalAmount: string;
  annualRate: string;
  startDate: Date;
  firstReturnDate: Date;
  maturityDate: Date;
  receipt: {
    fileUrl: string;
    fileName: string;
    fileType: string;
    uploadedById: string;
  };
  contract?: {
    fileUrl: string;
    fileName: string;
    fileType: string;
    uploadedById: string;
  };
};

/**
 * Creates an Investment together with its InvestmentReceipt (and optional
 * InvestmentContract) in one transaction -- it must never be possible to
 * end up with an Investment that has no receipt, due to a partial failure.
 */
export async function createInvestmentWithReceipt(data: CreateInvestmentData) {
  return prisma.$transaction(async (tx) => {
    return tx.investment.create({
      data: {
        customerId: data.customerId,
        sellerId: data.sellerId,
        principalAmount: data.principalAmount,
        annualRate: data.annualRate,
        startDate: data.startDate,
        firstReturnDate: data.firstReturnDate,
        maturityDate: data.maturityDate,
        receipt: { create: data.receipt },
        ...(data.contract ? { contract: { create: data.contract } } : {}),
      },
      select: { id: true },
    });
  });
}

/**
 * Approves a still-pending investment. The `status: PENDING_VALIDATION`
 * clause makes this an atomic conditional update -- `count === 0` means
 * either the id doesn't exist or it was already validated (including by a
 * concurrent request), which the caller treats as a validation error.
 */
export async function approveInvestment(id: string, validatedById: string) {
  const result = await prisma.investment.updateMany({
    where: { id, status: "PENDING_VALIDATION" },
    data: { status: "ACTIVE", validatedById, validatedAt: new Date() },
  });
  return result.count > 0;
}

export async function rejectInvestment(id: string, validatedById: string, rejectionReason: string) {
  const result = await prisma.investment.updateMany({
    where: { id, status: "PENDING_VALIDATION" },
    data: { status: "REJECTED", validatedById, validatedAt: new Date(), rejectionReason },
  });
  return result.count > 0;
}

/** Early administrative cancellation -- only ever applies to an ACTIVE investment. */
export async function cancelInvestment(
  id: string,
  cancelledById: string,
  cancellationReason: string,
  cancelledAt: Date,
) {
  const result = await prisma.investment.updateMany({
    where: { id, status: "ACTIVE" },
    data: { status: "CANCELLED", cancelledById, cancelledAt, cancellationReason },
  });
  return result.count > 0;
}

/** Looks up an investment's current status only, for pre-mutation checks that need a fast existence/state read. */
export async function findInvestmentStatus(id: string) {
  return prisma.investment.findUnique({ where: { id }, select: { id: true, status: true, startDate: true } });
}
