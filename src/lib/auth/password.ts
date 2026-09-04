import "server-only";
import { compare, hash, hashSync } from "bcryptjs";

export function verifyPassword(password: string, passwordHash: string) {
  return compare(password, passwordHash);
}

export function hashPassword(password: string) {
  return hash(password, 10);
}

// A valid-format bcrypt hash that doesn't correspond to any real user's
// password. Comparing against this when no matching user was found keeps
// login's response time roughly the same as a real (wrong-password)
// failure, so timing can't be used to guess whether an email is
// registered. Computed once at module load, not a real credential.
export const DUMMY_PASSWORD_HASH = hashSync(
  "no-such-user-timing-safety-padding",
  10,
);
