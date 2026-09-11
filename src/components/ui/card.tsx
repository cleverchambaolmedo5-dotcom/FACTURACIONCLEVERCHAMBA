import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const PADDING_CLASSES = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
} as const;

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  padding?: keyof typeof PADDING_CLASSES;
};

// Base surface for every future KPI/section card: white background, soft
// border, modern radius, very light shadow -- never the heavier default
// Tailwind shadow weights.
export function Card({ padding = "md", className, ...props }: CardProps) {
  return (
    <div
      className={cn("rounded-lg border border-border bg-surface shadow-card", PADDING_CLASSES[padding], className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center justify-between gap-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-sm font-semibold text-foreground", className)} {...props} />;
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xs text-muted-foreground", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-4", className)} {...props} />;
}
