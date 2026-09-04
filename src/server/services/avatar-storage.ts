import "server-only";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { mkdir, unlink, writeFile } from "node:fs/promises";

// Local-disk avatar storage for development. Files live under
// public/uploads/avatars/ and are served directly by Next.js as static
// assets -- avatarUrl in the database only ever stores the relative path
// ("/uploads/avatars/<file>"), never the filesystem path or the image
// bytes themselves.

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "avatars");
const PUBLIC_PREFIX = "/uploads/avatars/";

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export type AvatarValidationError = "type" | "size";

export function validateAvatarFile(file: File): AvatarValidationError | null {
  if (!(file.type in ALLOWED_TYPES)) {
    return "type";
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return "size";
  }
  return null;
}

/**
 * Saves an already-validated avatar file to disk under a fresh,
 * unguessable name (never derived from the original filename) and
 * returns the relative public path to store in `User.avatarUrl`.
 */
export async function saveAvatarFile(userId: string, file: File): Promise<string> {
  const ext = ALLOWED_TYPES[file.type];
  const filename = `${userId}-${randomUUID()}.${ext}`;

  await mkdir(UPLOAD_DIR, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, filename), buffer);

  return `${PUBLIC_PREFIX}${filename}`;
}

/**
 * Best-effort delete of a previous avatar. Only ever deletes files that
 * resolve inside public/uploads/avatars/ -- anything else (a foreign URL,
 * a crafted "../.." path) is silently ignored rather than touched.
 * Failures (already gone, permission issues) never throw: losing the old
 * file must never fail the profile update that replaced it.
 */
export async function deletePreviousAvatar(previousUrl: string | null | undefined) {
  if (!previousUrl || !previousUrl.startsWith(PUBLIC_PREFIX)) {
    return;
  }

  const filename = path.basename(previousUrl);
  const resolved = path.join(UPLOAD_DIR, filename);

  if (path.dirname(resolved) !== UPLOAD_DIR) {
    return;
  }

  try {
    await unlink(resolved);
  } catch {
    // Already gone or otherwise inaccessible -- not fatal.
  }
}
