# CollabPod AI

> Aplikasi web kolaborasi tugas dan penelitian kecil untuk kelompok mahasiswa berbasis Solid Pod dan AI terpercaya.

---

## Gambaran Proyek

CollabPod AI memungkinkan mahasiswa bekerja sama dalam kelompok riset 2–5 orang, menyimpan dokumen dan tugas secara terdesentralisasi pada Solid Pod milik Owner proyek, serta memanfaatkan asistensi Gemini AI dengan kutipan rujukan dokumen yang dapat diverifikasi secara transparan.

Saat ini proyek berada pada **Tahap 2E**: fondasi Tahap 1 (setup, design system, dashboard demo) ditambah login Solid, tampilan WebID, logout, pembacaan alamat Pod dari profil Solid, pembuatan proyek privat di Pod terpilih (metadata RDF + indeks proyek), halaman detail baca-saja yang tahan refresh, serta penanganan kegagalan Pod dan verifikasi ACL privat sebelum metadata ditulis.

---

## Teknologi yang Digunakan

- **Framework**: [Next.js](https://nextjs.org/) (App Router, React 19, TypeScript strict mode)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) dengan `@tailwindcss/postcss`
- **Komponen UI**: Fondasi kustom berbasis prinsip [shadcn/ui](https://ui.shadcn.com/) dan `@radix-ui/react-dialog`
- **Ikon**: [Lucide React](https://lucide.dev/)
- **Tipografi**: Geist Sans & Geist Mono (paket lokal `geist`)
- **Penyimpanan Masa Depan**: [Solid Protocol](https://solidproject.org/) (WAC ACL, RDF/Turtle)

---

## Struktur Folder

```text
├── docs/
│   ├── project-context.md      # Konsep produk, batas MVP, dan arsitektur Pod & AI
│   └── design-system.md        # Pedoman visual, warna teal, tipografi, dan aksesibilitas
├── src/
│   ├── app/
│   │   ├── dashboard/
│   │   │   └── page.tsx        # Halaman utama dashboard demo proyek
│   │   ├── globals.css         # Variabel token warna dan gaya Tailwind
│   │   ├── layout.tsx          # Root layout dengan font Geist
│   │   └── page.tsx            # Redirect otomatis ke /dashboard
│   ├── components/
│   │   ├── layout/             # Sidebar, Header, MobileNav
│   │   ├── projects/           # Card, Filter, Dialog Buat Proyek, Sheet Ringkasan
│   │   └── ui/                 # Button, Input, Textarea, Badge, Dialog, Sheet, Alert
│   ├── data/
│   │   └── demo-projects.ts    # Data awal demo (Penelitian Kualitas Air, dll.)
│   ├── lib/
│   │   ├── project-storage.ts  # Abstraksi repositori (IProjectRepository)
│   │   └── utils.ts            # Helper utility cn()
│   └── types/
│       └── project.ts          # Definisi tipe Project, ProjectRole, dsb.
├── package.json
└── tsconfig.json
```

---

## Cara Instalasi & Menjalankan

### 1. Prasyarat
- Node.js versi 18.18+ atau 20+ (diuji pada v24.15.0)
- npm versi 9+

### 2. Pasang Dependensi
```bash
npm install
```

### 3. Menjalankan Server Pengembangan (Dev)
```bash
npm run dev
```
Aplikasi akan aktif di [http://localhost:3000](http://localhost:3000) dan mengarahkan otomatis ke `/dashboard`.

### 4. Build untuk Produksi
```bash
npm run build
npm run start
```

### 5. Pemeriksaan Kualitas Kode
```bash
# TypeScript strict check
npx tsc --noEmit

# Pemeriksaan linter ESLint
npm run lint
```

---

## Fitur & Interaksi yang Berfungsi pada Tahap 1

- [x] **Pencarian Real-time**: Menyaring daftar proyek berdasarkan nama dan deskripsi.
- [x] **Filter Tab**: Mengelompokkan proyek berdasarkan tab "Semua", "Milik saya" (Owner), dan "Diikuti" (Editor/Viewer).
- [x] **Pembuatan Proyek Demo**: Dialog pembuatan proyek baru dengan validasi nama wajib diisi dan pemilihan peran.
- [x] **Sheet Ringkasan Proyek**: Mengklik kartu proyek membuka panel samping dengan detail arsitektur Solid Pod dan daftar anggota.
- [x] **Empty State**: Tampilan informatif jika pencarian tidak menemukan hasil atau jika daftar kosong.
- [x] **Responsif Mobile**: Drawer navigasi dari sisi kiri saat menggunakan perangkat berlayar kecil.
- [x] **Aksesibilitas Penuh**: Dukungan tombol `Escape` untuk menutup dialog/sheet dan fokus keyboard terlihat jelas.
- [x] **Login Solid (Tahap 2A)**: Masuk melalui penyedia identitas Solid pilihan pengguna, menampilkan WebID, keluar, dan memulihkan sesi setelah refresh. Callback tetap di `/auth/callback` pada origin aktif.
- [x] **Penemuan Pod (Tahap 2B)**: Bagian "Pod saya" membaca alamat Pod dari profil Solid dengan `getPodUrlAll(webId, { fetch: session.fetch })`. Satu Pod dipilih otomatis, beberapa Pod bisa dipilih pengguna, hasil kosong memunculkan "Profil ini belum mencantumkan Pod", dan kegagalan permintaan menampilkan "Gagal memuat daftar Pod" dengan tombol "Coba lagi". Pilihan hanya bertahan selama sesi aktif di tab.
- [x] **Proyek Privat di Pod (Tahap 2C)**: Dialog "Buat proyek" menampilkan Pod tujuan sebelum disimpan, lalu menulis kontainer workspace, ACL privat untuk pemilik (sebelum metadata), `config/project.ttl`, dan referensi ke `project-index.ttl`. Daftar "Proyek saya" dibaca dari indeks Pod, membedakan daftar kosong dari kegagalan baca, dan kosong kembali saat logout atau ganti akun/Pod.
- [x] **Detail Proyek Baca-saja (Tahap 2D)**: Kartu proyek Solid membuka `/dashboard/detail/[projectId]`. Halaman memulihkan sesi setelah refresh, mencocokkan Pod pengguna, menemukan proyek lewat indeks, lalu menampilkan nama, deskripsi, WebID pemilik, waktu dibuat, dan Pod asal. ID yang tidak ada di indeks dan akses yang ditolak server diberi pesan berbeda; tidak ada penulisan ke Pod.
- [x] **Ketahanan Pod & Verifikasi Izin (Tahap 2E)**: Pemeriksaan keberadaan resource hanya menganggap HTTP 404/410 sebagai "belum ada"; 401/403, 5xx, dan kegagalan jaringan diteruskan sebagai kegagalan sehingga indeks tidak pernah dibuat atau ditimpa secara keliru. Setelah ACL disimpan, ACL dibaca ulang dengan `session.fetch` dan diverifikasi untuk pemilik, publik, agen lain, serta grup lain sebelum metadata dan indeks ditulis. Daftar proyek membedakan memuat, indeks kosong, akses ditolak, kegagalan koneksi/server, dan hasil terbaca, dengan tombol "Coba lagi". Regresi dijalankan dengan `npm test` (Node test runner + Pod Solid tiruan).

### Struktur Data Proyek di Pod

```text
{pod}/collabpod/                                   kontainer aplikasi, ACL privat + acl:default pemilik
{pod}/collabpod/project-index.ttl                  indeks proyek privat milik pengguna
{pod}/collabpod/projects/{id}/                     workspace proyek (ID stabil)
{pod}/collabpod/projects/{id}/config/project.ttl   metadata: nama, deskripsi, WebID pemilik, waktu dibuat
```

ACL hanya ditulis pada kontainer aplikasi dan kontainer proyek; ACL root Pod dan folder lain tidak diubah. Percobaan ulang memakai ID proyek yang sama sehingga tidak membuat duplikat.

> **Pemisahan Mode**: Tanpa sesi Solid, dashboard berjalan dalam mode demo (empat kartu contoh + tombol buat proyek demo). Saat sesi Solid aktif, kartu demo disembunyikan dan dashboard menampilkan WebID, bagian "Pod saya", dan daftar proyek dari indeks Pod terpilih.

> **Catatan Mode Demo**: Seluruh data tersimpan secara lokal di memori peramban dan akan tereset saat halaman dimuat ulang. Pada tahap ini belum ada integrasi server Solid Pod, database terpusat, atau panggilan API Gemini.
