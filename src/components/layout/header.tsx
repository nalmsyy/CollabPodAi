"use client";

import * as React from "react";
import { Menu, Folder } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  onOpenMobileNav: () => void;
  breadcrumb?: { label: string; href?: string }[];
}

export function Header({ onOpenMobileNav, breadcrumb }: HeaderProps) {
  return (
    <header className="h-[62px] border-b border-border bg-background sticky top-0 z-30 px-6 sm:px-9 flex items-center justify-between">
      {/* Kiri: Menu mobile + breadcrumb */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden text-muted-foreground hover:text-foreground"
          onClick={onOpenMobileNav}
          aria-label="Buka menu navigasi"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
          <Folder className="w-4 h-4" aria-hidden />
          <span>Proyek</span>
          {breadcrumb?.map((crumb, i) => (
            <React.Fragment key={i}>
              <span className="text-muted-foreground/50">›</span>
              <span className={i === breadcrumb.length - 1 ? "text-foreground font-medium" : ""}>
                {crumb.label}
              </span>
            </React.Fragment>
          ))}
        </nav>

        {/* Mobile brand */}
        <div className="flex items-center gap-2 md:hidden">
          <span className="font-bold text-foreground text-sm tracking-tight">
            collabpod<span style={{ color: "#6a7b54" }}>.</span>
          </span>
        </div>
      </div>

      {/* Kanan: Status */}
      <div className="flex items-center gap-3">
        <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="w-1.5 h-1.5 rounded-full bg-[#8fa870]" aria-hidden />
          Prototipe interaktif
        </span>
      </div>
    </header>
  );
}
