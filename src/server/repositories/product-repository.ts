import "server-only";
import { prisma } from "@/lib/prisma";
import { ProductType } from "@/generated/prisma/enums";

// Pure data access for Product (catalog side used by /productos). No
// auth/RBAC awareness lives here -- src/server/services/product-service.ts
// decides who's allowed to see or touch these records. The read-only
// selectors backing the sale form's product picker (listActiveProducts,
// findActiveProductById) stay in sale-repository.ts, unchanged -- they
// serve a different caller with a different, narrower shape.

const productListSelect = {
  id: true,
  name: true,
  description: true,
  officialPrice: true,
  currency: true,
  type: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { sales: true } },
} as const;

export type ProductListItem = Awaited<ReturnType<typeof listProducts>>[number];

export type ProductStatusFilter = "all" | "active" | "inactive";

export async function listProducts(params: { search?: string; status?: ProductStatusFilter }) {
  const search = params.search?.trim();
  const status = params.status ?? "all";

  return prisma.product.findMany({
    where: {
      ...(status === "active" ? { active: true } : {}),
      ...(status === "inactive" ? { active: false } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { description: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    select: productListSelect,
    orderBy: { createdAt: "desc" },
  });
}

export async function findProductById(id: string) {
  return prisma.product.findUnique({ where: { id } });
}

export type ProductWriteData = {
  name: string;
  description: string | null;
  officialPrice: string;
  currency: string;
  type: ProductType;
  active: boolean;
};

export async function createProduct(data: ProductWriteData) {
  return prisma.product.create({ data });
}

export async function updateProduct(id: string, data: ProductWriteData) {
  return prisma.product.update({ where: { id }, data });
}

export async function setProductActive(id: string, active: boolean) {
  return prisma.product.update({ where: { id }, data: { active } });
}

/** Number of Sale rows referencing this product -- used to block deletion, never to touch those sales. */
export async function countProductSales(id: string) {
  return prisma.sale.count({ where: { productId: id } });
}

export async function deleteProduct(id: string) {
  await prisma.product.delete({ where: { id } });
}
