"use client";

import * as React from "react";
import { Loader2, LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSolidSession } from "@/components/auth/solid-session-provider";
import { cn } from "@/lib/utils";

interface SessionAccountPanelProps {
  onRequestLogin: () => void;
  className?: string;
}

/**
 * Bagian akun pada sidebar/drawer: profil pengguna dengan gaya minimalis referensi
 */
export function SessionAccountPanel({
  onRequestLogin,
  className,
}: SessionAccountPanelProps) {
  const { status, webId, error, signOut, clearError } = useSolidSession();

  if (status === "restoring") {
    return (
      <div className={cn("pt-2", className)}>
        <div
          className="flex items-center gap-2 text-xs text-muted-foreground"
          aria-live="polite"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          <span>Memeriksa sesi…</span>
        </div>
      </div>
    );
  }

  if (status === "signed-in") {
    // Ambil inisial atau nama pendek dari webId
    const displayInitial = webId ? webId.split("/").filter(Boolean).pop()?.charAt(0).toUpperCase() || "S" : "S";
    const displayName = webId ? webId.replace(/^https?:\/\//, "").split("/")[0] : "Solid User";

    return (
      <div className={cn("pt-2 space-y-2", className)}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#dce6ce] text-[#53643e] font-semibold text-xs flex items-center justify-center shrink-0">
            {displayInitial}
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-xs font-semibold text-foreground block truncate">
              {displayName}
            </span>
            <span
              className="text-[10px] text-muted-foreground truncate block"
              title={webId ?? undefined}
            >
              Solid Pod · Owner
            </span>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-[10px] text-rose-700 leading-snug">
            {error}
          </p>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full h-7 text-xs"
          onClick={() => {
            void signOut();
          }}
        >
          <LogOut className="w-3 h-3" />
          Keluar
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("pt-2 space-y-2", className)}>
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-[#e3ecda] text-[#53643e] font-semibold text-xs flex items-center justify-center shrink-0">
          D
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-xs font-semibold text-foreground block truncate">
            Pengguna Demo
          </span>
          <span className="text-[10px] text-muted-foreground block truncate">
            Akun lokal · Mode demo
          </span>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-[10px] text-rose-700 leading-snug">
          {error}
        </p>
      )}

      <Button
        variant="primary"
        size="sm"
        className="w-full h-8 text-xs font-medium"
        onClick={() => {
          clearError();
          onRequestLogin();
        }}
      >
        <LogIn className="w-3.5 h-3.5" />
        {error ? "Coba lagi" : "Masuk dengan Solid"}
      </Button>
    </div>
  );
}
