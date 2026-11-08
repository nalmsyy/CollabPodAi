# CollabPod AI

> Aplikasi web kolaborasi tugas dan penelitian kecil untuk kelompok mahasiswa berbasis Solid Pod dan AI terpercaya.

---

## Gambaran Proyek

CollabPod AI memungkinkan mahasiswa bekerja sama dalam kelompok riset 2–5 orang, menyimpan dokumen dan tugas secara terdesentralisasi pada Solid Pod milik Owner proyek, serta memanfaatkan asistensi Gemini AI dengan kutipan rujukan dokumen yang dapat diverifikasi secara transparan.

Saat ini proyek berada pada **Tahap 3A**: fondasi Tahap 1 dan 2 (setup, design system, dashboard demo, login Solid, penemuan Pod, pembuatan proyek privat) ditambah **penyimpanan dokumen dasar di Solid Pod**. Pemilik proyek (Owner) dapat mengunggah berkas PDF dan TXT asli langsung ke Pod, melihat daftar dokumen, dan mengunduh berkas dengan verifikasi read-back dan pembatasan WAC.

---

## Teknologi yang Digunakan

- **Framework**: [Next.js](https://nextjs.org/) (App Router, React 19, TypeScript strict mode)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/) dengan `@tailwindcss/postcss`
- **Komponen UI**: Fondasi kustom berbasis prinsip [shadcn/ui](https://ui.shadcn.com/) dan `@radix-ui/react-dialog`
- **Ikon**: [Lucide React](https://lucide.dev/)
- **Tipografi**: Geist Sans & Geist Mono (paket lokal `geist`)
- **Penyimpanan Terdesentralisasi**: [Solid Protocol](https://solidproject.org/) (WAC ACL, RDF/Turtle, Linked Data Platform)
- **Server Pengembangan**: Community Solid Server (`@solid/community-server`) dengan konfigurasi WAC dan penyimpanan berkas

---

## Struktur Folder

```text
├── docs/
│   ├── project-context.md      # Konsep produk, batas MVP, dan arsitektur Pod & AI
│   └── design-system.md        # Pedoman visual, warna tema gelap ungu, tipografi, dan aksesibilitas
├── scripts/
│   └── patch-componentsjs.mjs  # Patch penanganan path dengan spasi pada Windows untuk Community Solid Server
├── src/
│   ├── app/
│   │   ├── dashboard/
│   │   │   ├── detail/[projectId]/ # Halaman detail proyek Solid dan repositori dokumen
│   │   │   └── page.tsx            # Halaman utama dashboard proyek
│   │   ├── auth/callback/          # Handler callback login Solid OIDC
│   │   ├── globals.css             # Variabel token warna dan gaya Tailwind
│   │   ├── layout.tsx              # Root layout dengan font Geist
│   │   └── page.tsx                # Redirect otomatis ke /dashboard
│   ├── components/
│   │   ├── auth/                   # Dialog login Solid, panel sesi akun
│   │   ├── documents/              # DocumentList, UploadDocumentDialog
│   │   ├── layout/                 # Sidebar, Header, MobileNav
│   │   ├── pods/                   # PodSection, PodSelectionProvider
│   │   ├── projects/               # SolidProjectsSection, ProjectCard, ProjectFilter, Dialog
│   │   └── ui/                     # Button, Input, Textarea, Badge, Dialog, Sheet, Alert
│   ├── data/
│   │   └── demo-projects.ts        # Data awal demo lokal
│   ├── lib/
│   │   ├── solid-document-repository.ts # Repositori dokumen Solid (upload, download, list, hash SHA-256)
│   │   ├── solid-project-repository.ts  # Repositori proyek Solid (WAC, ACL, index, metadata)
│   │   ├── solid-session.ts             # Manajemen sesi browser Solid
│   │   ├── solid-pods.ts                # Penemuan Pod dari profil WebID
│   │   └── utils.ts                     # Helper utility cn()
│   └── types/
│       ├── document.ts             # Definisi tipe ProjectDocument, MIME, validasi
│       └── project.ts              # Definisi tipe Project, ProjectRole, dsb.
├── tests/
│   ├── solid-document-repository.test.mjs # Pengujian unit & regresi repositori dokumen (10 tes)
│   └── solid-project-repository.test.mjs  # Pengujian unit & regresi repositori proyek (10 tes)
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

### 3. Menjalankan Server Solid Lokal (CSS)
```bash
npm run dev:pod
```
Server Solid lokal akan aktif di [http://localhost:3001](http://localhost:3001) dengan penyimpanan berbasis berkas di `.data/community-solid-server/` dan penegakan izin Web Access Control (WAC).

### 4. Menjalankan Server Aplikasi Next.js (Dev)
```bash
npm run dev
```
Aplikasi akan aktif di [http://localhost:3000](http://localhost:3000) dan mengarahkan otomatis ke `/dashboard`.

### 5. Build untuk Produksi
```bash
npm run build
npm run start
```

### 6. Pengujian & Pemeriksaan Kualitas Kode
```bash
# Menjalankan 20 pengujian unit & regresi
npm test

# TypeScript strict check
npx tsc --noEmit

# Pemeriksaan linter ESLint
npm run lint
```

---

## Fitur & Interaksi yang Berfungsi

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
- [x] **Detail Proyek Baca-saja (Tahap 2D)**: Kartu proyek Solid membuka `/dashboard/detail/[projectId]`. Halaman memulihkan sesi setelah refresh, mencocokkan Pod pengguna, menemukan proyek lewat indeks, lalu menampilkan nama, deskripsi, WebID pemilik, waktu dibuat, dan Pod asal. ID yang tidak ada di indeks dan akses yang ditolak server diberi pesan berbeda.
- [x] **Ketahanan Pod & Verifikasi Izin (Tahap 2E)**: Pemeriksaan keberadaan resource hanya menganggap HTTP 404/410 sebagai "belum ada"; 401/403, 5xx, dan kegagalan jaringan diteruskan sebagai kegagalan sehingga indeks tidak pernah dibuat atau ditimpa secara keliru. Setelah ACL disimpan, ACL dibaca ulang dengan `session.fetch` dan diverifikasi untuk pemilik, publik, agen lain, serta grup lain sebelum metadata dan indeks ditulis.
- [x] **Penyimpanan Dokumen Dasar di Pod (Tahap 3A)**:
  - **Upload Berkas Asli**: Pemilik dapat mengunggah berkas PDF dan TXT (maks. 5 MB per berkas, maks. 10 dokumen per proyek).
  - **Struktur Pod**: Menyimpan berkas biner di `{workspace}/data/documents/{id}/file.{pdf,txt}` dan metadata di `{workspace}/data/documents/{id}/metadata.ttl`.
  - **Metadata RDF**: Menyimpan ID stabil, nama asli, URL berkas, MIME type, ukuran byte, waktu unggah, WebID pengunggah, dan hash SHA-256.
  - **Verifikasi Read-back**: Status sukses hanya ditampilkan setelah berkas biner dan metadata RDF diverifikasi terbaca kembali dari Pod.
  - **Retry Tanpa Duplikat**: Jika proses terputus sebagian, ID dokumen dipertahankan untuk retry tanpa membuat entri ganda di Pod.
  - **Unduh Dokumen**: Tombol unduh membaca berkas menggunakan `session.fetch` terotentikasi, memicu unduhan browser lewat Blob URL, dan segera membersihkan Blob URL untuk mencegah kebocoran memori.
  - **Isolasi Entri Belum Lengkap**: Entri yang rusak/tidak lengkap dipisahkan dan tidak dianggap sebagai dokumen valid, serta tidak menyebabkan seluruh daftar proyek menjadi kosong.

### Struktur Data Dokumen di Pod

```text
{workspace}/data/documents/{id}/file.pdf         # Berkas asli biner PDF (atau file.txt)
{workspace}/data/documents/{id}/metadata.ttl     # Metadata RDF/Turtle
```

Izin privat diwarisi langsung dari workspace proyek yang memiliki `acl:default` untuk pemilik, sehingga tidak perlu menulis ulang ACL saat mengunggah dokumen. Dokumen yang diunggah belum mendapatkan persetujuan pemrosesan AI (direncanakan pada tahap berikutnya).
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
