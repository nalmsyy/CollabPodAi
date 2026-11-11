import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 select-none rounded-lg cursor-pointer",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground hover:bg-primary-hover active:brightness-95 shadow-sm",
        secondary:
          "bg-secondary text-secondary-foreground border border-border hover:bg-accent active:bg-accent",
        outline:
          "border border-border bg-transparent text-foreground hover:bg-secondary hover:text-foreground active:bg-accent",
        ghost:
          "text-muted-foreground hover:bg-secondary hover:text-foreground active:bg-accent",
        destructive:
          "bg-destructive text-destructive-foreground hover:brightness-110 active:brightness-95",
        subtleTeal:
          "bg-primary/10 text-primary border border-primary/25 hover:bg-primary/20",
        link:
          "text-primary underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        sm: "h-8 px-3 text-xs rounded-md",
        md: "h-9 px-4 py-2 text-sm",
        lg: "h-10 px-5 text-sm font-semibold",
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
