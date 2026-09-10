import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
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

// ---------------------------------------------------------------------
// Duplicate detection
//
// Matching is done via normalized-value equality (see
// src/lib/customer-normalize.ts): diacritic/case/whitespace-insensitive
// names, Ecuador-aware digit-only phones, alnum-only identifications.
// Prisma's `where` can't express that normalization, so these call the
// SQL functions created in
// prisma/migrations/20260910194546_customer_duplicate_protection/migration.sql
// (customer_normalize_name/_identification/_ec_phone) against the stored
// columns -- the exact same functions the two partial unique indexes are
// built on, so the app-level pre-check and the DB constraint can never
// disagree. Callers must pass already-normalized values (via
// src/lib/customer-normalize.ts) -- this layer only normalizes the
// *column*, not the input.
// ---------------------------------------------------------------------

export type CustomerDuplicateCandidate = {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  identification: string | null;
};

const duplicateCandidateColumnsSql = Prisma.sql`id, "fullName", phone, email, identification`;

function excludeIdSql(excludeId?: string) {
  return excludeId ? Prisma.sql`AND id <> ${excludeId}::uuid` : Prisma.empty;
}

/**
 * Primary duplicate rule when the new/edited customer HAS an
 * identification: same normalized name + same normalized identification.
 * A customer with a different (or no) identification never matches here,
 * since regexp_replace(NULL, ...) is NULL and never equals a value.
 */
export async function findCustomerByNameAndIdentification(params: {
  normalizedName: string;
  normalizedIdentification: string;
  excludeId?: string;
}): Promise<CustomerDuplicateCandidate | null> {
  const rows = await prisma.$queryRaw<CustomerDuplicateCandidate[]>(Prisma.sql`
    SELECT ${duplicateCandidateColumnsSql}
    FROM "Customer"
    WHERE public.customer_normalize_name("fullName") = ${params.normalizedName}
      AND public.customer_normalize_identification(identification) = ${params.normalizedIdentification}
      ${excludeIdSql(params.excludeId)}
    LIMIT 1
  `);
  return rows[0] ?? null;
}

/**
 * Primary duplicate rule when the new/edited customer has NO
 * identification: same normalized name + same normalized phone, scoped to
 * OTHER customers that also have no identification on file (mirrors the
 * partial unique index `customer_name_phone_unique`, which is `WHERE
 * identification IS NULL`). A customer with an identification never
 * matches here -- same name/phone against a cédula-holder is an allowed
 * combination (see findCustomerByNameAndIdentification's docstring for
 * the mirror case), not a block.
 */
export async function findCustomerByNameAndPhone(params: {
  normalizedName: string;
  normalizedPhone: string;
  excludeId?: string;
}): Promise<CustomerDuplicateCandidate | null> {
  const rows = await prisma.$queryRaw<CustomerDuplicateCandidate[]>(Prisma.sql`
    SELECT ${duplicateCandidateColumnsSql}
    FROM "Customer"
    WHERE public.customer_normalize_name("fullName") = ${params.normalizedName}
      AND public.customer_normalize_ec_phone(phone) = ${params.normalizedPhone}
      AND identification IS NULL
      ${excludeIdSql(params.excludeId)}
    LIMIT 1
  `);
  return rows[0] ?? null;
}

/**
 * Advisory-only match used for the "encontramos un cliente con datos
 * similares" warning: same normalized phone OR same email (case
 * insensitive), regardless of name. Never used to block a save -- see
 * customer-service.ts.
 */
export async function findSimilarCustomers(params: {
  normalizedPhone: string;
  email: string | null;
  excludeId?: string;
}): Promise<CustomerDuplicateCandidate[]> {
  return prisma.$queryRaw<CustomerDuplicateCandidate[]>(Prisma.sql`
    SELECT ${duplicateCandidateColumnsSql}
    FROM "Customer"
    WHERE (
      public.customer_normalize_ec_phone(phone) = ${params.normalizedPhone}
      ${params.email ? Prisma.sql`OR lower(email) = lower(${params.email})` : Prisma.empty}
    )
    ${excludeIdSql(params.excludeId)}
    ORDER BY "createdAt" ASC
    LIMIT 5
  `);
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
