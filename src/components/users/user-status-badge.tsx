import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { UserStatus } from "@/generated/prisma/enums";

export const USER_STATUS_TONE: Record<UserStatus, StatusTone> = {
  ACTIVE: "success",
  INACTIVE: "neutral",
};

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: "Activo",
  INACTIVE: "Inactivo",
};

export function UserStatusBadge({ status }: { status: UserStatus }) {
  return <StatusBadge tone={USER_STATUS_TONE[status]}>{USER_STATUS_LABELS[status]}</StatusBadge>;
}
