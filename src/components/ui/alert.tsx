import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-xl border p-4 text-sm leading-relaxed [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg+div]:translate-y-[-3px] [&:has(svg)]:pl-11",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground border-border",
        info: "bg-primary/8 border-primary/25 text-foreground [&>svg]:text-primary",
        warning:
          "bg-amber-50 border-amber-300/50 text-amber-900 [&>svg]:text-amber-600",
        success:
          "bg-emerald-50 border-emerald-300/50 text-emerald-900 [&>svg]:text-emerald-600",
        destructive:
          "bg-rose-50 border-rose-300/50 text-rose-900 [&>svg]:text-rose-600",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

export function Alert({ className, variant, ...props }: AlertProps) {
  return (
    <div
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

export function AlertTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h5
      className={cn("mb-1 font-semibold leading-tight tracking-tight", className)}
      {...props}
    />
  );
}

export function AlertDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <div
      className={cn("text-xs md:text-sm text-muted-foreground [&_p]:leading-relaxed", className)}
      {...props}
    />
  );
}
