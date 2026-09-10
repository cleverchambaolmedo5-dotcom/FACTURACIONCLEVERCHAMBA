import "server-only";
import { UserRole } from "@/generated/prisma/enums";
import type { PublicUser } from "@/lib/auth/session";
import { isValidEmail, isValidUuid } from "@/lib/validation";
import {
  normalizeCustomerIdentification,
  normalizeCustomerName,
  normalizeCustomerPhone,
} from "@/lib/customer-normalize";
import * as customerRepository from "@/server/repositories/customer-repository";
import type { CustomerDuplicateCandidate } from "@/server/repositories/customer-repository";

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

export type { CustomerDuplicateCandidate } from "@/server/repositories/customer-repository";

// "blocked": the primary rule (NOMBRE+CÉDULA when there's an
// identification, NOMBRE+TELÉFONO otherwise) matched an existing
// customer -- the save is refused. "warning": only a secondary signal
// (shared phone or email) matched -- advisory only, see
// findDuplicateForCustomer below.
export type CustomerDuplicateInfo =
  | { kind: "blocked"; customer: CustomerDuplicateCandidate }
  | { kind: "warning"; customers: CustomerDuplicateCandidate[] };

export type CustomerActionResult =
  | { ok: true; id: string }
  | { ok: false; errors?: CustomerFieldErrors; formError?: string; duplicate?: CustomerDuplicateInfo };

