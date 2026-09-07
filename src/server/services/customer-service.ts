import "server-only";
import { UserRole } from "@/generated/prisma/enums";
import type { PublicUser } from "@/lib/auth/session";
import { isValidEmail, isValidUuid } from "@/lib/validation";
import * as customerRepository from "@/server/repositories/customer-repository";

// All Customer permission logic lives here, not in pages/components/
// actions. Every function takes the authenticated `user` and enforces:
//   1. What the user is allowed to see (row-level scoping for SELLER).
//   2. What the user is allowed to write (assignedSellerId rules).
// Callers (Server Actions, pages) must still call requireModuleAccess()
// themselves first -- this layer assumes module-level access already
// passed and only handles record-level rules.

export type CustomerFieldErrors = Partial<
  Record<"fullName" | "identification" | "phone" | "email" | "country" | "assignedSellerId", string>
>;

export type CustomerActionResult =
  | { ok: true; id: string }
  | { ok: false; errors?: CustomerFieldErrors; formError?: string };

export type RawCustomerInput = {
  fullName?: FormDataEntryValue | null;
  identification?: FormDataEntryValue | null;
  phone?: FormDataEntryValue | null;
  email?: FormDataEntryValue | null;
  country?: FormDataEntryValue | null;
  // Optional -- see Customer.address in schema.prisma.
  address?: FormDataEntryValue | null;
  assignedSellerId?: FormDataEntryValue | null;
};

function str(value: FormDataEntryValue | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

/** SELLER sees only their own customers; ADMIN/ACCOUNTANT see all. */
export function listCustomersForUser(user: PublicUser, search?: string) {
  const sellerId = user.role === UserRole.SELLER ? user.id : undefined;
  return customerRepository.listCustomers({ sellerId, search });
}

/**
 * Fetches one customer, enforcing record-level ownership for SELLER.
 * Returns null both when the customer doesn't exist and when a SELLER
 * isn't its assigned seller -- the two cases must look identical so a
 * SELLER can't use this to probe for other sellers' customer IDs.
 */
export async function getCustomerForUser(user: PublicUser, id: string) {
  if (!isValidUuid(id)) {
    return null;
  }

  const customer = await customerRepository.findCustomerById(id);
  if (!customer) {
    return null;
  }

  if (user.role === UserRole.SELLER && customer.assignedSellerId !== user.id) {
    return null;
  }

  return customer;
}

/** ADMIN/ACCOUNTANT-only: the SELLER options for the assignment selector. */
export function listAssignableSellers() {
  return customerRepository.listActiveSellers();
}

function validateCommonFields(raw: RawCustomerInput) {
  const fullName = str(raw.fullName);
  const identification = str(raw.identification);
  const phone = str(raw.phone);
  const email = str(raw.email);
  const country = str(raw.country) || "Ecuador";
  // Optional -- no validation beyond trimming, matching city elsewhere.
  const address = str(raw.address);

  const errors: CustomerFieldErrors = {};
  if (!fullName) errors.fullName = "El nombre completo es obligatorio.";
  // Identification (cédula/RUC) is optional -- a customer can be
  // registered and saved without one; see Customer.identification in
  // schema.prisma.
  if (!phone) errors.phone = "El teléfono es obligatorio.";
  if (!country) errors.country = "El país es obligatorio.";
  if (email && !isValidEmail(email)) {
    errors.email = "El correo no tiene un formato válido.";
  }

  return { fullName, identification, phone, email, country, address, errors };
}

/**
 * Resolves the assigned seller for a write operation:
 *   - SELLER: always themselves, never taken from input, never editable.
 *   - ADMIN/ACCOUNTANT: must pick an existing, active SELLER by id.
 * `allowUnset` lets an update skip re-validating the seller when a SELLER
 * (who can't change it) submits the form without that field at all.
 */
async function resolveAssignedSellerId(
  user: PublicUser,
  raw: RawCustomerInput,
  { allowUnset }: { allowUnset: boolean },
): Promise<{ assignedSellerId?: string; error?: string }> {
  if (user.role === UserRole.SELLER) {
    return allowUnset ? {} : { assignedSellerId: user.id };
  }

  const requested = str(raw.assignedSellerId);
  if (!requested) {
    return { error: "Selecciona un vendedor responsable." };
  }

  const seller = await customerRepository.findActiveSellerById(requested);
  if (!seller) {
    return { error: "Selecciona un vendedor responsable activo válido." };
  }

  return { assignedSellerId: seller.id };
}

function isUniqueIdentificationError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

export async function createCustomerForUser(
  user: PublicUser,
  raw: RawCustomerInput,
): Promise<CustomerActionResult> {
  const { fullName, identification, phone, email, country, address, errors } =
    validateCommonFields(raw);

  const sellerResult = await resolveAssignedSellerId(user, raw, { allowUnset: false });
  if (sellerResult.error) {
    errors.assignedSellerId = sellerResult.error;
  }

  if (Object.keys(errors).length > 0 || !sellerResult.assignedSellerId) {
    return { ok: false, errors };
  }

  try {
    const customer = await customerRepository.createCustomer({
      fullName,
      identification: identification || null,
      phone,
      email: email || null,
      country,
      address: address || null,
      assignedSellerId: sellerResult.assignedSellerId,
    });
    return { ok: true, id: customer.id };
  } catch (error) {
    if (isUniqueIdentificationError(error)) {
      return {
        ok: false,
        errors: { identification: "Ya existe un cliente con esa identificación." },
      };
    }
    console.error("[customers] Failed to create customer:", error);
    return { ok: false, formError: "No se pudo crear el cliente. Intenta nuevamente." };
  }
}

function isForeignKeyRestrictionError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2003"
  );
}

