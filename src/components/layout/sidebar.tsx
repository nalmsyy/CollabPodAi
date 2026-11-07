"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderKanban, Sparkles, BookOpen, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { SessionAccountPanel } from "@/components/auth/session-account-panel";

interface SidebarProps {
  className?: string;
  onRequestLogin: () => void;
}

export function Sidebar({ className, onRequestLogin }: SidebarProps) {
  const pathname = usePathname();

  const navItems = [
    {
      label: "Proyek Saya",
      href: "/dashboard",
      icon: FolderKanban,
      active: pathname === "/dashboard" || pathname === "/",
    },
  ];

  // Fitur masa depan ditampilkan sebagai status pengembangan non-aktif,
  // tidak dijadikan tautan aktif sesuai instruksi.
  const futureModules = [
    { label: "Dokumen Riset", icon: BookOpen, tag: "Tahap 2" },
    { label: "Papan Tugas Tim", icon: Layers, tag: "Tahap 3" },
    { label: "Asisten AI Pod", icon: Sparkles, tag: "Tahap 4" },
  ];

  return (
    <aside
      className={cn(
        "flex flex-col w-60 border-r border-border bg-card min-h-screen select-none",
        className
      )}
    >
      {/* Brand Wordmark */}
      <div className="h-16 flex items-center px-6 border-b border-border">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 group rounded-md"
        >
          <div className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm tracking-tight shadow-xs group-hover:bg-primary-hover transition-colors">
            CP
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-foreground tracking-tight text-base leading-tight">
              CollabPod AI
            </span>
            <span className="text-[11px] text-muted-foreground font-normal">
              Academic Workspace
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <div className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
        <div>
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 mb-2">
            Ruang Kerja
          </p>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                    item.active
                      ? "bg-secondary text-foreground font-semibold"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                  )}
                >
                  {item.active && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-r-full bg-primary"
                    />
                  )}
                  <Icon
                    className={cn(
                      "w-4 h-4",
                      item.active ? "text-primary" : "text-muted-foreground/70"
                    )}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div>
          <p className="px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 mb-2">
            Rencana Modul
          </p>
          <div className="space-y-1">
            {futureModules.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="flex items-center justify-between px-3 py-2 text-sm text-muted-foreground/60 rounded-lg cursor-not-allowed"
                  title="Modul ini direncanakan untuk tahap berikutnya"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-muted-foreground/40" />
                    <span>{item.label}</span>
                  </div>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-secondary text-muted-foreground/80">
                    {item.tag}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Akun: mode demo atau sesi Solid */}
      <SessionAccountPanel className="p-3" onRequestLogin={onRequestLogin} />
    </aside>
  );
}
