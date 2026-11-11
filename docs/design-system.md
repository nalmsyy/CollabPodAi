# CollabPod AI — Panduan Design System

Dokumen ini mendokumentasikan keputusan visual, token desain, tipografi, dan aturan komponen antarmuka CollabPod AI yang disesuaikan dengan desain referensi studio penelitian bersama.

---

## 1. Filosofi Desain

- **Akademik, Alami & Tenang**: Menghadirkan ruang kerja bergaya kertas riset (*paper studio*) dengan palet warna hangat (*warm cream/paper*) dan aksen hijau zaitun (*olive*) yang nyaman untuk membaca dokumen ilmiah berjam-jam.
- **Fungsional & Terarah**: Mengutamakan konten, dokumen, dan navigasi yang bersih. Menghindari elemen dekoratif tanpa fungsi nyata.
- **Transparan & Akuntabel**: Status privasi data, koneksi Solid Pod, dan persetujuan AI selalu ditunjukkan secara eksplisit.

---

## 2. Palet Warna (Color Palette)

Aplikasi menggunakan tema terang bernuansa kertas hangat (*warm paper theme*) dengan kontras seimbang. Seluruh nilai warna dipusatkan sebagai token CSS pada `src/app/globals.css`:

| Peran Token | Kode Warna | Penggunaan |
|---|---|---|
| **Kertas / Canvas (Paper / Background)** | `#FCFBF8` | Warna latar utama canvas aplikasi |
| **Sidebar (Sidebar Background)** | `#F3F2ED` | Warna latar sidebar navigasi |
| **Garis Pembatas (Line / Border)** | `#E3E6DA` | Garis pembatas antar panel dan header |
| **Batas Kartu (Card Border)** | `#DCE6CE` | Garis pembatas kartu dokumen dan proyek |
| **Kartu / Permukaan (Card Surface)** | `#FFFEFA` / `#FFFFFF` | Latar kartu proyek, dokumen, dialog modal |
| **Teks Primer (Ink / Foreground)** | `#2B3027` | Teks utama, judul, nama proyek |
| **Teks Sekunder (Muted Ink)** | `#7C8471` | Teks sekunder, deskripsi, metadata |
| **Aksen Utama (Olive / Primary)** | `#53643E` | Tombol utama, lencana persetujuan AI, status aktif |
| **Aksen Hover (Primary Hover)** | `#445433` | Status hover tombol utama |
| **Permukaan Sekunder (Secondary)** | `#EDF0E5` | Chip, tab aktif, seleksi |
| **Koneksi Pod (Pod Callout Background)** | `#EDF1E5` | Panel info data Solid di dasar sidebar dan halaman |

### Warna Status & Aksen Tambahan
- **Sukses / Disetujui**: `bg-[#edf4e6] border-[#cadab7] text-[#4d6037]`
- **Peringatan / Sedang Proses**: `bg-amber-50 border-amber-300 text-amber-900`
- **Gagal / Error**: `bg-rose-50 border-rose-300 text-rose-900`

### Warna Status Peran (Role Badges)
- **Owner**: Olive — `bg-primary/10 text-primary border-primary/30`
- **Editor**: Hijau Hutan — `bg-[#4a7c59]/10 text-[#3a6349] border-[#4a7c59]/30`
- **Viewer**: Netral — `bg-secondary/70 text-muted-foreground border-border`

---

## 3. Tipografi

- **Font Keluarga Sans**: `DM Sans`, ui-sans-serif, system-ui, sans-serif untuk antarmuka, tombol, label, dan body text.
- **Font Serif (Heading)**: `Newsreader`, Georgia, serif untuk judul halaman utama (H1) dan judul modal dialog.
- **Font Kode/Mono**: ui-monospace, Cascadia Code, monospace untuk WebID, hash SHA-256, dan URI RDF.
- **Hierarki Tipografi**:
  - `H1 (Page Heading)`: 36 px font-serif, normal weight, letter-spacing tight.
  - `H2 (Section Heading)`: 14–16 px semibold font-sans, uppercase tracking-wider.
  - `Body Text`: 13 px font-sans, regular/medium, leading normal.
  - `Metadata / Micro-copy`: 10–11 px font-sans, muted text.

---

## 4. Bentuk Geometris & Komponen

- **Brand Mark**: Tiga kelopak daun bertumpuk miring dengan gradasi warna olive `#53643e`, `#7e8d6b`, dan `#a6b684`.
- **Border Radius**:
  - Tombol, input, nav-item: `rounded-md` hingga `rounded-lg` (6–8 px).
  - Kartu proyek dan dokumen: `rounded-xl` (12 px).
  - Modal dialog: `rounded-2xl` (16 px).
- **Elevasi & Bayangan**:
  - Kartu proyek memiliki hover transition halus: `hover:-translate-y-1 hover:shadow-[0_8px_22px_rgba(54,85,34,0.07)]`.
  - Backdrop modal dialog: `bg-black/30 backdrop-blur-sm`.

---

## 5. Layout & Tata Letak Responsif

- **Sidebar Desktop**: Lebar 238 px dengan latar `#F3F2ED`, navigasi `Ruang Kerja`, dan panel koneksi Pod di dasar sidebar.
- **Top Header**: Tinggi 62 px dengan breadcrumb dan status `Prototipe interaktif`.
- **Main Content**: Maksimal lebar 1152 px (`max-w-6xl`), berada di tengah (`mx-auto`), dengan padding `px-6 sm:px-9 py-8`.
- **Mobile Viewport (< 768 px)**: Drawer navigasi membuka dari kiri dengan backdrop scrim halus.