export type CustomerDeletionResult = { ok: true } | { ok: false; formError: string };

const HAS_FINANCIAL_MOVEMENTS_ERROR =
  "No se puede eliminar este cliente porque tiene movimientos financieros registrados.";

/**
 * Deletes a customer -- ADMIN only. Refuses when the customer has any
 * Sale or Investment attached: this never cascades into or touches those
 * records (or anything derived from them, like installments/payments),
 * it simply blocks the deletion. The FK-restriction catch below is
 * defense in depth against a movement being created in the window
 * between the count check and the delete -- Sale/Investment's relations
 * to Customer use Prisma's default Restrict behavior, so the database
 * itself would also reject the delete in that case.
 */
export async function deleteCustomerForUser(
  user: PublicUser,
  id: string,
): Promise<CustomerDeletionResult> {
  if (user.role !== UserRole.ADMIN) {
    return { ok: false, formError: "Solo un administrador puede eliminar clientes." };
  }
  if (!isValidUuid(id)) {
    return { ok: false, formError: "El cliente indicado no es válido." };
  }

  const customer = await customerRepository.findCustomerById(id);
  if (!customer) {
    return { ok: false, formError: "El cliente indicado no existe." };
  }

  const { sales, investments } = await customerRepository.countCustomerFinancialMovements(id);
  if (sales > 0 || investments > 0) {
    return { ok: false, formError: HAS_FINANCIAL_MOVEMENTS_ERROR };
  }

  try {
    await customerRepository.deleteCustomer(id);
  } catch (error) {
    if (isForeignKeyRestrictionError(error)) {
      return { ok: false, formError: HAS_FINANCIAL_MOVEMENTS_ERROR };
    }
    console.error("[customers] Failed to delete customer:", error);
    return { ok: false, formError: "No se pudo eliminar el cliente. Intenta nuevamente." };
  }

  return { ok: true };
}

export async function updateCustomerForUser(
  user: PublicUser,
  id: string,
  raw: RawCustomerInput,
): Promise<CustomerActionResult> {
  // Record-level permission check happens before anything else: a SELLER
  // editing a customer that isn't theirs (even via a crafted request to
  // this action) is rejected here, on the server, regardless of what the
  // UI shows.
  const existing = await getCustomerForUser(user, id);
  if (!existing) {
    return {
      ok: false,
      formError: "No tienes permiso para modificar este cliente.",
    };
  }

  const { fullName, identification, phone, email, country, address, errors } =
    validateCommonFields(raw);

  // A SELLER can never change the assigned seller; simply leave it unset
  // so the update doesn't touch that column.
  const sellerResult = await resolveAssignedSellerId(user, raw, { allowUnset: true });
  if (sellerResult.error) {
    errors.assignedSellerId = sellerResult.error;
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  try {
    await customerRepository.updateCustomer(id, {
      fullName,
      identification: identification || null,
      phone,
      email: email || null,
      country,
      address: address || null,
      ...(sellerResult.assignedSellerId
        ? { assignedSellerId: sellerResult.assignedSellerId }
        : {}),
    });
    return { ok: true, id };
  } catch (error) {
    if (isUniqueIdentificationError(error)) {
      return {
        ok: false,
        errors: { identification: "Ya existe un cliente con esa identificación." },
      };
    }
    console.error("[customers] Failed to update customer:", error);
    return { ok: false, formError: "No se pudo actualizar el cliente. Intenta nuevamente." };
  }
}
