import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { ProjectRole } from "@/types/project";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors select-none",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-xs",
        secondary:
          "border-border bg-secondary text-secondary-foreground",
        outline: "border-border bg-transparent text-foreground",
        teal: "border-primary/30 bg-primary/15 text-primary",
        indigo: "border-indigo-400/30 bg-indigo-500/15 text-indigo-200",
        amber: "border-amber-400/30 bg-amber-500/10 text-amber-200",
        slate: "border-border bg-secondary/70 text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export function RoleBadge({ role, className }: { role: ProjectRole; className?: string }) {
  if (role === "Owner") {
    return (
      <Badge variant="teal" className={cn("font-medium tracking-tight", className)}>
        Owner
      </Badge>
    );
  }
  if (role === "Editor") {
    return (
      <Badge variant="indigo" className={cn("font-medium tracking-tight", className)}>
        Editor
      </Badge>
    );
  }
  return (
    <Badge variant="slate" className={cn("font-medium tracking-tight", className)}>
      Viewer
    </Badge>
  );
}
