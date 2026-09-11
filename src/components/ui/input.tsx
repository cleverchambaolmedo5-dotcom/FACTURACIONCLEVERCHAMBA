import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// Presentation only -- no validation rules live here. Forms keep using
// useActionState + server-returned error strings exactly as before; this
// component only renders whatever `error` string it's given.
export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  helperText?: string;
  wrapperClassName?: string;
};

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, helperText, required, disabled, className, wrapperClassName, id, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className={cn("flex flex-col gap-1.5", wrapperClassName)}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-foreground">
          {label}
          {required && <span className="ml-0.5 text-error">*</span>}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        disabled={disabled}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
        className={cn(
          "w-full rounded-md border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:ring-2",
          error
            ? "border-error focus:border-error focus:ring-error/20"
            : "border-border focus:border-primary focus:ring-primary/20",
          disabled && "cursor-not-allowed bg-black/[0.02] text-muted-foreground",
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={`${inputId}-error`} className="text-xs text-error">
          {error}
        </p>
      ) : helperText ? (
        <p id={`${inputId}-helper`} className="text-xs text-muted-foreground">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});
