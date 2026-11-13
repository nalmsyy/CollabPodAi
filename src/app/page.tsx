"use client";

import * as React from "react";
import Link from "next/link";
import { BrandMark } from "@/components/layout/sidebar";
import { SolidLoginDialog } from "@/components/auth/solid-login-dialog";
import { SolidSessionProvider } from "@/components/auth/solid-session-provider";

/** Landing page CollabPod AI — dinamis, beranimasi, dan kaya visual terinspirasi Mindly. */
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
          {/* Dekorasi gelembung latar beranimasi */}
          <div className="landing-hero-blob landing-hero-blob-1" aria-hidden />
          <div className="landing-hero-blob landing-hero-blob-2" aria-hidden />

          {/* Stempel Melingkar Berputar (Circular Rotating Stamp Badge) */}
          <div className="landing-stamp-wrapper" aria-hidden="true">
            <svg className="landing-stamp-svg" viewBox="0 0 140 140">
              <path
                id="stamp-circle"
                d="M 70, 70 m -50, 0 a 50,50 0 1,1 100,0 a 50,50 0 1,1 -100,0"
                fill="none"
              />
              <text className="landing-stamp-text">
                <textPath href="#stamp-circle">
                  ✦ DATA MILIKMU ✦ SOLID POD PROTOCOL ✦
                </textPath>
              </text>
            </svg>
            <div className="landing-stamp-center">
              <span className="landing-stamp-icon">✦</span>
            </div>
          </div>

          {/* Garis kurva dekoratif menghubungkan kartu ke tengah */}
          <svg
            className="landing-hero-lines"
            viewBox="0 0 1200 500"
            fill="none"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M 120, 160 C 260, 180 340, 240 520, 260"
              stroke="#d5dec6"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <path
              d="M 1080, 150 C 940, 170 860, 230 680, 260"
              stroke="#d5dec6"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <path
              d="M 160, 360 C 300, 340 400, 310 520, 300"
              stroke="#e0e8d4"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
            <path
              d="M 1040, 380 C 900, 360 800, 330 680, 300"
              stroke="#e0e8d4"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
          </svg>

          {/* Kartu Mengambang 1: Top-Left (Audio Wave / Grounded AI) */}
          <div className="landing-float-card landing-float-top-left">
            <div className="landing-card-header-row">
              <div className="landing-eq">
                <span className="landing-eq-bar" />
                <span className="landing-eq-bar" />
                <span className="landing-eq-bar" />
                <span className="landing-eq-bar" />
              </div>
              <span className="landing-tag-pill">99.8% Grounded</span>
            </div>
            <strong>AI Bebas Halusinasi.</strong>
            <small>Sitasi otomatis per halaman dokumen tim.</small>
          </div>

          {/* Kartu Mengambang 2: Top-Right (Team Avatars & Live Sync) */}
          <div className="landing-float-card landing-float-top-right">
            <div className="landing-card-header-row">
              <div className="landing-avatar-stack">
                <span className="landing-avatar-pill avatar-a">N</span>
                <span className="landing-avatar-pill avatar-b">A</span>
                <span className="landing-avatar-pill avatar-c">S</span>
                <span className="landing-avatar-pill avatar-plus">+3</span>
              </div>
              <span className="live-badge">
                <span className="live-indicator" /> Live
              </span>
            </div>
            <strong>Riset Bersama Tim.</strong>
            <small>Sinkronisasi antar-pod tanpa server perantara.</small>
          </div>

          {/* Kartu Mengambang 3: Bottom-Left (Social Proof & Ratings) */}
          <div className="landing-float-card landing-float-bottom-left">
            <div className="stars-row">★★★★★</div>
            <strong>500+ Mahasiswa Aktif.</strong>
            <small>Membantu riset dan skripsi dengan integritas data.</small>
          </div>

          {/* Kartu Mengambang 4: Bottom-Right (Clarity & Sparkle) */}
          <div className="landing-float-card landing-float-bottom-right">
            <span className="sparkle-icon">✦</span>
            <strong>Less chaos. More clarity.</strong>
            <small>Satu workspace untuk chat, dokumen & keputusan.</small>
          </div>

          {/* Konten Utama Hero */}
          <div className="landing-hero-content">
            <div className="landing-hero-badge">
              <span className="landing-badge-spark">✦</span>
              <span>Ruang Riset Kolaboratif Mahasiswa</span>
            </div>

            <h1 className="landing-hero-heading">
              Satu ruang,<br />
              <em>satu tim.</em>
            </h1>

            <p className="landing-hero-sub">
              CollabPod AI membantu kelompok mahasiswa berkolaborasi — mengelola
              dokumen, keputusan, dan tugas riset dalam satu workspace terpercaya
              yang ditenagai Solid Pod dan Gemini AI.
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
                ▷&nbsp; Buka Demo Interaktif
              </Link>
            </div>

            <p className="landing-hero-note">
              Belum punya akun Solid?{" "}
              <a
                href="https://solidcommunity.net/register"
                target="_blank"
                rel="noopener noreferrer"
              >
                Daftar gratis di Solid Community
              </a>
              {" "}atau buka{" "}
              <Link href="/login" className="underline">
                halaman login lengkap
              </Link>
            </p>
          </div>

          {/* ─── 3D Orbiting Capsules (Mindly Arc Style) ─────────────────── */}
          <div className="landing-orbit-arc">
            <div className="landing-orbit-capsule">
              <span className="capsule-icon">📑</span>
              <span>Penyimpanan PDF & TXT</span>
            </div>
            <div className="landing-orbit-capsule">
              <span className="capsule-icon">🤖</span>
              <span>Gemini 2.5 Flash Grounded</span>
            </div>
            <div className="landing-orbit-capsule">
              <span className="capsule-icon">🔒</span>
              <span>Solid Pod WAC Privacy</span>
            </div>
            <div className="landing-orbit-capsule">
              <span className="capsule-icon">⚖️</span>
              <span>Papan Keputusan Bersama</span>
            </div>
            <div className="landing-orbit-capsule">
              <span className="capsule-icon">📋</span>
              <span>Pelacakan Tugas Tim</span>
            </div>
          </div>

          {/* ─── Living Interactive Preview Mockup ───────────────────────── */}
          <div className="landing-preview">
            <div className="landing-preview-bar">
              <div className="preview-bar-left">
                <span className="dot-red" />
                <span className="dot-yellow" />
                <span className="dot-green" />
                <span className="preview-url">
                  collabpod.app/dashboard/detail/riset-kualitas-air
                </span>
              </div>
              <div className="preview-badge-status">
                <span className="preview-pulse" />
                <span>Pod Terhubung · WAC Aman</span>
              </div>
            </div>

            <div className="landing-preview-body">
              {/* Mini Sidebar */}
              <div className="landing-preview-sidebar">
                <div className="flex items-center gap-2 mb-2 px-1">
                  <BrandMark className="scale-75 origin-left" />
                  <span className="text-[12px] font-bold text-foreground">
                    collabpod<span className="text-primary">.</span>
                  </span>
                </div>

                <div className="preview-proj-header">Proyek Aktif</div>
                <div className="landing-preview-nav-item landing-preview-nav-active">
                  <span>Riset Kualitas Air</span>
                  <small className="text-[10px] bg-white/70 px-1.5 py-0.5 rounded text-primary font-bold">
                    Owner
                  </small>
                </div>
                <div className="landing-preview-nav-item">
                  <span>Analisis Kebijakan</span>
                  <small className="text-[10px] text-muted-foreground">Editor</small>
                </div>

                <div className="preview-member-list">
                  <div className="text-[10px] uppercase font-bold text-muted-foreground px-1 mb-1">
                    Anggota Online (3)
                  </div>
                  <div className="preview-member-item">
                    <span className="preview-member-dot" />
                    <span>Nur Alif (Kamu)</span>
                  </div>
                  <div className="preview-member-item">
                    <span className="preview-member-dot" />
                    <span>Dewi Ayu (Editor)</span>
                  </div>
                  <div className="preview-member-item">
                    <span className="preview-member-dot" />
                    <span>Budi Santoso (Viewer)</span>
                  </div>
                </div>
              </div>

              {/* Mini Workspace Main */}
              <div className="landing-preview-main">
                <div className="preview-workspace-tabs">
                  <span className="preview-tab preview-tab-active">
                    💬 Obrolan Tim (Metodologi)
                  </span>
                  <span className="preview-tab">📄 Dokumen (6 Berkas)</span>
                  <span className="preview-tab">⚖️ Keputusan (2)</span>
                </div>

                <div className="preview-chat-box">
                  {/* Pertanyaan Pengguna */}
                  <div className="preview-msg preview-msg-user">
                    <div className="preview-avatar">NA</div>
                    <div className="preview-bubble">
                      <div className="preview-author">
                        <span>Nur Alif</span>
                        <small className="text-[10px] text-muted-foreground font-normal">
                          10:24 WIB
                        </small>
                      </div>
                      <p className="m-0 text-[12.5px]">
                        Bagaimana korelasi pH air dan konsentrasi DO pada stasiun 3 berdasarkan hasil uji lab kemarin?
                      </p>
                    </div>
                  </div>

                  {/* Respon AI dengan Sitasi */}
                  <div className="preview-msg preview-msg-ai">
                    <div className="preview-avatar">✦</div>
                    <div className="preview-bubble preview-bubble-ai">
                      <div className="preview-author text-primary">
                        <span>CollabPod Assistant (Grounded Gemini)</span>
                        <small className="text-[10px] text-muted-foreground font-normal">
                          10:25 WIB
                        </small>
                      </div>
                      <p className="m-0 text-[12px] text-foreground/90 leading-relaxed">
                        Berdasarkan laporan pengujian laboratorium, terjadi penurunan DO signifikan dari <strong>7.2 mg/L ke 5.4 mg/L</strong> seiring penurunan pH air ke <strong>6.1</strong> di titik stasiun 3.
                      </p>
                      <div className="preview-citation cursor-pointer">
                        <span>📄 Rujukan: [Laporan_Lab_Final.pdf, Hal. 14]</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Banner Keputusan Tersemat */}
                <div className="preview-decision-banner">
                  <span className="text-[14px]">✓</span>
                  <span>
                    <strong>Keputusan Bersama:</strong> Memakai metode titrasi Winkler untuk verifikasi ulang stasiun 3 (disetujui Owner & Dewi Ayu).
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Infinite Scrolling Running Text (Marquee Ticker) ─────────── */}
        <div className="landing-marquee" aria-hidden="true">
          <div className="landing-marquee-track">
            <span className="landing-marquee-item">
              <span className="landing-marquee-dot">✦</span> ZERO DATA LOCK-IN
            </span>
            <span className="landing-marquee-item">
              <span className="landing-marquee-dot">✦</span> SOLID POD STORAGE
            </span>
            <span className="landing-marquee-item">
              <span className="landing-marquee-dot">✦</span> GROUNDED GEMINI 2.5 AI
            </span>
            <span className="landing-marquee-item">
              <span className="landing-marquee-dot">✦</span> SHA-256 DOCUMENT INTEGRITY
            </span>
            <span className="landing-marquee-item">
              <span className="landing-marquee-dot">✦</span> WEB ACCESS CONTROL (WAC)
            </span>
            <span className="landing-marquee-item">
              <span className="landing-marquee-dot">✦</span> THREADED TEAM CHAT
            </span>
            <span className="landing-marquee-item">
              <span className="landing-marquee-dot">✦</span> DECISION TRACKING
            </span>
            <span className="landing-marquee-item">
              <span className="landing-marquee-dot">✦</span> CITATION-VERIFIED ANSWERS
            </span>
            {/* Duplikasi agar loop seamless tanpa jeda */}
            <span className="landing-marquee-item">
              <span className="landing-marquee-dot">✦</span> ZERO DATA LOCK-IN
            </span>
            <span className="landing-marquee-item">
              <span className="landing-marquee-dot">✦</span> SOLID POD STORAGE
            </span>
            <span className="landing-marquee-item">
              <span className="landing-marquee-dot">✦</span> GROUNDED GEMINI 2.5 AI
            </span>
            <span className="landing-marquee-item">
              <span className="landing-marquee-dot">✦</span> SHA-256 DOCUMENT INTEGRITY
            </span>
            <span className="landing-marquee-item">
              <span className="landing-marquee-dot">✦</span> WEB ACCESS CONTROL (WAC)
            </span>
            <span className="landing-marquee-item">
              <span className="landing-marquee-dot">✦</span> THREADED TEAM CHAT
            </span>
            <span className="landing-marquee-item">
              <span className="landing-marquee-dot">✦</span> DECISION TRACKING
            </span>
            <span className="landing-marquee-item">
              <span className="landing-marquee-dot">✦</span> CITATION-VERIFIED ANSWERS
            </span>
          </div>
        </div>

        {/* ─── Fitur Utama ────────────────────────────────────────────────── */}
        <section className="landing-features" id="fitur">
          <div className="landing-section-label">
            <span>✦</span>
            <span>Fitur Unggulan</span>
          </div>
          <h2 className="landing-section-heading">
            Semua yang dibutuhkan<br />
            <em>tim riset kamu.</em>
          </h2>

          <div className="landing-features-grid">
            {FEATURES.map((f) => (
              <div key={f.title} className="landing-feature-card">
                <div className="landing-feature-icon-box">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Cara Kerja ─────────────────────────────────────────────────── */}
        <section className="landing-steps" id="cara-kerja">
          <div className="landing-section-label">
            <span>✦</span>
            <span>Alur Praktis</span>
          </div>
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
            <div className="landing-section-label landing-section-label-light">
              <span>✦</span>
              <span>Privasi Sejati</span>
            </div>
            <h2 className="landing-section-heading landing-section-heading-light">
              Datamu bukan produk kami.<br />
              <em>Solid Pod menjaminnya.</em>
            </h2>
            <p className="landing-solid-desc">
              CollabPod AI tidak menyimpan data penelitianmu di server kami. Semua
              dokumen, keputusan, dan percakapan tim tersimpan langsung di Solid Pod
              yang kamu kendalikan sepenuhnya tanpa perantara.
            </p>
            <div className="landing-hero-actions">
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
            Dibuat untuk mahasiswa yang serius berkolaborasi dalam tugas & riset kecil.
            <br />
            <span>Data tersimpan langsung di Solid Pod milikmu — bukan milik kami.</span>
          </p>
          <div className="landing-footer-links">
            <button
              type="button"
              onClick={() => setLoginOpen(true)}
              className="bg-transparent border-none cursor-pointer"
            >
              Login
            </button>
            <Link href="/dashboard">Demo Workspace</Link>
            <a href="https://solidproject.org" target="_blank" rel="noopener noreferrer">
              Solid Project
            </a>
          </div>
        </footer>
      </div>
    </SolidSessionProvider>
  );
}

