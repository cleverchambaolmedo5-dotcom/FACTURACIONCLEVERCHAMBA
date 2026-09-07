import "server-only";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Generic receipt storage, shared by PaymentReceipt (payments module),
// SaleReceipt (ventas module), and InvestmentReceipt/InvestmentContract
// (inversiones module). All are the exact same kind of artifact -- a small
// PDF/image attachment, validated and stored the same way -- so all
// MIME/extension/size validation and upload I/O lives here once; only the
// destination folder differs per `kind`, keyed below.
//
// Files are stored in the public "receipts" bucket in Supabase Storage
// (not on local disk): this app runs on hosting where the filesystem is
// ephemeral/not shared across instances, so anything written to local disk
// at request time is never reliably servable afterwards. `fileUrl` is the
// full public Supabase Storage URL -- callers only ever persist that URL,
// never a filesystem path or the file bytes.

export type ReceiptKind = "payment" | "sale" | "investment" | "investment-contract";

const BUCKET = "receipts";

// Existing PaymentReceipt/SaleReceipt rows already store fileUrl values
// under these exact folder names -- this mapping must keep them so nothing
// already referenced in the database breaks.
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
 * Uploads an already-validated receipt file to Supabase Storage under a
 * fresh, unguessable name (never derived from the original filename) and
 * returns the public URL plus the metadata to store on
 * PaymentReceipt/SaleReceipt. `kind` only picks the destination folder.
 */
export async function saveReceiptFile(
  file: File,
  kind: ReceiptKind,
): Promise<{ fileUrl: string; fileName: string; fileType: string }> {
  const dirName = RECEIPT_DIR[kind];
  const ext = ALLOWED_TYPES[file.type]!.ext;
  const objectPath = `${dirName}/${randomUUID()}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());
  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(objectPath, buffer, {
    contentType: file.type,
    upsert: false,
  });
  if (error) {
    throw error;
  }

  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(objectPath);

  return {
    fileUrl: publicUrl,
    fileName: file.name,
    fileType: file.type,
  };
}

/**
 * Best-effort delete, used to clean up a receipt file already uploaded when
 * the surrounding registration ultimately fails (e.g. the payment/sale
 * transaction errors out after the file was uploaded). Only ever deletes
 * objects that resolve inside the "receipts" bucket's <kind>-receipts/
 * folder -- anything else (a foreign URL) is silently ignored. Failures
 * never throw: losing the orphaned file must never mask the original error.
 */
export async function deleteReceiptFile(fileUrl: string | null | undefined, kind: ReceiptKind) {
  const dirName = RECEIPT_DIR[kind];
  const publicPrefix = `/storage/v1/object/public/${BUCKET}/${dirName}/`;

  if (!fileUrl) {
    return;
  }
  const prefixIndex = fileUrl.indexOf(publicPrefix);
  if (prefixIndex === -1) {
    return;
  }

  const objectPath = fileUrl.slice(prefixIndex + `/storage/v1/object/public/${BUCKET}/`.length);

  try {
    await supabaseAdmin.storage.from(BUCKET).remove([`${dirName}/${path.basename(objectPath)}`]);
  } catch {
    // Already gone or otherwise inaccessible -- not fatal.
  }
}
