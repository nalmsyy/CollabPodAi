"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  FileText,
  MessageSquare,
  Users,
} from "lucide-react";
import { BrandMark } from "@/components/layout/sidebar";

const chapters = [
  {
    name: "Dokumen",
    icon: FileText,
    title: "Mulai dari sumbernya.",
    body: "Simpan PDF dan TXT dalam proyek. Pemilik memilih dokumen yang boleh dirujuk oleh asisten AI.",
    illustration: "Catatan observasi sungai",
    detail: "Dokumen lapangan · TXT",
    note: "Sumber untuk tim",
  },
  {
    name: "Percakapan",
    icon: MessageSquare,
    title: "Bahas satu bagian sekali waktu.",
    body: "Pisahkan diskusi metode dan latar belakang dalam chat yang berbeda. Simpan kesepakatan yang perlu dibawa ke bagian berikutnya.",
    illustration: "Metodologi penelitian",
    detail: "Ruang chat proyek",
    note: "Keputusan tim",
  },
  {
    name: "Anggota",
    icon: Users,
    title: "Tentukan siapa yang ikut.",
    body: "Undang teman lewat WebID sebagai Editor atau Viewer. Setelah mereka menerima, proyek muncul di dashboard mereka.",
    illustration: "Undangan ke proyek",
    detail: "Viewer · dapat membaca",
    note: "Menunggu tanggapan",
  },
];
export default function HomePage() {
  const [chapter, setChapter] = useState(0);
  const active = chapters[chapter];
  return (
    <div className="field-site">
      <header className="field-nav">
        <Link
          className="field-wordmark"
          href="/"
          aria-label="CollabPod, beranda"
        >
          <BrandMark />
          collabpod<span>.</span>
        </Link>
        <nav aria-label="Navigasi beranda">
          <a href="#studio">Cara kerja</a>
          <a href="#pod">Solid Pod</a>
        </nav>
        <Link className="field-login" href="/login">
          Masuk <ArrowUpRight size={16} />
        </Link>
      </header>
      <main>
        <section className="field-cover" aria-labelledby="field-title">
          <div className="field-intro">
            <p className="field-category">
              <span /> Studio riset kolaboratif
            </p>
            <h1 id="field-title">
              Banyak kepala,
              <br />
              <em>satu meja.</em>
            </h1>
            <p className="field-lead">
              Kumpulkan sumber, bahas temuan, dan simpan keputusan tim dalam
              satu proyek riset.
            </p>
            <div className="field-actions">
              <Link className="field-primary" href="/login">
                Buka workspace <ArrowUpRight size={17} />
              </Link>
              <Link className="field-demo" href="/dashboard">
                Jelajahi demo <ArrowRight size={16} />
              </Link>
            </div>
          </div>
          <figure className="field-object">
            <div className="field-disk" aria-hidden="true" />
            <div className="field-cross field-cross-a" aria-hidden="true" />
            <div className="field-cross field-cross-b" aria-hidden="true" />
            <Image
              src="/field-notes.webp"
              width={1050}
              height={1050}
              preload
              sizes="(max-width: 700px) 88vw, 44vw"
              className="field-notebook"
              alt="Jurnal lapangan bersampul hijau dengan sketsa daun dan foto hutan di sela halamannya."
            />
            <figcaption>
              Jurnal lapangan <i /> Arsip botani
            </figcaption>
          </figure>
          <a className="field-scroll" href="#studio">
            <ArrowDown size={14} /> Lihat cara kerja
          </a>
        </section>
        <section id="studio" className="field-chapters">
          <div className="field-section-heading">
            <p className="field-category">
              <span /> Di dalam workspace
            </p>
            <h2>
              Dari catatan ke <em>keputusan.</em>
            </h2>
          </div>
          <div className="field-spread">
            <div className="field-tabs" aria-label="Fitur workspace">
              {chapters.map((c, i) => (
                <button
                  type="button"
                  key={c.name}
                  aria-pressed={chapter === i}
                  onClick={() => setChapter(i)}
                >
                  <c.icon size={19} />
                  {c.name}
                  <ArrowRight size={17} />
                </button>
              ))}
            </div>
            <div className="field-chapter" aria-live="polite" key={chapter}>
              <div>
                <h3>{active.title}</h3>
                <p>{active.body}</p>
              </div>
              <div className="field-slip">
                <small>Contoh proyek · Riset kualitas air</small>
                <strong>{active.illustration}</strong>
                <span>{active.detail}</span>
                <footer>
                  <Check size={14} />
                  {active.note}
                </footer>
              </div>
            </div>
          </div>
        </section>
        <section className="field-pod" id="pod">
          <div>
            <p className="field-category">
              <span /> Solid Pod
            </p>
            <h2>
              Riset tim di <em>Pod milikmu.</em>
            </h2>
            <p>
              Dokumen dan percakapan tersimpan di Pod pemilik proyek. Pemilik
              dapat mengubah peran anggota atau mencabut aksesnya.
            </p>
          </div>
          <Link className="field-primary" href="/login">
            Hubungkan Pod <ArrowUpRight size={17} />
          </Link>
        </section>
      </main>
      <footer className="field-foot">
        <Link href="/" className="field-wordmark">
          <BrandMark />
          collabpod<span>.</span>
        </Link>
        <Link href="/dashboard">
          Dashboard <ArrowUpRight size={15} />
        </Link>
      </footer>
    </div>
  );
}
