import { StatusBadge, type StatusTone } from "@/components/ui/status-badge";
import { UserRole } from "@/generated/prisma/enums";
import { ROLE_LABELS } from "@/lib/auth/rbac";

// Reuses ROLE_LABELS (rbac.ts) for the text -- roles are defined exactly
// once, in rbac.ts, never restated here. Only the visual tone per role is
// new.
const ROLE_TONE: Record<UserRole, StatusTone> = {
  ADMIN: "pending",
  ACCOUNTANT: "warning",
  SELLER: "neutral",
};

export function UserRoleBadge({ role }: { role: UserRole }) {
  return <StatusBadge tone={ROLE_TONE[role]}>{ROLE_LABELS[role]}</StatusBadge>;
}
