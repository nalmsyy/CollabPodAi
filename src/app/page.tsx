"use client";

import * as React from "react";
import Link from "next/link";
import { BrandMark } from "@/components/layout/sidebar";
import { SolidLoginDialog } from "@/components/auth/solid-login-dialog";
import { SolidSessionProvider } from "@/components/auth/solid-session-provider";

/** Landing page CollabPod AI — ditampilkan sebelum login. */
export default function HomePage() {
  const [loginOpen, setLoginOpen] = React.useState(false);

  return (
    <SolidSessionProvider>
      <div className="landing-root">
        {/* Modal login Solid Pod */}
        <SolidLoginDialog open={loginOpen} onOpenChange={setLoginOpen} />

        {/* ─── Navbar ─────────────────────────────────────────────────────── */}
        <header className="landing-nav">
          <Link href="/" className="landing-nav-brand">
            <BrandMark />
            <span className="landing-nav-wordmark">
              collabpod<span className="landing-nav-dot">.</span>
              <sup className="landing-nav-beta">BETA</sup>
            </span>
          </Link>

          <nav className="landing-nav-links">
            <a href="#fitur">Fitur</a>
            <a href="#cara-kerja">Cara kerja</a>
            <a href="#solid">Solid Pod</a>
          </nav>

          <button
            type="button"
            onClick={() => setLoginOpen(true)}
            className="landing-nav-cta cursor-pointer"
          >
            Masuk dengan Solid →
          </button>
        </header>

        {/* ─── Hero ───────────────────────────────────────────────────────── */}
        <section className="landing-hero">
          {/* Dekorasi gelembung latar */}
          <div className="landing-hero-blob landing-hero-blob-1" aria-hidden />
          <div className="landing-hero-blob landing-hero-blob-2" aria-hidden />

          {/* Kartu mengambang kiri */}
          <div className="landing-float-card landing-float-left">
            <span className="landing-float-icon">🔒</span>
            <div>
              <strong>Data tetap milikmu.</strong>
              <small>Disimpan di Solid Pod-mu sendiri.</small>
            </div>
          </div>

          {/* Kartu mengambang kanan */}
          <div className="landing-float-card landing-float-right">
            <span className="landing-float-icon">✦</span>
            <div>
              <strong>Kolaborasi nyata.</strong>
              <small>Undang anggota tim tanpa batas platform.</small>
            </div>
          </div>

          <div className="landing-hero-content">
            <div className="landing-hero-badge">Ruang riset kolaboratif</div>

            <h1 className="landing-hero-heading">
              Satu ruang,<br />
              <em>satu tim.</em>
            </h1>

            <p className="landing-hero-sub">
              CollabPod AI membantu kelompok mahasiswa berkolaborasi — mengelola
              dokumen, keputusan, dan tugas riset dalam satu workspace terpercaya
              yang ditenagai Solid Pod dan AI.
            </p>

            <div className="landing-hero-actions">
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                className="landing-btn-primary cursor-pointer border-none"
              >
                Masuk dengan Solid Pod →
              </button>
              <Link href="/dashboard" className="landing-btn-ghost">
                ▷&nbsp; Lihat demo
              </Link>
            </div>

            <p className="landing-hero-note">
              Tidak punya akun Solid?{" "}
              <a
                href="http://localhost:3001"
                target="_blank"
                rel="noopener noreferrer"
              >
                Buat sekarang gratis
              </a>
              {" "}atau buka{" "}
              <Link href="/login" className="underline">
                halaman login lengkap
              </Link>
            </p>
          </div>

          {/* Preview dashboard mini */}
          <div className="landing-preview">
            <div className="landing-preview-bar">
              <span /><span /><span />
              <small>collabpod.app/dashboard</small>
            </div>
            <div className="landing-preview-body">
              <div className="landing-preview-sidebar">
                <div className="landing-preview-logo" aria-hidden>
                  <BrandMark className="scale-75" />
                </div>
                <div className="landing-preview-nav-item landing-preview-nav-active">Semua proyek</div>
                <div className="landing-preview-nav-item">Pod Saya</div>
              </div>
              <div className="landing-preview-main">
                <div className="landing-preview-heading">Ruang untuk berkarya.</div>
                <div className="landing-preview-row">
                  <div className="landing-preview-card">
                    <div className="landing-preview-card-title">Riset Kualitas Air</div>
                    <div className="landing-preview-card-meta">6 dokumen · 3 anggota · Owner</div>
                  </div>
                  <div className="landing-preview-card">
                    <div className="landing-preview-card-title">Analisis Kebijakan</div>
                    <div className="landing-preview-card-meta">2 dokumen · 2 anggota · Editor</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Fitur ──────────────────────────────────────────────────────── */}
        <section className="landing-features" id="fitur">
          <div className="landing-section-label">Fitur Utama</div>
          <h2 className="landing-section-heading">
            Semua yang dibutuhkan<br />
            <em>tim riset kamu.</em>
          </h2>

          <div className="landing-features-grid">
            {FEATURES.map((f) => (
              <div key={f.title} className="landing-feature-card">
                <div className="landing-feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Cara Kerja ─────────────────────────────────────────────────── */}
        <section className="landing-steps" id="cara-kerja">
          <div className="landing-section-label">Cara Kerja</div>
          <h2 className="landing-section-heading">
            Mulai dalam<br />
            <em>tiga langkah.</em>
          </h2>

          <ol className="landing-steps-list">
            {STEPS.map((s, i) => (
              <li key={s.title} className="landing-step">
                <div className="landing-step-num">{i + 1}</div>
                <div>
                  <strong>{s.title}</strong>
                  <p>{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* ─── Solid Pod CTA ──────────────────────────────────────────────── */}
        <section className="landing-solid-cta" id="solid">
          <div className="landing-solid-cta-inner">
            <div className="landing-section-label landing-section-label-light">Privasi Sejati</div>
            <h2 className="landing-section-heading landing-section-heading-light">
              Datamu bukan produk kami.<br />
              <em>Solid Pod menjaminnya.</em>
            </h2>
            <p className="landing-solid-desc">
              CollabPod AI tidak menyimpan data penelitianmu di server kami. Semua
              dokumen, keputusan, dan percakapan tim tersimpan langsung di Solid Pod
              yang kamu kendalikan sepenuhnya.
            </p>
            <div className="landing-hero-actions" style={{ justifyContent: "center" }}>
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                className="landing-btn-primary landing-btn-primary-light cursor-pointer border-none"
              >
                Masuk dengan Solid Pod →
              </button>
              <a
                href="https://solidproject.org"
                target="_blank"
                rel="noopener noreferrer"
                className="landing-btn-ghost landing-btn-ghost-light"
              >
                Pelajari Solid Project ↗
              </a>
            </div>
          </div>
        </section>

        {/* ─── Footer ─────────────────────────────────────────────────────── */}
        <footer className="landing-footer">
          <div className="landing-footer-brand">
            <BrandMark />
            <span>collabpod<span className="landing-nav-dot">.</span></span>
          </div>
          <p className="landing-footer-note">
            Dibuat untuk mahasiswa yang serius berkolaborasi.
            <br />
            <span>Data tersimpan di Solid Pod milikmu — bukan milik kami.</span>
          </p>
          <div className="landing-footer-links">
            <button
              type="button"
              onClick={() => setLoginOpen(true)}
              className="text-muted-foreground hover:text-foreground text-[13px] bg-transparent border-none cursor-pointer"
            >
              Login
            </button>
            <Link href="/dashboard">Demo</Link>
            <a href="https://solidproject.org" target="_blank" rel="noopener noreferrer">Solid Project</a>
          </div>
        </footer>
      </div>
    </SolidSessionProvider>
  );
}

const FEATURES = [
  {
    icon: "🗂️",
    title: "Manajemen Dokumen",
    desc: "Unggah PDF dan TXT ke Solid Pod. Verifikasi integritas SHA-256 otomatis setiap kali dokumen dibuka.",
  },
  {
    icon: "🤖",
    title: "Tanya Jawab AI",
    desc: "Ajukan pertanyaan berbasis dokumen yang sudah disetujui. Jawaban AI selalu disertai sitasi halaman yang terverifikasi.",
  },
  {
    icon: "💬",
    title: "Chat Tim Terisolasi",
    desc: "Setiap anggota punya thread private dan bisa berkolaborasi di ruang bersama — semua tersimpan di Pod.",
  },
  {
    icon: "✅",
    title: "Papan Keputusan",
    desc: "Catat keputusan bersama yang terhubung langsung ke dokumen sumber. Jejak keputusan tidak bisa hilang.",
  },
  {
    icon: "👥",
    title: "Peran & Akses WAC",
    desc: "Owner, Editor, Viewer — setiap peran punya hak akses berbeda yang dijaga oleh Web Access Control.",
  },
  {
    icon: "🔑",
    title: "Login Tanpa Kata Sandi",
    desc: "Autentikasi melalui Solid Identity Provider. CollabPod AI tidak pernah menyimpan kredensialmu.",
  },
];

const STEPS = [
  {
    title: "Login dengan Solid Pod",
    desc: "Masukkan URL Identity Provider Solid-mu, lalu ikuti alur login di halaman provider. Tidak perlu mendaftar ulang.",
  },
  {
    title: "Buat atau Bergabung ke Proyek",
    desc: "Buat workspace baru atau terima undangan dari rekan tim. Semua data langsung tersimpan di Pod-mu.",
  },
  {
    title: "Kolaborasi & Tanya AI",
    desc: "Unggah dokumen, diskusikan keputusan, bagikan tugas, dan tanya AI — semuanya berdasarkan dokumen timmu.",
  },
];
