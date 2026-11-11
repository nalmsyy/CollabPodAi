"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderKanban, Sparkles, BookOpen, Layers } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { SessionAccountPanel } from "@/components/auth/session-account-panel";

interface MobileNavProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequestLogin: () => void;
}

export function MobileNav({ open, onOpenChange, onRequestLogin }: MobileNavProps) {
  const pathname = usePathname();

  const navItems = [
    {
      label: "Semua proyek",
      href: "/dashboard",
      icon: FolderKanban,
      active: pathname === "/dashboard" || pathname === "/",
    },
  ];

  const futureModules = [
    { label: "Dokumen Riset", icon: BookOpen, tag: "Tahap 2" },
    { label: "Papan Tugas Tim", icon: Layers, tag: "Tahap 3" },
    { label: "Asisten AI Pod", icon: Sparkles, tag: "Tahap 4" },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="p-0 flex flex-col w-[260px] bg-sidebar border-r border-border">
        {/* Brand Header */}
        <SheetHeader className="h-16 px-5 flex flex-row items-center border-b border-border pb-0">
          <SheetTitle asChild>
            <div className="flex items-center gap-2.5">
              <div className="flex items-baseline gap-1.5">
                <span
                  className="text-[20px] font-bold tracking-[-1.2px] text-foreground leading-none"
                  style={{ fontWeight: 650 }}
                >
                  collabpod
                  <span style={{ color: "#6a7b54" }}>.</span>
                </span>
                <span
                  className="text-[8px] tracking-[1px] uppercase font-medium"
                  style={{ color: "#707864" }}
                >
                  BETA
                </span>
              </div>
            </div>
          </SheetTitle>
        </SheetHeader>

        {/* Navigation */}
        <div className="flex-1 px-4 py-4 space-y-5 overflow-y-auto">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2 px-2">
              Ruang Kerja
            </p>
            <nav className="space-y-0.5" aria-label="Navigasi mobile">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => onOpenChange(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] transition-colors",
                      item.active
                        ? "bg-[#e3e8d8] text-[#4d6037] font-[550]"
                        : "text-[#6d785f] hover:bg-[#e9edd8]"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-[16px] h-[16px] shrink-0",
                        item.active ? "text-[#4d6037]" : "text-[#8a9a7a]"
                      )}
                      strokeWidth={item.active ? 2 : 1.75}
                    />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2 px-2">
              Modul Berikutnya
            </p>
            <div className="space-y-0.5">
              {futureModules.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-md px-3 py-2.5 text-[13px] text-muted-foreground/60 cursor-not-allowed"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-[16px] h-[16px] shrink-0" />
                      <span>{item.label}</span>
                    </div>
                    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                      {item.tag}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Akun */}
        <div className="border-t border-border px-4 py-4">
          <SessionAccountPanel
            onRequestLogin={() => {
              onOpenChange(false);
              window.setTimeout(onRequestLogin, 200);
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
