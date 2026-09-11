import { forwardRef, useId, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  error?: string;
  helperText?: string;
  wrapperClassName?: string;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, error, helperText, required, disabled, className, wrapperClassName, id, children, ...props },
  ref,
) {
  const generatedId = useId();
  const selectId = id ?? generatedId;

  return (
    <div className={cn("flex flex-col gap-1.5", wrapperClassName)}>
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-foreground">
          {label}
          {required && <span className="ml-0.5 text-error">*</span>}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        disabled={disabled}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? `${selectId}-error` : helperText ? `${selectId}-helper` : undefined}
        className={cn(
          "w-full rounded-md border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors focus:ring-2",
          error
            ? "border-error focus:border-error focus:ring-error/20"
            : "border-border focus:border-primary focus:ring-primary/20",
          disabled && "cursor-not-allowed bg-black/[0.02] text-muted-foreground",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      {error ? (
        <p id={`${selectId}-error`} className="text-xs text-error">
          {error}
        </p>
      ) : helperText ? (
        <p id={`${selectId}-helper`} className="text-xs text-muted-foreground">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});
