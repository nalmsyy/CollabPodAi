"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, ExternalLink, ArrowLeft, Shield, Loader2 } from "lucide-react";
import {
  SolidSessionProvider,
  useSolidSession,
} from "@/components/auth/solid-session-provider";
import { BrandMark } from "@/components/layout/sidebar";
import { normalizeIssuer } from "@/lib/solid-session";
import { cn } from "@/lib/utils";

const PROVIDER_PRESETS = [
  { label: "Solid Community", issuer: "https://solidcommunity.net" },
  { label: "Inrupt PodSpaces", issuer: "https://login.inrupt.com" },
  { label: "Inrupt Community", issuer: "https://inrupt.net" },
  { label: "Server Lokal", issuer: "http://localhost:3001" },
];

function LoginCard() {
  const router = useRouter();
  const { status, webId, signIn } = useSolidSession();
  const [issuer, setIssuer] = React.useState(PROVIDER_PRESETS[0].issuer);
  const [customIssuer, setCustomIssuer] = React.useState("");
  const [useCustom, setUseCustom] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  /* Jika sudah login, langsung ke dashboard */
  React.useEffect(() => {
    if (status === "signed-in" && webId) {
      router.replace("/dashboard");
    }
  }, [status, webId, router]);

  const activeIssuer = useCustom ? customIssuer : issuer;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = normalizeIssuer(activeIssuer);
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
        "Tidak dapat menghubungi penyedia identitas. Periksa URL dan coba lagi."
      );
      setSubmitting(false);
    }
  };

  if (status === "restoring") {
    return (
      <div className="login-loading">
        <Loader2 className="animate-spin" size={24} />
        <span>Memeriksa sesi…</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="login-card" noValidate>
      {/* Header Card */}
      <div className="login-card-header">
        <div className="login-card-icon">
          <Shield size={22} strokeWidth={1.5} />
        </div>
        <h1 className="login-card-title">Masuk dengan Solid</h1>
        <p className="login-card-desc">
          Pilih penyedia identitas Solid-mu. Login berlangsung di halaman penyedia —
          CollabPod AI tidak pernah menerima kata sandimu.
        </p>
      </div>

      {/* Provider Presets */}
      <div className="login-field">
        <span className="login-label">Penyedia identitas umum</span>
        <div className="login-presets">
          {PROVIDER_PRESETS.map((p) => (
            <button
              key={p.issuer}
              type="button"
              onClick={() => {
                setIssuer(p.issuer);
                setUseCustom(false);
                setError(null);
              }}
              className={cn(
                "login-preset-btn",
                !useCustom && issuer === p.issuer && "login-preset-btn-active"
              )}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setUseCustom(true);
              setError(null);
            }}
            className={cn(
              "login-preset-btn",
              useCustom && "login-preset-btn-active"
            )}
          >
            Lainnya…
          </button>
        </div>
      </div>

      {/* URL Input (custom atau tampil readonly preset) */}
      <div className="login-field">
        <label htmlFor="solid-idp" className="login-label">
          URL Identity Provider
        </label>
        <input
          id="solid-idp"
          type="url"
          inputMode="url"
          autoComplete="url"
          spellCheck={false}
          placeholder="https://solidcommunity.net"
          value={useCustom ? customIssuer : issuer}
          onChange={(e) => {
            if (useCustom) setCustomIssuer(e.target.value);
            else setIssuer(e.target.value);
            if (error) setError(null);
          }}
          readOnly={!useCustom && PROVIDER_PRESETS.some((p) => p.issuer === issuer)}
          className={cn("login-input", error && "login-input-error")}
        />
        {error ? (
          <p className="login-hint login-hint-error" role="alert">{error}</p>
        ) : (
          <p className="login-hint">
            Contoh: <code>https://solidcommunity.net</code> atau{" "}
            <code>http://localhost:3001</code> untuk server Solid lokal.
          </p>
        )}
      </div>

      {/* Privasi note */}
      <div className="login-privacy">
        <Shield size={13} strokeWidth={2} className="shrink-0 mt-0.5" />
        <p>
          <strong>Privasi terjamin:</strong> Sesi dikelola langsung di browser-mu.
          Data tersimpan di Solid Pod milikmu — bukan di server CollabPod AI.
        </p>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className="login-submit-btn"
      >
        {submitting ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Mengalihkan ke penyedia…
          </>
        ) : (
          <>
            <LogIn size={16} />
            Lanjutkan ke penyedia identitas
          </>
        )}
      </button>

      {/* Daftar */}
      <p className="login-register-hint">
        Belum punya akun Solid?{" "}
        <a
          href="https://solidcommunity.net/register"
          target="_blank"
          rel="noopener noreferrer"
          className="login-link"
        >
          Daftar di Solid Community <ExternalLink size={11} className="inline" />
        </a>
        {" "}atau{" "}
        <a
          href="http://localhost:3001"
          target="_blank"
          rel="noopener noreferrer"
          className="login-link"
        >
          buat di server lokal
        </a>
      </p>
    </form>
  );
}

export function LoginScreen() {
  return (
    <SolidSessionProvider>
      <div className="login-root">
        {/* Background decorative blobs */}
        <div className="login-blob login-blob-1" aria-hidden />
        <div className="login-blob login-blob-2" aria-hidden />

        {/* Back to landing */}
        <div className="login-topbar">
          <Link href="/" className="login-back-link">
            <ArrowLeft size={15} />
            Kembali
          </Link>
          <Link href="/" className="login-brand">
            <BrandMark />
            <span>collabpod<span className="login-brand-dot">.</span></span>
          </Link>
          <Link href="/dashboard" className="login-demo-link">
            Lihat demo →
          </Link>
        </div>

        {/* Two column layout */}
        <div className="login-layout">
          {/* Left — ilustrasi / tagline */}
          <div className="login-left">
            <div className="login-left-content">
              <div className="login-left-badge">Ruang Riset Kolaboratif</div>
              <h2 className="login-left-heading">
                Data risetmu,<br />
                <em>selalu milikmu.</em>
              </h2>
              <p className="login-left-sub">
                CollabPod AI menyimpan semua dokumen, keputusan, dan percakapan
                tim langsung di Solid Pod yang kamu kendalikan sepenuhnya.
              </p>

              {/* Feature pills */}
              <div className="login-left-pills">
                {["🔒 WAC-based access control", "🤖 AI berbasis dokumen", "👥 Kolaborasi tim", "📂 Pod milikmu sendiri"].map((pill) => (
                  <span key={pill} className="login-pill">{pill}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Right — login card */}
          <div className="login-right">
            <LoginCard />
          </div>
        </div>
      </div>
    </SolidSessionProvider>
  );
}

