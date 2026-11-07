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
      // Berhasil berarti browser sudah dialihkan ke halaman penyedia identitas.
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
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Masuk dengan Solid</DialogTitle>
          <DialogDescription>
            Pilih penyedia identitas Solid Anda. Proses masuk berlangsung di
            halaman penyedia tersebut; CollabPod AI tidak menerima kata sandi
            Anda.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
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
                      "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card",
                      isSelected
                        ? "border-primary bg-primary/15 text-foreground ring-1 ring-primary"
                        : "border-border bg-background/40 text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
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
              error={!!error}
              aria-describedby={error ? "solid-issuer-error" : "solid-issuer-hint"}
              autoFocus
            />
            {error ? (
              <p
                id="solid-issuer-error"
                role="alert"
                className="text-xs text-rose-300 leading-snug"
              >
                {error}
              </p>
            ) : (
              <p
                id="solid-issuer-hint"
                className="text-[11px] text-muted-foreground leading-snug"
              >
                Contoh: https://solidcommunity.net atau http://localhost:3001
                untuk server Solid lokal.
              </p>
            )}
          </div>

          <div className="rounded-lg bg-primary/10 p-2.5 border border-primary/25 text-[11px] text-muted-foreground leading-normal">
            <strong className="font-semibold text-foreground">Catatan:</strong>{" "}
            Setelah masuk, dashboard menampilkan WebID Anda. Penyimpanan proyek
            ke Pod belum aktif pada tahap ini.
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Batal
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              <LogIn className="w-4 h-4" />
              {submitting ? "Mengalihkan…" : "Lanjutkan ke penyedia"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
