"use client";

import * as React from "react";
import {
  completeSolidRedirectOnce,
  consumeAuthError,
  getSolidSession,
  loginWithSolid,
  resetRestoreAttempts,
  wasRestoreSkipped,
  logoutSolid,
  subscribeToSolidSession,
} from "@/lib/solid-session";

export type SolidSessionStatus = "restoring" | "signed-out" | "signed-in";

interface SolidSessionContextValue {
  status: SolidSessionStatus;
  webId: string | null;
  error: string | null;
  clearError: () => void;
  signIn: (issuer: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const SolidSessionContext = React.createContext<SolidSessionContextValue | null>(
  null
);

export function SolidSessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<SolidSessionStatus>("restoring");
  const [webId, setWebId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    const applySnapshot = (isLoggedIn: boolean, nextWebId?: string) => {
      if (!active) return;
      setStatus(isLoggedIn ? "signed-in" : "signed-out");
      setWebId(isLoggedIn ? nextWebId ?? null : null);
      if (isLoggedIn) resetRestoreAttempts();
    };

    (async () => {
      const pendingError = consumeAuthError();
      if (pendingError && active) {
        setError(pendingError);
      }

      try {
        unsubscribe = await subscribeToSolidSession(
          (snapshot) => applySnapshot(snapshot.isLoggedIn, snapshot.webId),
          (message) => {
            if (active) setError(message);
          }
        );
        // Restorasi sesi setelah refresh; tanpa parameter OAuth ini hanya
        // membaca sesi tersimpan dan tidak mengulang proses callback.
        // Dibatasi waktunya agar UI tidak menggantung bila sesi tersimpan rusak.
        await Promise.race([
          completeSolidRedirectOnce(),
          new Promise<void>((resolve) => {
            window.setTimeout(resolve, 8000);
          }),
        ]);
      } catch {
        if (active) {
          setError("Sesi Solid tidak dapat dipulihkan. Silakan masuk kembali.");
        }
      } finally {
        if (active) {
          try {
            const session = await getSolidSession();
            applySnapshot(session.info.isLoggedIn, session.info.webId);
            if (!session.info.isLoggedIn && wasRestoreSkipped() && active) {
              setError(
                "Sesi Solid tidak dapat dipulihkan. Silakan masuk kembali."
              );
            }
          } catch {
            applySnapshot(false);
          }
        }
      }
    })();

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  const signIn = React.useCallback(async (issuer: string) => {
    setError(null);
    // Method ini melakukan redirect ke halaman penyedia identitas.
    await loginWithSolid(issuer);
  }, []);

  const signOut = React.useCallback(async () => {
    setError(null);
    try {
      await logoutSolid();
      setStatus("signed-out");
      setWebId(null);
    } catch {
      setError("Gagal keluar dari sesi Solid. Silakan coba lagi.");
    }
  }, []);

  const clearError = React.useCallback(() => {
    resetRestoreAttempts();
    setError(null);
  }, []);

  const value = React.useMemo<SolidSessionContextValue>(
    () => ({ status, webId, error, clearError, signIn, signOut }),
    [status, webId, error, clearError, signIn, signOut]
  );

  return (
    <SolidSessionContext.Provider value={value}>
      {children}
    </SolidSessionContext.Provider>
  );
}

export function useSolidSession(): SolidSessionContextValue {
  const context = React.useContext(SolidSessionContext);
  if (!context) {
    throw new Error("useSolidSession harus dipakai di dalam SolidSessionProvider.");
  }
  return context;
}
