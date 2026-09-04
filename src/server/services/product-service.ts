import "server-only";
import { ProductType, UserRole } from "@/generated/prisma/enums";
import type { PublicUser } from "@/lib/auth/session";
import { isValidUuid } from "@/lib/validation";
import * as productRepository from "@/server/repositories/product-repository";
import type { ProductStatusFilter } from "@/server/repositories/product-repository";

// All Product permission logic lives here, not in pages/components/
// actions. MODULE_ACCESS.productos in rbac.ts already keeps ACCOUNTANT/
// SELLER out of this module entirely via requireModuleAccess (only ADMIN
// has access at all -- see rbac.ts), but every function below re-checks
// actingUser.role === ADMIN again on its own, as defense in depth,
// mirroring user-management-service.ts. Callers (Server Actions, pages)
// must still call requireModuleAccess("productos") themselves first.
//
// SELLER's read-only access to ACTIVE products for the sale form's
// selector is a separate, narrower concern handled entirely by
// sale-repository.ts's listActiveProducts/findActiveProductById -- this
// file never needs to serve that path.

export type { ProductStatusFilter };

function str(value: FormDataEntryValue | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function isValidProductType(value: string): value is ProductType {
  return (Object.values(ProductType) as string[]).includes(value);
}

function isUniqueNameError(error: unknown): boolean {
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

// Cents, mirroring sale-service.ts/investment-service.ts's convention --
// computed in cents so rounding never loses or invents a cent.
function toCents(amount: number): number {
  return Math.round(amount * 100);
}

function centsToDecimalString(cents: number): string {
  return (cents / 100).toFixed(2);
}

export type ProductFieldErrors = Partial<
  Record<"name" | "officialPrice" | "currency" | "type", string>
>;

export type ProductActionResult =
  | { ok: true; id: string }
  | { ok: false; errors?: ProductFieldErrors; formError?: string };

export type RawProductInput = {
  name?: FormDataEntryValue | null;
  description?: FormDataEntryValue | null;
  officialPrice?: FormDataEntryValue | null;
  currency?: FormDataEntryValue | null;
  type?: FormDataEntryValue | null;
  // Only read on update -- create always starts a product ACTIVE.
  active?: FormDataEntryValue | null;
};

/** ADMIN-only listing -- everyone else gets an empty list (defense in depth; requireModuleAccess already keeps them off the page entirely). */
export function listProductsForAdmin(
  actingUser: PublicUser,
  params: { search?: string; status?: ProductStatusFilter },
): Promise<productRepository.ProductListItem[]> {
  if (actingUser.role !== UserRole.ADMIN) {
    return Promise.resolve([]);
  }
  return productRepository.listProducts(params);
}

export async function getProductForAdmin(actingUser: PublicUser, id: string) {
  if (actingUser.role !== UserRole.ADMIN || !isValidUuid(id)) {
    return null;
  }
  return productRepository.findProductById(id);
}

function validateFields(raw: RawProductInput) {
  const name = str(raw.name);
  const description = str(raw.description);
  const currency = str(raw.currency) || "USD";
  const typeRaw = str(raw.type);

  const errors: ProductFieldErrors = {};
  if (!name) errors.name = "El nombre es obligatorio.";
  if (!currency) errors.currency = "La moneda es obligatoria.";
  if (!typeRaw || !isValidProductType(typeRaw)) {
    errors.type = "Selecciona un tipo de producto válido.";
  }

  const priceRaw = str(raw.officialPrice);
  const priceValue = Number(priceRaw);
  let priceCents = 0;
  if (!priceRaw || !Number.isFinite(priceValue) || priceValue <= 0) {
    errors.officialPrice = "Ingresa un precio mayor a cero.";
  } else {
    priceCents = toCents(priceValue);
  }

  return { name, description, currency, typeRaw, priceCents, errors };
}

export async function createProductForAdmin(
  actingUser: PublicUser,
  raw: RawProductInput,
): Promise<ProductActionResult> {
  if (actingUser.role !== UserRole.ADMIN) {
    return { ok: false, formError: "No tienes permiso para crear productos." };
  }

  const { name, description, currency, typeRaw, priceCents, errors } = validateFields(raw);
  if (Object.keys(errors).length > 0 || !isValidProductType(typeRaw)) {
    return { ok: false, errors };
  }

  try {
    const product = await productRepository.createProduct({
      name,
      description: description || null,
      officialPrice: centsToDecimalString(priceCents),
      currency,
      type: typeRaw,
      active: true,
    });
    return { ok: true, id: product.id };
  } catch (error) {
    if (isUniqueNameError(error)) {
      return { ok: false, errors: { name: "Ya existe un producto con ese nombre." } };
    }
    console.error("[products] Failed to create product:", error);
    return { ok: false, formError: "No se pudo crear el producto. Intenta nuevamente." };
  }
}

/**
 * Updates a product's catalog data -- name/description/price/currency/
 * type/active. Never touches Sale: originalPrice on every existing Sale
 * is a snapshot taken at sale time (see schema.prisma), so changing
 * officialPrice here only ever affects sales created from this point on.
 */
export async function updateProductForAdmin(
  actingUser: PublicUser,
  id: string,
  raw: RawProductInput,
): Promise<ProductActionResult> {
  if (actingUser.role !== UserRole.ADMIN) {
    return { ok: false, formError: "No tienes permiso para editar productos." };
  }
  if (!isValidUuid(id)) {
    return { ok: false, formError: "El producto indicado no es válido." };
  }

  const existing = await productRepository.findProductById(id);
  if (!existing) {
    return { ok: false, formError: "El producto indicado no existe." };
  }

  const { name, description, currency, typeRaw, priceCents, errors } = validateFields(raw);
  if (Object.keys(errors).length > 0 || !isValidProductType(typeRaw)) {
    return { ok: false, errors };
  }

  const active = str(raw.active) !== "false";

  try {
    await productRepository.updateProduct(id, {
      name,
      description: description || null,
      officialPrice: centsToDecimalString(priceCents),
      currency,
      type: typeRaw,
      active,
    });
    return { ok: true, id };
  } catch (error) {
    if (isUniqueNameError(error)) {
      return { ok: false, errors: { name: "Ya existe un producto con ese nombre." } };
    }
    console.error("[products] Failed to update product:", error);
    return { ok: false, formError: "No se pudo actualizar el producto. Intenta nuevamente." };
  }
}

export type ToggleProductStatusResult = { ok: true } | { ok: false; formError: string };

/** Quick activar/desactivar from the listing table. An INACTIVE product simply stops appearing in the sale form's selector -- its past sales are untouched. */
export async function toggleProductStatusForAdmin(
  actingUser: PublicUser,
  id: string,
): Promise<ToggleProductStatusResult> {
  if (actingUser.role !== UserRole.ADMIN) {
    return { ok: false, formError: "No tienes permiso para administrar productos." };
  }
  if (!isValidUuid(id)) {
    return { ok: false, formError: "El producto indicado no es válido." };
  }

  const existing = await productRepository.findProductById(id);
  if (!existing) {
    return { ok: false, formError: "El producto indicado no existe." };
  }

  await productRepository.setProductActive(id, !existing.active);
  return { ok: true };
}

export type ProductDeletionResult =
  | { ok: true }
  | { ok: false; formError: string; hasSales?: boolean };

const HAS_SALES_ERROR =
  "Este producto tiene ventas registradas y no se puede eliminar. Desactívalo en su lugar.";

/**
 * Deletes a product -- ADMIN only. Refuses when the product has any Sale
 * attached (never touches those sales or anything derived from them);
 * `hasSales: true` lets the UI offer "desactivar" instead. The
 * FK-restriction catch is defense in depth against a sale being created
 * in the window between the count check and the delete -- Sale's relation
 * to Product uses Prisma's default Restrict behavior, so the database
 * itself would also reject the delete in that case.
 */
export async function deleteProductForAdmin(
  actingUser: PublicUser,
  id: string,
): Promise<ProductDeletionResult> {
  if (actingUser.role !== UserRole.ADMIN) {
    return { ok: false, formError: "No tienes permiso para eliminar productos." };
  }
  if (!isValidUuid(id)) {
    return { ok: false, formError: "El producto indicado no es válido." };
  }

  const existing = await productRepository.findProductById(id);
  if (!existing) {
    return { ok: false, formError: "El producto indicado no existe." };
  }

  const salesCount = await productRepository.countProductSales(id);
  if (salesCount > 0) {
    return { ok: false, formError: HAS_SALES_ERROR, hasSales: true };
  }

  try {
    await productRepository.deleteProduct(id);
  } catch (error) {
    if (isForeignKeyRestrictionError(error)) {
      return { ok: false, formError: HAS_SALES_ERROR, hasSales: true };
    }
    console.error("[products] Failed to delete product:", error);
    return { ok: false, formError: "No se pudo eliminar el producto. Intenta nuevamente." };
  }

  return { ok: true };
}
