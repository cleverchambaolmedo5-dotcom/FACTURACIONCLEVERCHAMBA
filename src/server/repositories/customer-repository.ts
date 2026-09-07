import "server-only";
import { prisma } from "@/lib/prisma";
import { UserRole, UserStatus } from "@/generated/prisma/enums";

// Pure data access for Customer. No auth/RBAC awareness lives here --
// callers (src/server/services/customer-service.ts) decide *which*
// records a given user is allowed to see or touch and pass that down as
// plain query params (e.g. `sellerId`).

const customerListSelect = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  country: true,
  createdAt: true,
  assignedSeller: { select: { id: true, name: true } },
} as const;

export type CustomerListItem = Awaited<ReturnType<typeof listCustomers>>[number];

export async function listCustomers(params: { sellerId?: string; search?: string }) {
  const search = params.search?.trim();

  return prisma.customer.findMany({
    where: {
      ...(params.sellerId ? { assignedSellerId: params.sellerId } : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } },
              { phone: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    select: customerListSelect,
    orderBy: { createdAt: "desc" },
  });
}

const customerSearchSelect = {
  id: true,
  fullName: true,
  phone: true,
  identification: true,
} as const;

export type CustomerSearchResult = Awaited<ReturnType<typeof searchCustomers>>[number];

/**
 * Search used by the sale form's customer selector: matches name, phone,
 * or identification, scoped to `sellerId` when given (SELLER role).
 * Capped to a handful of results -- this backs a type-ahead, not a full
 * listing.
 */
export async function searchCustomers(params: { sellerId?: string; query: string }) {
  const query = params.query.trim();

  return prisma.customer.findMany({
    where: {
      ...(params.sellerId ? { assignedSellerId: params.sellerId } : {}),
      OR: [
        { fullName: { contains: query, mode: "insensitive" as const } },
        { phone: { contains: query, mode: "insensitive" as const } },
        { identification: { contains: query, mode: "insensitive" as const } },
      ],
    },
    select: customerSearchSelect,
    orderBy: { fullName: "asc" },
    take: 10,
  });
}

export async function findCustomerById(id: string) {
  return prisma.customer.findUnique({
    where: { id },
    include: { assignedSeller: { select: { id: true, name: true } } },
  });
}

export type CreateCustomerData = {
  fullName: string;
  // Optional -- see Customer.identification in schema.prisma.
  identification: string | null;
  phone: string;
  email: string | null;
  country: string;
  // Optional -- see Customer.address in schema.prisma. Reused by both the
  // Clientes module and the Inversiones quick-create flow.
  address: string | null;
  assignedSellerId: string;
};

export async function createCustomer(data: CreateCustomerData) {
  return prisma.customer.create({ data });
}

export type UpdateCustomerData = Partial<CreateCustomerData>;

export async function updateCustomer(id: string, data: UpdateCustomerData) {
  return prisma.customer.update({ where: { id }, data });
}

/**
 * Counts the customer's financial movements across every module that
 * depends on Customer (Sale, Investment). Used to block deletion --
 * never to filter or alter those records themselves.
 */
export async function countCustomerFinancialMovements(customerId: string) {
  const [sales, investments] = await Promise.all([
    prisma.sale.count({ where: { customerId } }),
    prisma.investment.count({ where: { customerId } }),
  ]);
  return { sales, investments };
}

export async function deleteCustomer(id: string) {
  await prisma.customer.delete({ where: { id } });
}

/** Active SELLER users, for the "vendedor responsable" selector. */
export async function listActiveSellers() {
  return prisma.user.findMany({
    where: { role: UserRole.SELLER, status: UserStatus.ACTIVE },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

/** Looks up a user, but only returns it if it's a currently-active SELLER. */
export async function findActiveSellerById(id: string) {
  return prisma.user.findFirst({
    where: { id, role: UserRole.SELLER, status: UserStatus.ACTIVE },
    select: { id: true, name: true },
  });
}
