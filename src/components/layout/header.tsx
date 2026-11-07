"use client";

import * as React from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface HeaderProps {
  onOpenMobileNav: () => void;
}

export function Header({ onOpenMobileNav }: HeaderProps) {
  return (
    <header className="h-16 border-b border-border bg-background/85 backdrop-blur-xs sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden text-foreground hover:text-foreground"
          onClick={onOpenMobileNav}
          aria-label="Buka menu navigasi"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2 md:hidden">
          <div className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">
            CP
          </div>
          <span className="font-semibold text-foreground text-sm">
            CollabPod AI
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Badge
          variant="amber"
          className="hidden sm:inline-flex items-center gap-1.5 py-1 px-2.5 text-xs font-medium"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          Tahap 2B: Pod Discovery
        </Badge>
        <div className="text-xs text-muted-foreground hidden lg:block">
          Solid Pod Architecture • WebID &amp; Pod Discovery
        </div>
      </div>
    </header>
  );
}
