"use client";

import * as React from "react";

interface PodSelectionContextValue {
  selectedPodUrl: string | null;
  selectPod: (podUrl: string | null) => void;
}

const PodSelectionContext = React.createContext<PodSelectionContextValue | null>(
  null
);

/**
 * Menyimpan Pod terpilih selama sesi Solid aktif. Provider di-remount per WebID
 * sehingga pilihan Pod tidak terbawa saat akun berganti atau pengguna keluar.
 */
export function PodSelectionProvider({ children }: { children: React.ReactNode }) {
  const [selectedPodUrl, setSelectedPodUrl] = React.useState<string | null>(null);

  const selectPod = React.useCallback((podUrl: string | null) => {
    setSelectedPodUrl(podUrl);
  }, []);

  const value = React.useMemo<PodSelectionContextValue>(
    () => ({ selectedPodUrl, selectPod }),
    [selectedPodUrl, selectPod]
  );

  return (
    <PodSelectionContext.Provider value={value}>
      {children}
    </PodSelectionContext.Provider>
  );
}

export function usePodSelection(): PodSelectionContextValue {
  const context = React.useContext(PodSelectionContext);
  if (!context) {
    throw new Error(
      "usePodSelection harus dipakai di dalam PodSelectionProvider."
    );
  }
  return context;
}
