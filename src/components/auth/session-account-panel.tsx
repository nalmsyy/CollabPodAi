"use client";

import * as React from "react";
import { Loader2, LogIn, LogOut, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSolidSession } from "@/components/auth/solid-session-provider";
import { cn } from "@/lib/utils";

interface SessionAccountPanelProps {
  onRequestLogin: () => void;
  className?: string;
}

/**
 * Bagian akun pada sidebar/drawer: menampilkan mode demo, sesi Solid aktif,
 * atau pesan gagal masuk dengan pilihan mencoba lagi.
 */
export function SessionAccountPanel({
  onRequestLogin,
  className,
}: SessionAccountPanelProps) {
  const { status, webId, error, signOut, clearError } = useSolidSession();

  if (status === "restoring") {
    return (
      <div className={cn("border-t border-border bg-background/40", className)}>
        <div
          className="flex items-center gap-2 text-[11px] text-muted-foreground"
          aria-live="polite"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          <span>Memeriksa sesi Solid…</span>
        </div>
      </div>
    );
  }

  if (status === "signed-in") {
    return (
      <div className={cn("border-t border-border bg-background/40", className)}>
        <div className="space-y-2.5" aria-live="polite">
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 shrink-0 rounded-full bg-primary/20 text-primary border border-primary/40 flex items-center justify-center font-semibold text-xs">
              S
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-semibold text-foreground block">
                Sesi Solid aktif
              </span>
              <span
                className="text-[10px] font-mono text-muted-foreground break-all line-clamp-2 mt-0.5 block"
                title={webId ?? undefined}
              >
                {webId ?? "WebID tidak tersedia"}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-1.5 text-[11px] text-amber-300">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>Proyek disimpan di Pod terpilih</span>
          </div>

          {error && (
            <p role="alert" className="text-[11px] text-rose-300 leading-snug">
              {error}
            </p>
          )}

          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              void signOut();
            }}
          >
            <LogOut className="w-3.5 h-3.5" />
            Keluar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("border-t border-border bg-background/40", className)}>
      <div className="space-y-2.5" aria-live="polite">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 shrink-0 rounded-full bg-secondary text-foreground flex items-center justify-center font-medium text-xs">
            A
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-xs font-medium text-foreground truncate">
              Andi (Sesi Demo)
            </span>
            <span className="text-[11px] text-muted-foreground truncate">
              Mode Lokal Browser
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-amber-300">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Data belum tersambung ke Pod</span>
        </div>

        {error && (
          <p role="alert" className="text-[11px] text-rose-300 leading-snug">
            {error}
          </p>
        )}

        <Button
          variant="primary"
          size="sm"
          className="w-full"
          onClick={() => {
            clearError();
            onRequestLogin();
          }}
        >
          <LogIn className="w-3.5 h-3.5" />
          {error ? "Coba lagi" : "Masuk dengan Solid"}
        </Button>
      </div>
    </div>
  );
}
