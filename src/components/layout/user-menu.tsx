"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, KeyRound, LayoutGrid, LogOut, UserRound } from "lucide-react";
import { logout } from "@/lib/auth/actions";
import type { PublicUser } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { UserIdentity } from "./user-identity";
import { ModulesConfirmModal } from "./modules-confirm-modal";

// Reuses the existing `logout` Server Action -- this component only adds
// the dropdown UI around it, no authentication logic of its own. "Módulos"
// goes through ModulesConfirmModal instead of navigating directly, since
// leaving for "/" requires ending the session first (see
// logoutToModules in lib/auth/actions.ts).
export function UserMenu({ user }: { user: PublicUser }) {
  const [open, setOpen] = useState(false);
  const [modulesModalOpen, setModulesModalOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-md p-1.5 pr-2 text-left transition-colors hover:bg-black/5"
      >
        <UserIdentity user={user} />
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-56 rounded-md border border-border bg-surface py-1 shadow-md"
        >
          <div className="border-b border-border px-3 py-2">
            <UserIdentity user={user} />
          </div>

          <div className="border-b border-border py-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                setModulesModalOpen(true);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-black/5"
            >
              <LayoutGrid className="size-4" aria-hidden />
              Módulos
            </button>
          </div>

          <div className="border-b border-border py-1">
            <Link
              href="/perfil"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-foreground transition-colors hover:bg-black/5"
            >
              <UserRound className="size-4" aria-hidden />
              Mi perfil
            </Link>
            <Link
              href="/perfil#seguridad"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-foreground transition-colors hover:bg-black/5"
            >
              <KeyRound className="size-4" aria-hidden />
              Cambiar contraseña
            </Link>
          </div>

          <form action={logout}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-error transition-colors hover:bg-error/10"
            >
              <LogOut className="size-4" aria-hidden />
              Cerrar sesión
            </button>
          </form>
        </div>
      )}

      {modulesModalOpen && (
        <ModulesConfirmModal onClose={() => setModulesModalOpen(false)} />
      )}
    </div>
  );
}
