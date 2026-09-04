import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { InvestmentStatus } from "@/generated/prisma/enums";

export const INVESTMENT_STATUS_TONE: Record<InvestmentStatus, StatusTone> = {
  PENDING_VALIDATION: "pending",
  ACTIVE: "success",
  MATURED: "warning",
  COMPLETED: "neutral",
  REJECTED: "error",
  CANCELLED: "neutral",
};

export const INVESTMENT_STATUS_LABELS: Record<InvestmentStatus, string> = {
  PENDING_VALIDATION: "Pendiente de validación",
  ACTIVE: "Activa",
  MATURED: "Vencida",
  COMPLETED: "Completada",
  REJECTED: "Rechazada",
  CANCELLED: "Cancelada",
};

export function InvestmentStatusBadge({ status }: { status: InvestmentStatus }) {
  return (
    <StatusBadge tone={INVESTMENT_STATUS_TONE[status]}>
      {INVESTMENT_STATUS_LABELS[status]}
    </StatusBadge>
  );
}
