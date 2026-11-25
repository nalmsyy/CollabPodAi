"use client";

import * as React from "react";
import Link from "next/link";
import { dashboardNavigation } from "./dashboard-navigation";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { SessionAccountPanel } from "@/components/auth/session-account-panel";

interface MobileNavProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequestLogin: () => void;
  tab?: string;
  pending?: number;
}

export function MobileNav({
  open,
  onOpenChange,
  onRequestLogin,
  tab = "all",
  pending = 0,
}: MobileNavProps) {
  const navItems = dashboardNavigation.map((item) => ({
    ...item,
    active: tab === item.tab,
  }));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="p-0 flex flex-col w-[260px] bg-sidebar border-r border-border"
      >
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
                    aria-current={item.active ? "page" : undefined}
                    onClick={() => onOpenChange(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-[13px] transition-colors",
                      item.active
                        ? "bg-[#e3e8d8] text-[#4d6037] font-[550]"
                        : "text-[#6d785f] hover:bg-[#e9edd8]",
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-[16px] h-[16px] shrink-0",
                        item.active ? "text-[#4d6037]" : "text-[#8a9a7a]",
                      )}
                      strokeWidth={item.active ? 2 : 1.75}
                    />
                    <span>{item.label}</span>
                    {item.tab === "invites" && pending > 0 && (
                      <small className="invite-count">{pending}</small>
                    )}
                  </Link>
                );
              })}
            </nav>
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
