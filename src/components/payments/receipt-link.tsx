import { FileText } from "lucide-react";

// `fileUrl` always comes from PaymentReceipt.fileUrl, which is only ever
// written server-side (see receipt-storage.ts) as a relative
// "/uploads/payment-receipts/<uuid>.<ext>" path -- never built from a
// user-supplied filename or query param, so linking directly to it is
// safe. Opens in a new tab: images render inline, PDFs open in the
// browser's native viewer.
export function ReceiptLink({ fileUrl }: { fileUrl: string }) {
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
