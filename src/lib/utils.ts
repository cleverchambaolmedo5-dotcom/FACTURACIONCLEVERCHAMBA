import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// Merge conditional class names and resolve conflicting Tailwind classes.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Reusable initials generator for avatar fallbacks (Header, Sidebar, user
// menu, profile page). A single word yields one letter ("Administrador" ->
// "A"); two or more words use the first letter of the first two ("Jason
// Alexander" -> "JA", "Vendedor 1" -> "V1").
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}
