import { StatusBadge } from "@/components/ui/status-badge";

export function ProductStatusBadge({ active }: { active: boolean }) {
  return <StatusBadge tone={active ? "success" : "neutral"}>{active ? "Activo" : "Inactivo"}</StatusBadge>;
}
