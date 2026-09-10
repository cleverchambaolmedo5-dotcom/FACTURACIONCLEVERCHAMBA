// Normalization used to detect duplicate customers. Mirrored, expression
// for expression, by the SQL functions created in
// prisma/migrations/20260910194546_customer_duplicate_protection/migration.sql
// (customer_normalize_name/_identification/_ec_phone) -- both sides must
// stay in lockstep or a value that looks identical to a user could fail
// to match the ones enforced by the two partial unique indexes.

// Unicode "combining diacritical marks" block (U+0300-U+036F) left behind
// after NFD-decomposing an accented character, e.g. "é" -> "e" + U+0301.
const DIACRITIC_MARKS = /[̀-ͯ]/g;

/**
 * Case/accent/whitespace-insensitive name comparison: strips diacritics
 * (NFD-decompose, then drop the combining marks -- "José" -> "Jose"),
 * trims, collapses internal whitespace runs to a single space, lowercases.
 * Mirrors SQL's customer_normalize_name(), which uses the `unaccent`
 * extension for the same diacritic-stripping step.
 */
export function normalizeCustomerName(value: string): string {
  const withoutDiacritics = value.normalize("NFD").replace(DIACRITIC_MARKS, "");
  return withoutDiacritics.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Strips everything but letters/digits (spaces, dashes, dots) and
 * uppercases, so "123-456", "123 456" and "123456" are the same cédula. */
export function normalizeCustomerIdentification(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Canonical Ecuadorian phone form. Strips everything but digits, drops a
 * leading "00" international-call prefix, and rewrites a local
 * trunk-prefixed number (0 + 9-digit mobile, or 0 + 1-digit area code +
 * 7-digit line -- 9 or 10 digits) to country-code form, so
 * "0999999999" / "593999999999" / "+593999999999" / "+593 99 999 9999" /
 * "593-99-999-9999" all converge on "593999999999". A number that
 * doesn't match a recognized Ecuadorian pattern (foreign numbers,
 * malformed input) is left as plain digits rather than guessed at.
 * Mirrors SQL's customer_normalize_ec_phone().
 */
export function normalizeCustomerPhone(value: string): string {
  let digits = value.replace(/[^0-9]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0") && (digits.length === 9 || digits.length === 10)) {
    digits = "593" + digits.slice(1);
  }
  return digits;
}
