"use client";

import * as React from "react";
import { LogIn } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSolidSession } from "@/components/auth/solid-session-provider";
import { normalizeIssuer } from "@/lib/solid-session";
import { cn } from "@/lib/utils";

const PROVIDER_PRESETS = [
  { label: "Solid Community", issuer: "https://solidcommunity.net" },
  { label: "Inrupt PodSpaces", issuer: "https://login.inrupt.com" },
  { label: "Inrupt Community", issuer: "https://inrupt.net" },
];

interface SolidLoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SolidLoginDialog({ open, onOpenChange }: SolidLoginDialogProps) {
  const { signIn } = useSolidSession();
  const [issuer, setIssuer] = React.useState(PROVIDER_PRESETS[0].issuer);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setError(null);
      setSubmitting(false);
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const validation = normalizeIssuer(issuer);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      await signIn(validation.issuer);
    } catch {
      setError(
        "Tidak dapat menghubungi penyedia identitas. Periksa URL lalu coba lagi."
      );
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[460px] p-6 bg-[#fffefa] border border-[#dce6ce] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-serif font-normal text-foreground">
            Masuk dengan Solid
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Pilih penyedia identitas Solid Anda. Proses masuk berlangsung di
            halaman penyedia tersebut; CollabPod AI tidak menerima kata sandi Anda.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-foreground block">
              Penyedia identitas umum
            </span>
            <div className="flex flex-wrap gap-2">
              {PROVIDER_PRESETS.map((provider) => {
                const isSelected = issuer === provider.issuer;
                return (
                  <button
                    key={provider.issuer}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => {
                      setIssuer(provider.issuer);
                      setError(null);
                    }}
                    className={cn(
                      "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors select-none",
                      isSelected
                        ? "border-[#53643e] bg-[#edf2e4] text-[#4d6037] font-semibold"
                        : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {provider.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="solid-issuer"
              className="text-xs font-semibold text-foreground"
            >
              URL penyedia identitas (IdP)
            </label>
            <Input
              id="solid-issuer"
              type="url"
              inputMode="url"
              autoComplete="url"
              spellCheck={false}
              placeholder="https://solidcommunity.net"
              value={issuer}
              onChange={(event) => {
                setIssuer(event.target.value);
                if (error) setError(null);
              }}
              aria-describedby={error ? "solid-issuer-error" : "solid-issuer-hint"}
              autoFocus
              className={error ? "border-rose-400" : ""}
            />
            {error ? (
              <p
                id="solid-issuer-error"
                role="alert"
                className="text-xs text-rose-700 leading-snug"
              >
                {error}
              </p>
            ) : (
              <p
                id="solid-issuer-hint"
                className="text-[11px] text-muted-foreground leading-snug"
              >
                Contoh: https://solidcommunity.net atau http://localhost:3001 untuk server Solid lokal.
              </p>
            )}
          </div>

          <div className="rounded-xl bg-[#edf2e4] p-3 border border-[#dce6ce] text-[11px] text-[#53643e] leading-relaxed">
            <strong className="font-semibold text-[#374426]">Catatan privasi:</strong>{" "}
            Sesi dan token Solid dikelola langsung di peramban pengguna. Semua akses ke Pod menggunakan WAC standar Solid Protocol.
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleOpenChange(false)}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={submitting}>
              <LogIn className="w-4 h-4" />
              {submitting ? "Mengalihkan…" : "Lanjutkan ke penyedia"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
