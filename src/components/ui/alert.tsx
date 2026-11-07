import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-xl border p-4 text-sm leading-relaxed [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground [&>svg+div]:translate-y-[-3px] [&:has(svg)]:pl-11",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground border-border",
        info: "bg-primary/10 border-primary/25 text-foreground [&>svg]:text-primary",
        warning:
          "bg-amber-500/10 border-amber-400/30 text-amber-100 [&>svg]:text-amber-300",
        success:
          "bg-emerald-500/10 border-emerald-400/30 text-emerald-100 [&>svg]:text-emerald-300",
        destructive:
          "bg-rose-500/10 border-rose-400/30 text-rose-100 [&>svg]:text-rose-300",
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
