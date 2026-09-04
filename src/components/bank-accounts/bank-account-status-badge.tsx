import { StatusBadge } from "@/components/ui/status-badge";

export function BankAccountStatusBadge({ active }: { active: boolean }) {
  return <StatusBadge tone={active ? "success" : "neutral"}>{active ? "Activa" : "Inactiva"}</StatusBadge>;
}
