"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  completeSolidRedirectOnce,
  describeAuthError,
  getSolidSession,
  rememberAuthError,
  resetRestoreAttempts,
} from "@/lib/solid-session";

/**
 * Rute callback tetap: /auth/callback pada origin yang sedang dibuka.
 * Proses OIDC diselesaikan sekali, lalu pengguna kembali ke /dashboard.
 */
export default function SolidCallbackPage() {
  const router = useRouter();

  React.useEffect(() => {
    let cancelled = false;

    // Navigasi client-side: sesi SDK di memori tetap hidup, sehingga dashboard
    // tidak memicu pemulihan (dan pengalihan ke IdP) sekali lagi.
    const finish = () => {
      if (!cancelled) {
        router.replace("/dashboard");
      }
    };

    (async () => {
      const params = new URLSearchParams(window.location.search);
      const errorCode = params.get("error");

      if (errorCode) {
        rememberAuthError(
          describeAuthError(errorCode, params.get("error_description"))
        );
        finish();
        return;
      }

      try {
        await completeSolidRedirectOnce();
        // Login baru berhasil: dashboard boleh mencoba memulihkan sesi lagi.
        const session = await getSolidSession();
        if (session.info.isLoggedIn) {
          resetRestoreAttempts();
        }
      } catch {
        rememberAuthError(
          "Masuk gagal diselesaikan. Silakan coba lagi dari dashboard."
        );
      }

      finish();
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-6 text-foreground">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-center space-y-3">
        <Loader2 className="w-5 h-5 animate-spin text-primary mx-auto" aria-hidden />
        <h1 className="text-base font-semibold">Menyelesaikan proses masuk…</h1>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Memverifikasi sesi dengan penyedia identitas Solid Anda.
        </p>
        <Link
          href="/dashboard"
          className="inline-block text-xs text-primary underline-offset-4 hover:underline"
        >
          Kembali ke dashboard
        </Link>
      </div>
    </main>
  );
}
