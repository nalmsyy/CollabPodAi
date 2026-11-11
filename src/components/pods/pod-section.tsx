"use client";

import * as React from "react";
import {
  CheckCircle2,
  HardDrive,
  Loader2,
  RefreshCw,
  ServerOff,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSolidSession } from "@/components/auth/solid-session-provider";
import { usePodSelection } from "@/components/pods/pod-selection-provider";
import { fetchPodUrls } from "@/lib/solid-pods";
import { cn } from "@/lib/utils";

type PodListState =
  | { phase: "loading" }
  | { phase: "ready"; podUrls: string[] }
  | { phase: "empty" }
  | { phase: "error" };

/**
 * Bagian "Pod saya": membaca alamat Pod dari profil Solid pengguna.
 */
export function PodSection() {
  const { status, webId } = useSolidSession();

  if (status !== "signed-in" || !webId) {
    return null;
  }

  return <PodSectionContent key={webId} webId={webId} />;
}

function PodSectionContent({ webId }: { webId: string }) {
  const { selectedPodUrl, selectPod } = usePodSelection();
  const [state, setState] = React.useState<PodListState>({ phase: "loading" });
  const [reloadToken, setReloadToken] = React.useState(0);
  const requestCounter = React.useRef(0);

  React.useEffect(() => {
    const requestId = ++requestCounter.current;
    let active = true;

    fetchPodUrls(webId)
      .then((podUrls) => {
        if (!active || requestCounter.current !== requestId) return;
        if (podUrls.length === 0) {
          setState({ phase: "empty" });
          selectPod(null);
          return;
        }
        setState({ phase: "ready", podUrls });
        selectPod(podUrls.length === 1 ? podUrls[0] : null);
      })
      .catch(() => {
        if (!active || requestCounter.current !== requestId) return;
        setState({ phase: "error" });
        selectPod(null);
      });

    return () => {
      active = false;
    };
  }, [webId, reloadToken, selectPod]);

  const reload = React.useCallback(() => {
    setState({ phase: "loading" });
    selectPod(null);
    setReloadToken((token) => token + 1);
  }, [selectPod]);

  return (
    <section
      aria-label="Pod saya"
      className="rounded-xl border border-border bg-card p-5 space-y-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 h-8 w-8 shrink-0 rounded-lg bg-[#eef3e6] text-[#53643e] border border-[#dce6ce] flex items-center justify-center">
            <HardDrive className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">
              Pod Saya
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Penyimpanan Solid terhubung untuk workspace dan dokumen Anda.
            </p>
          </div>
        </div>

        {state.phase === "ready" && state.podUrls.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={reload}
            aria-label="Muat ulang daftar Pod"
            className="h-8 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Muat ulang
          </Button>
        )}
      </div>

      {state.phase === "loading" && (
        <div
          className="flex items-center gap-2 text-xs text-muted-foreground py-2"
          aria-live="polite"
        >
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Memuat daftar Pod dari profil Solid…
        </div>
      )}

      {state.phase === "empty" && (
        <div
          className="flex items-start gap-2 text-xs text-muted-foreground p-3 rounded-lg bg-muted border border-border"
          role="status"
        >
          <ServerOff className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
          <span>Profil ini belum mencantumkan Pod storage.</span>
        </div>
      )}

      {state.phase === "error" && (
        <div className="space-y-3 p-3 rounded-lg bg-rose-50 border border-rose-200" role="alert">
          <div className="flex items-start gap-2 text-xs text-rose-800">
            <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
            <span>Gagal memuat daftar Pod</span>
          </div>
          <Button variant="outline" size="sm" onClick={reload} className="h-7 text-xs">
            <RefreshCw className="w-3 h-3" />
            Coba lagi
          </Button>
        </div>
      )}

      {state.phase === "ready" && state.podUrls.length === 1 && (
        <div
          className="rounded-lg border border-[#dce6ce] bg-[#f8faf4] p-3 text-xs"
          aria-live="polite"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-[#53643e]" />
            <span className="font-medium text-foreground">
              Pod terhubung dan aktif
            </span>
            <Badge variant="olive" className="ml-auto shrink-0 text-[10px]">
              Aktif
            </Badge>
          </div>
          <code className="mt-1.5 block font-mono text-[11px] break-all text-[#53643e]">
            {state.podUrls[0]}
          </code>
        </div>
      )}

      {state.phase === "ready" && state.podUrls.length > 1 && (
        <fieldset className="space-y-2">
          <legend className="text-xs text-muted-foreground mb-1">
            {state.podUrls.length} Pod ditemukan. Pilih satu Pod untuk sesi ini:
          </legend>
          <div className="space-y-2">
            {state.podUrls.map((podUrl) => {
              const isSelected = selectedPodUrl === podUrl;
              return (
                <label
                  key={podUrl}
                  className={cn(
                    "flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer transition-colors text-xs",
                    isSelected
                      ? "border-[#53643e] bg-[#f8faf4]"
                      : "border-border bg-card hover:bg-muted"
                  )}
                >
                  <input
                    type="radio"
                    name="pod-selection"
                    className="mt-0.5 h-3.5 w-3.5 accent-[#53643e]"
                    value={podUrl}
                    checked={isSelected}
                    onChange={() => selectPod(podUrl)}
                  />
                  <span className="min-w-0 flex-1">
                    <code className="block font-mono text-[11px] break-all text-foreground">
                      {podUrl}
                    </code>
                    {isSelected && (
                      <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-[#53643e] font-medium">
                        <CheckCircle2 className="w-3 h-3" />
                        Dipilih untuk sesi ini
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
    </section>
  );
}
