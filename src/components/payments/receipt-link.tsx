import { FileText, FileWarning } from "lucide-react";

// `fileUrl` normally comes from PaymentReceipt/SaleReceipt.fileUrl, written
// server-side (see receipt-storage.ts) as the public Supabase Storage URL
// for an uploaded file -- never built from a user-supplied filename or
// query param, so linking directly to it is safe. Opens in a new tab:
// images render inline, PDFs open in the browser's native viewer.
//
// A handful of receipts created right before the Supabase Storage
// migration still store the old local-disk-style relative path (e.g.
// "/uploads/payment-receipts/<file>.jpg") instead of a full URL -- those
// files lived on the previous ephemeral-disk storage and no longer exist
// anywhere (confirmed against the "receipts" bucket, not just assumed), so
// linking to that path would just hit Next.js's own 404 page. Detecting
// that case here and showing a clear "unavailable" state avoids that
// confusing dead link without touching storage/upload logic or the DB.
export function ReceiptLink({ fileUrl }: { fileUrl: string }) {
  const isAbsoluteUrl = /^https?:\/\//i.test(fileUrl);

  if (!isAbsoluteUrl) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground"
        title="Este comprobante se subió antes de la migración a Supabase Storage y el archivo original ya no existe."
      >
        <FileWarning className="size-3.5" aria-hidden />
        Comprobante no disponible
      </span>
    );
  }

  return (
    <a
      href={fileUrl}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors hover:underline"
    >
      <FileText className="size-3.5" aria-hidden />
      Ver comprobante
    </a>
  );
}
