import { forwardRef, useId, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  error?: string;
  helperText?: string;
  wrapperClassName?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, helperText, required, disabled, className, wrapperClassName, id, ...props },
  ref,
) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;

  return (
    <div className={cn("flex flex-col gap-1.5", wrapperClassName)}>
      {label && (
        <label htmlFor={textareaId} className="text-sm font-medium text-foreground">
          {label}
          {required && <span className="ml-0.5 text-error">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        id={textareaId}
        disabled={disabled}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? `${textareaId}-error` : helperText ? `${textareaId}-helper` : undefined}
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
        <p id={`${textareaId}-error`} className="text-xs text-error">
          {error}
        </p>
      ) : helperText ? (
        <p id={`${textareaId}-helper`} className="text-xs text-muted-foreground">
          {helperText}
        </p>
      ) : null}
    </div>
  );
});
