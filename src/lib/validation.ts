// Small, dependency-free validation helpers shared across server-side
// forms. Kept intentionally simple (plain functions, no schema library)
// since form shapes so far are small; introduce a schema validator (e.g.
// zod) only if forms grow complex enough to justify the dependency.

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
