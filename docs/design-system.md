# CollabPod AI — Panduan Design System

Dokumen ini mendokumentasikan keputusan visual, token desain, tipografi, dan aturan komponen antarmuka CollabPod AI agar konsisten pada seluruh tahap pengembangan.

---

## 1. Filosofi Desain

- **Akademik & Tenang**: Menghadirkan ruang kerja yang bersih, tertata, dan nyaman untuk membaca dokumen ilmiah serta mengelola tugas penelitian.
- **Fungsional & Terarah**: Menghindari elemen dekoratif tanpa fungsi nyata (misalnya grafik hiasan atau kartu statistik pura-pura). Mengutamakan daftar proyek, tindakan pengguna, dan kejelasan status izin.
- **Transparan & Akuntabel**: Status data, sumber referensi AI, dan batas akses izin selalu ditunjukkan secara eksplisit tanpa asumsi tersembunyi.

---

## 2. Palet Warna (Color Palette)

Aplikasi menggunakan tema gelap keunguan (*dark theme*) dengan kontras tinggi untuk kenyamanan membaca dalam durasi panjang. Seluruh nilai warna dipusatkan sebagai token CSS pada `src/app/globals.css`:

| Peran Token | Kode Warna | Penggunaan |
|---|---|---|
| **Latar Belakang (Background)** | `#0E0C11` | Warna latar utama canvas aplikasi |
| **Permukaan (Surface)** | `#23182E` | Sidebar, kartu proyek, modal dialog, panel sheet |
| **Teks Primer (Foreground)** | `#FAF7FF` | Judul utama, nama proyek, teks penting |
| **Teks Sekunder (Muted)** | `#CDB8E1` | Deskripsi proyek, isi paragraf, label dan metadata sekunder |
| **Garis Batas (Border)** | `#3A2B47` | Garis pembatas kartu, header, dan input |
| **Aksen Lavender (Primary)** | `#C4A5EF` | Fokus keyboard, indikator menu aktif, aksen ikon |
| **Aksen Pink (Primary Hover)** | `#EDAED5` | Titik akhir gradasi tombol utama |
| **Tombol Utama** | `linear-gradient(135deg, #C4A5EF, #EDAED5)` | Latar tombol utama dengan teks gelap `#180F22` |
| **Permukaan Sekunder (Secondary)** | `#2D2039` | Latar item menu aktif, tab aktif, chip |

**Aturan Gradasi**: gradasi hanya dipakai pada tombol utama (`.gradient-primary`). Permukaan lain memakai warna solid agar kartu proyek tetap mudah dibaca.

### Warna Status (Sukses / Peringatan / Gagal)
Status semantik dipertahankan, disesuaikan untuk permukaan gelap:
- **Sukses**: `bg-emerald-500/10 border-emerald-400/30 text-emerald-100`
- **Peringatan**: `bg-amber-500/10 border-amber-400/30 text-amber-200`
- **Gagal / Error**: `bg-rose-500/10 border-rose-400/30 text-rose-100`

### Warna Status Peran (Role Badges)
- **Owner**: lavender — `bg-primary/15 text-primary border-primary/30`
- **Editor**: indigo — `bg-indigo-500/15 text-indigo-200 border-indigo-400/30`
- **Viewer**: netral — `bg-secondary/70 text-muted-foreground border-border`

---

## 3. Tipografi

- **Font Keluarga**: Geist Sans (`var(--font-geist-sans)`), dengan fallback sistem `system-ui, -apple-system, sans-serif`.
- **Font Kode/Mono**: Geist Mono (`var(--font-geist-mono)`), untuk alamat WebID dan URI RDF.
- **Hierarki Tipografi**:
  - `H1 (Page Title)`: 24 px (`text-2xl`), bold (`font-bold`), letter-spacing tight (`tracking-tight`).
  - `H2 (Dialog / Sheet Title)`: 20 px (`text-xl`), bold (`font-semibold` / `font-bold`).
  - `H3 (Card Title)`: 16 px (`text-base`), semibold (`font-semibold`).
  - `Body Text`: 14 px (`text-sm`), regular/medium, leading relaxed (`leading-relaxed`).
  - `Metadata / Footnote`: 12 px (`text-xs`), text-slate-500.
  - `Badges & Micro-copy`: 10–11 px (`text-[11px]`), font-medium.

---

## 4. Spacing & Bentuk Geometris

- **Sistem Grid & Spacing**: Berbasis kelipatan 8 px (8px, 16px, 24px, 32px), dengan variasi 4px atau 12px untuk elemen padat.
- **Border Radius**:
  - Input, Tombol Kecil, Badge: `rounded-lg` (8 px).
  - Kartu Proyek, Alert Banner, Modal Dialog: `rounded-xl` (12 px).
- **Elevasi & Bayangan**:
  - Kartu dan tombol: `shadow-xs` hingga `shadow-sm` tipis.
  - Modal & Sheet: `shadow-lg` / `shadow-xl` dengan backdrop gelap `bg-black/70`.

---

## 5. Layout & Tata Letak Responsif

- **Sidebar Desktop**: Lebar tetap ~240 px (`w-60`), menempel di kiri dengan permukaan `bg-card` dan pemisah `border-r border-border`.
- **Top Header**: Tinggi 64 px (`h-16`), ringkas, sticky di bagian atas dengan efek latar blur ringan `backdrop-blur-xs` di atas `bg-background/85`.
- **Main Content**: Maksimal lebar 1152 px (`max-w-6xl`), berada di tengah (`mx-auto`), dengan padding fleksibel `p-4 sm:p-6 lg:p-8`.
- **Mobile Viewport (< 768 px)**:
  - Sidebar disembunyikan dan digantikan oleh tombol hamburger di header.
  - Drawer navigasi membuka dari kiri menggunakan sliding sheet.
  - Tata letak kartu proyek beralih dari 2 kolom ke 1 kolom tanpa overflow horizontal.

---

## 6. Aksesibilitas (A11y)

1. **Fokus Keyboard Terlihat**: Seluruh elemen interaktif memiliki `focus-visible:ring-2 focus-visible:ring-ring` (lavender `#C4A5EF`) dengan offset 2 px terhadap permukaan di bawahnya; ring global juga didefinisikan pada `*:focus-visible`.
2. **Label Form Eksplisit**: Semua input memiliki `<label>` terkait atau atribut `aria-label`/`aria-labelledby`.
3. **Pemberitahuan Status**: Banner menggunakan `role="alert"` untuk pengguna pembaca layar.
4. **Navigasi Escape**: Semua panel modal Dialog dan sliding Sheet otomatis menutup saat pengguna menekan tombol `Escape`.

