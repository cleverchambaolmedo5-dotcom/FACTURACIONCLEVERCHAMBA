import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { PaymentValidationStatus } from "@/generated/prisma/enums";

export const VALIDATION_STATUS_TONE: Record<PaymentValidationStatus, StatusTone> = {
  PENDING_VALIDATION: "pending",
  APPROVED: "success",
  REJECTED: "error",
};

export const VALIDATION_STATUS_LABELS: Record<PaymentValidationStatus, string> = {
  PENDING_VALIDATION: "Pendiente",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
};

export function ValidationStatusBadge({ status }: { status: PaymentValidationStatus }) {
  return (
    <StatusBadge tone={VALIDATION_STATUS_TONE[status]}>
      {VALIDATION_STATUS_LABELS[status]}
    </StatusBadge>
  );
}
