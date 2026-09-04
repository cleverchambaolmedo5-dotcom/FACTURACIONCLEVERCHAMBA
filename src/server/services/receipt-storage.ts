import "server-only";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { mkdir, unlink, writeFile } from "node:fs/promises";

// Generic local-disk receipt storage, shared by PaymentReceipt (payments
// module), SaleReceipt (ventas module), and InvestmentReceipt/
// InvestmentContract (inversiones module). All are the exact same kind of
// artifact -- a small PDF/image attachment, validated and stored the same
// way -- so all MIME/extension/size validation and disk I/O lives here
// once; only the destination subfolder differs per `kind`, keyed below.
// Files live under public/uploads/<kind>-receipts/ and are served directly
// by Next.js as static assets -- callers only ever persist the relative
// fileUrl this module returns, never the filesystem path or file bytes.

export type ReceiptKind = "payment" | "sale" | "investment" | "investment-contract";

const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");
const PUBLIC_ROOT = "/uploads/";

// Existing PaymentReceipt/SaleReceipt rows already store fileUrl values
// under these exact folder names -- this mapping must keep them so nothing
// already on disk (or already referenced in the database) breaks.
const RECEIPT_DIR: Record<ReceiptKind, string> = {
  payment: "payment-receipts",
  sale: "sale-receipts",
  investment: "investment-receipts",
  "investment-contract": "investment-contracts",
};

export const MAX_RECEIPT_BYTES = 5 * 1024 * 1024; // 5 MB

// Keyed by MIME type. Each entry's accepted extensions guard against a
// spoofed Content-Type that doesn't match the original filename -- both
// must agree for the file to be accepted.
const ALLOWED_TYPES: Record<string, { ext: string; extensions: string[] }> = {
  "application/pdf": { ext: "pdf", extensions: ["pdf"] },
  "image/jpeg": { ext: "jpg", extensions: ["jpg", "jpeg"] },
  "image/jpg": { ext: "jpg", extensions: ["jpg", "jpeg"] },
  "image/png": { ext: "png", extensions: ["png"] },
  "image/webp": { ext: "webp", extensions: ["webp"] },
};

export type ReceiptValidationError = "type" | "size";

/**
 * Validates MIME type, original filename extension, and size -- all on the
 * server, never trusting the browser's `accept` attribute alone. Both the
 * declared MIME type and the filename's extension must agree on one of the
 * allowed formats (PDF, JPG, JPEG, PNG, WEBP). Identical rules for every
 * receipt kind (payment or sale).
 */
export function validateReceiptFile(file: File): ReceiptValidationError | null {
  const allowed = ALLOWED_TYPES[file.type];
  const nameExt = path.extname(file.name).slice(1).toLowerCase();

  if (!allowed || !allowed.extensions.includes(nameExt)) {
    return "type";
  }
  if (file.size > MAX_RECEIPT_BYTES) {
    return "size";
  }
  return null;
}

/**
 * Saves an already-validated receipt file to disk under a fresh,
 * unguessable name (never derived from the original filename) and returns
 * the relative public path plus the metadata to store on
 * PaymentReceipt/SaleReceipt. `kind` only picks the destination subfolder.
 */
export async function saveReceiptFile(
  file: File,
  kind: ReceiptKind,
): Promise<{ fileUrl: string; fileName: string; fileType: string }> {
  const dirName = RECEIPT_DIR[kind];
  const uploadDir = path.join(UPLOADS_ROOT, dirName);
  const ext = ALLOWED_TYPES[file.type]!.ext;
  const filename = `${randomUUID()}.${ext}`;

  await mkdir(uploadDir, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadDir, filename), buffer);

  return {
    fileUrl: `${PUBLIC_ROOT}${dirName}/${filename}`,
    fileName: file.name,
    fileType: file.type,
  };
}

/**
 * Best-effort delete, used to clean up a receipt file already written to
 * disk when the surrounding registration ultimately fails (e.g. the
 * payment/sale transaction errors out after the file was saved). Only ever
 * deletes files that resolve inside public/uploads/<kind>-receipts/ --
 * anything else (a foreign URL, a crafted "../.." path) is silently
 * ignored. Failures never throw: losing the orphaned file must never mask
 * the original error.
 */
export async function deleteReceiptFile(fileUrl: string | null | undefined, kind: ReceiptKind) {
  const dirName = RECEIPT_DIR[kind];
  const uploadDir = path.join(UPLOADS_ROOT, dirName);
  const publicPrefix = `${PUBLIC_ROOT}${dirName}/`;

  if (!fileUrl || !fileUrl.startsWith(publicPrefix)) {
    return;
  }

  const filename = path.basename(fileUrl);
  const resolved = path.join(uploadDir, filename);

  if (path.dirname(resolved) !== uploadDir) {
    return;
  }

  try {
    await unlink(resolved);
  } catch {
    // Already gone or otherwise inaccessible -- not fatal.
  }
}
