"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderKanban, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { SessionAccountPanel } from "@/components/auth/session-account-panel";

interface SidebarProps {
  className?: string;
  onRequestLogin: () => void;
}

/** Logo mark CollabPod — tiga daun miring seperti referensi */
function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn("relative inline-block w-7 h-7 shrink-0", className)}
      aria-hidden="true"
    >
      {/* Tiga "daun" – div dengan border-radius asimetris dan rotasi */}
      <i
        className="absolute rounded-tl-[8px] rounded-tr-[8px] rounded-bl-[3px] rounded-br-[3px]"
        style={{
          background: "#53643e",
          width: "11px",
          height: "17px",
          top: 0,
          left: "2px",
          transform: "rotate(-40deg)",
          transformOrigin: "center",
        }}
      />
      <i
        className="absolute rounded-tl-[8px] rounded-tr-[8px] rounded-bl-[3px] rounded-br-[3px]"
        style={{
          background: "#7e8d6b",
          width: "11px",
          height: "17px",
          top: "7px",
          left: "13px",
          transform: "rotate(70deg)",
          transformOrigin: "center",
        }}
      />
      <i
        className="absolute rounded-tl-[8px] rounded-tr-[8px] rounded-bl-[3px] rounded-br-[3px]"
        style={{
          background: "#a6b684",
          width: "11px",
          height: "17px",
          top: "12px",
          left: 0,
          transform: "rotate(-150deg)",
          transformOrigin: "center",
        }}
      />
    </span>
  );
}

export function Sidebar({ className, onRequestLogin }: SidebarProps) {
  const pathname = usePathname();

  const navItems = [
    {
      label: "Semua proyek",
      href: "/dashboard",
      icon: FolderKanban,
      active: pathname === "/dashboard" || pathname === "/",
    },
  ];

  return (
    <aside
      className={cn(
        "flex flex-col w-[238px] shrink-0 border-r border-border min-h-screen select-none overflow-y-auto",
        "bg-sidebar",
        className
      )}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 pt-7 mb-7">
        <BrandMark />
        <div className="flex items-baseline gap-1.5">
          <span
            className="text-[22px] font-bold tracking-[-1.2px] text-foreground leading-none"
            style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 650 }}
          >
            collabpod
            <span style={{ color: "#6a7b54" }}>.</span>
          </span>
          <span
            className="text-[8px] tracking-[1px] uppercase font-medium mt-[-4px]"
            style={{ color: "#707864", alignSelf: "flex-start" }}
          >
            BETA
          </span>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 px-[18px] space-y-1 pb-4">
        {/* Label section */}
        <p className="px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 mt-2">
          Ruang Kerja
        </p>

        <nav className="space-y-0.5" aria-label="Navigasi utama">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-3 w-full px-3 py-2.5 text-sm rounded-md transition-colors",
                  item.active
                    ? "bg-[#e3e8d8] text-[#4d6037] font-[550]"
                    : "text-[#6d785f] hover:bg-[#e9edd8] hover:text-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "w-[17px] h-[17px] shrink-0",
                    item.active ? "text-[#4d6037]" : "text-[#8a9a7a]"
                  )}
                  strokeWidth={item.active ? 2 : 1.75}
                />
                <span className="flex-1 text-left text-[13px]">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Pod Summary di bawah */}
      <div className="mt-auto pt-4 px-[18px] pb-4 space-y-3">
        <button
          className="w-full text-left flex items-start gap-3 rounded-lg border border-[#dfe6d2] bg-[#edf1e5] px-3 py-3.5 transition-colors hover:bg-[#e5ead9] text-[#697c56]"
          onClick={onRequestLogin}
          type="button"
          aria-label="Kelola koneksi Pod Solid"
        >
          <Database className="w-5 h-5 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <strong className="block text-[11px] font-[550] text-[#5d7148]">
              Data tetap milikmu
            </strong>
            <span className="text-[10px] mt-1 flex items-center gap-1 text-[#7c8f69]">
              Kelola koneksi Pod ↗
            </span>
          </div>
        </button>

        <SessionAccountPanel className="px-1 pb-1" onRequestLogin={onRequestLogin} />
      </div>
    </aside>
  );
}
