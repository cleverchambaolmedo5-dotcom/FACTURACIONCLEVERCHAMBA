"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// Visual wrapper only -- introduced so future modals can share one look
// instead of each reimplementing overlay/close/shadow markup. Existing
// modals (ModulesConfirmModal, CustomerCreateModal, delete confirmations,
// etc.) are intentionally NOT migrated to this yet: they each have their
// own close/submit behavior and are left untouched this phase.
export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
};

export function Modal({ open, onClose, title, description, children, footer, className }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const generatedTitleId = useId();
  const titleId = title ? generatedTitleId : undefined;

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    dialogRef.current?.focus();
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className={cn(
          "w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-modal outline-none",
          className,
        )}
      >
        {(title || description) && (
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="space-y-1">
              {title && (
                <h2 id={titleId} className="text-base font-semibold text-foreground">
                  {title}
                </h2>
              )}
              {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-black/[0.04] hover:text-foreground"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        )}

        {children}

        {footer && <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div>}
      </div>
    </div>
  );
}