const FEATURES = [
  {
    icon: "🗂️",
    title: "Manajemen Dokumen Aman",
    desc: "Unggah PDF dan TXT ke Solid Pod milikmu. Setiap dokumen diverifikasi dengan hash SHA-256 otomatis saat dibuka.",
  },
  {
    icon: "🤖",
    title: "AI Grounding Terpercaya",
    desc: "Tanya AI berbasis dokumen yang telah disetujui Owner. Setiap jawaban dilengkapi sitasi nomor halaman yang akurat.",
  },
  {
    icon: "💬",
    title: "Obrolan Tim Terisolasi",
    desc: "Setiap anggota memiliki ruang obrolan terisolasi dan ruang diskusi bersama yang tersimpan langsung di Pod.",
  },
  {
    icon: "⚖️",
    title: "Papan Keputusan Terikat",
    desc: "Catat konsensus bersama tim yang terikat pada dokumen sumber. Keputusan tidak dapat diubah sepihak tanpa jejak.",
  },
  {
    icon: "👥",
    title: "Akses Web Access Control (WAC)",
    desc: "Pembagian peran Owner, Editor, dan Viewer yang ditegakkan langsung oleh protokol WAC standar Solid.",
  },
  {
    icon: "🔑",
    title: "Autentikasi Tanpa Password",
    desc: "Login langsung menggunakan Solid Identity Provider. CollabPod AI tidak pernah melihat atau menyimpan password-mu.",
  },
];

const STEPS = [
  {
    title: "Login dengan Solid Pod",
    desc: "Masukkan URL Identity Provider Solid-mu (atau server lokal), lalu login di halaman provider resmi secara aman.",
  },
  {
    title: "Buat atau Bergabung ke Proyek",
    desc: "Buat workspace riset baru atau buka tautan undangan rekan tim. Semua dokumen tersimpan di direktori Pod.",
  },
  {
    title: "Kolaborasi & Tanya AI",
    desc: "Diskusikan metodologi, catat keputusan penting, bagikan tugas, dan ajukan pertanyaan cerdas ke AI berdasar dokumen tim.",
  },
];
