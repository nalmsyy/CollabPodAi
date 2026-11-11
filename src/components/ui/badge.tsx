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
          "border-transparent bg-primary text-primary-foreground",
        secondary:
          "border-border bg-secondary text-secondary-foreground",
        outline: "border-border bg-transparent text-foreground",
        teal: "border-primary/30 bg-primary/10 text-primary",
        indigo: "border-[#4a7c59]/30 bg-[#4a7c59]/10 text-[#3a6349]",
        amber: "border-amber-600/30 bg-amber-100 text-amber-800",
        slate: "border-border bg-secondary/70 text-muted-foreground",
        olive: "border-[#8fa870]/40 bg-[#edf0e5] text-[#53643e]",
        success: "border-emerald-600/30 bg-emerald-50 text-emerald-800",
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
