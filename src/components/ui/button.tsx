import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 select-none",
  {
    variants: {
      variant: {
        primary:
          "gradient-primary text-primary-foreground shadow-sm font-semibold hover:brightness-110 active:brightness-95",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-accent active:bg-border",
        outline:
          "border border-border bg-transparent text-foreground shadow-xs hover:bg-secondary hover:text-foreground active:bg-accent",
        ghost:
          "text-muted-foreground hover:bg-secondary hover:text-foreground active:bg-accent",
        destructive:
          "bg-rose-500 text-rose-950 shadow-xs hover:bg-rose-400 active:bg-rose-300",
        subtleTeal:
          "bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25",
      },
      size: {
        sm: "h-8 px-3 text-xs rounded-md",
        md: "h-9 px-4 py-2 text-sm",
        lg: "h-10 px-5 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