export type RawCustomerInput = {
  fullName?: FormDataEntryValue | null;
  identification?: FormDataEntryValue | null;
  phone?: FormDataEntryValue | null;
  email?: FormDataEntryValue | null;
  country?: FormDataEntryValue | null;
  // Optional -- see Customer.address in schema.prisma.
  address?: FormDataEntryValue | null;
  assignedSellerId?: FormDataEntryValue | null;
  // Set by the client after the user has seen a *warning* (never a
  // block) and chosen "Continuar con nuevo cliente" -- see
  // findDuplicateForCustomer. Re-submitting with this set skips the
  // advisory check but never bypasses the primary blocking rule.
  confirmDuplicate?: FormDataEntryValue | null;
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

function isConfirmedDuplicate(raw: RawCustomerInput): boolean {
  return str(raw.confirmDuplicate) === "true";
}

/**
 * Duplicate-detection rule (see project instructions for the full spec):
 *   - Identification present  -> block on NOMBRE + CÉDULA.
 *   - Identification absent   -> block on NOMBRE + TELÉFONO, but only
 *     against other customers that also lack an identification (see
 *     findCustomerByNameAndPhone) -- matching an existing customer that
 *     does have one is an allowed combination.
 *   - Otherwise, a shared phone or email is only ever a non-blocking
 *     warning -- it never becomes an independent block.
 * `excludeId` leaves a customer's own record out of the comparison, so
 * editing it without changing name/cédula/teléfono never flags itself.
 */
async function findDuplicateForCustomer(
  input: { fullName: string; identification: string; phone: string; email: string },
  excludeId?: string,
): Promise<{ kind: "none" } | CustomerDuplicateInfo> {
  const normalizedName = normalizeCustomerName(input.fullName);
  const normalizedPhone = normalizeCustomerPhone(input.phone);

  if (input.identification) {
    const blocked = await customerRepository.findCustomerByNameAndIdentification({
      normalizedName,
      normalizedIdentification: normalizeCustomerIdentification(input.identification),
      excludeId,
    });
    if (blocked) return { kind: "blocked", customer: blocked };
  } else {
    const blocked = await customerRepository.findCustomerByNameAndPhone({
      normalizedName,
      normalizedPhone,
      excludeId,
    });
    if (blocked) return { kind: "blocked", customer: blocked };
  }

  const similar = await customerRepository.findSimilarCustomers({
    normalizedPhone,
    email: input.email || null,
    excludeId,
  });
  if (similar.length > 0) return { kind: "warning", customers: similar };

  return { kind: "none" };
}

const CUSTOMER_NAME_IDENTIFICATION_UNIQUE = "customer_name_identification_unique";
const CUSTOMER_NAME_PHONE_UNIQUE = "customer_name_phone_unique";

/**
 * Extracts the name of the Postgres index/constraint a P2002 came from.
 * The two duplicate-protection indexes (see
 * prisma/migrations/20260910194546_customer_duplicate_protection) aren't
 * declared in schema.prisma (Prisma can't express expression indexes), so
 * Prisma can't resolve `error.meta.target` to column names for them the
 * way it does for schema-declared unique fields -- the driver adapter's
 * raw Postgres error (which does carry the index name) is the only place
 * to read it from. Verified empirically against a real violation of each
 * index; returns null for anything else (including a non-P2002 error) so
 * callers always have a safe fallback.
 */
function getViolatedUniqueIndex(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  if ((error as { code?: unknown }).code !== "P2002") return null;

  const meta = (error as { meta?: unknown }).meta;
  const driverAdapterError = meta && typeof meta === "object" ? (meta as { driverAdapterError?: unknown }).driverAdapterError : undefined;
  const cause = driverAdapterError && typeof driverAdapterError === "object" ? (driverAdapterError as { cause?: unknown }).cause : undefined;
  const constraint = cause && typeof cause === "object" ? (cause as { constraint?: unknown }).constraint : undefined;
  const index = constraint && typeof constraint === "object" ? (constraint as { index?: unknown }).index : undefined;

  return typeof index === "string" ? index : null;
}

/**
 * Translates a P2002 that survived the pre-check (a race: another request
 * inserted/updated a colliding customer between our SELECT and this
 * INSERT/UPDATE) into the same friendly, non-technical result the
 * pre-check itself returns -- re-running the duplicate lookup so the
 * response still carries the conflicting customer's info for the UI.
 * Returns null for a P2002 on anything else (or a non-P2002 error), so
 * the caller falls back to its generic error message.
 */
async function handleUniqueConstraintRace(
  error: unknown,
  input: { fullName: string; identification: string; phone: string; email: string },
  excludeId?: string,
): Promise<CustomerActionResult | null> {
  const index = getViolatedUniqueIndex(error);
  if (index !== CUSTOMER_NAME_IDENTIFICATION_UNIQUE && index !== CUSTOMER_NAME_PHONE_UNIQUE) {
    return null;
  }

  const duplicate = await findDuplicateForCustomer(input, excludeId);
  return {
    ok: false,
    formError: "Este cliente ya está registrado.",
    ...(duplicate.kind === "blocked" ? { duplicate } : {}),
  };
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

  const duplicate = await findDuplicateForCustomer({ fullName, identification, phone, email });
  if (duplicate.kind === "blocked") {
    return { ok: false, formError: "Este cliente ya está registrado.", duplicate };
  }
  if (duplicate.kind === "warning" && !isConfirmedDuplicate(raw)) {
    return {
      ok: false,
      formError: "Encontramos un cliente con datos similares.",
      duplicate,
    };
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
    const raceResult = await handleUniqueConstraintRace(error, { fullName, identification, phone, email });
    if (raceResult) return raceResult;

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

  const duplicate = await findDuplicateForCustomer(
    { fullName, identification, phone, email },
    existing.id,
  );
  if (duplicate.kind === "blocked") {
    return { ok: false, formError: "Este cliente ya está registrado.", duplicate };
  }
  if (duplicate.kind === "warning" && !isConfirmedDuplicate(raw)) {
    return {
      ok: false,
      formError: "Encontramos un cliente con datos similares.",
      duplicate,
    };
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
    const raceResult = await handleUniqueConstraintRace(
      error,
      { fullName, identification, phone, email },
      existing.id,
    );
    if (raceResult) return raceResult;

    console.error("[customers] Failed to update customer:", error);
    return { ok: false, formError: "No se pudo actualizar el cliente. Intenta nuevamente." };
  }
}
