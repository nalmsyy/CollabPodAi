# CollabPod AI — Konteks Proyek & Pedoman Arsitektur

Dokumen ini merangkum konsep inti, batasan MVP, arsitektur desentralisasi, serta peta jalan implementasi untuk CollabPod AI.

---

## 1. Konsep Produk

CollabPod AI adalah aplikasi kolaborasi tugas dan penelitian kecil untuk kelompok mahasiswa. Aplikasi ini menggabungkan penyimpanan terdesentralisasi berbasis **Solid Protocol** dengan asistensi kecerdasan buatan (**Gemini API**) yang bertanggung jawab, transparan, dan dapat diverifikasi sumbernya.

### Masalah yang Diselesaikan
- **Kepemilikan Data Mahasiswa**: Dokumen riset dan tugas kelompok sering kali tersebar di platform cloud terpusat yang memanfaatkan data pengguna untuk pelatihan model tanpa izin eksplisit.
- **Transparansi Asisten AI**: Mahasiswa membutuhkan jawaban AI yang menyertakan sitasi atau referensi potongan dokumen asli secara langsung, bukan halusinasi tanpa rujukan.
- **Kontrol Akses Granular**: Izin membaca dokumen tim dan izin memberikan data dokumen kepada AI harus dipisahkan secara tegas.

---

## 2. Batas Awal MVP (Minimum Viable Product)

- **Ukuran Kelompok**: 2–5 pengguna per workspace proyek.
- **Kapasitas Dokumen**: Maksimal 10 dokumen per workspace proyek.
- **Batas Ukuran Berkas**: Maksimal 5 MB per berkas.
- **Format Berkas**: Dokumen teks terstruktur berupa PDF berbasis teks (bukan hasil scan gambar) dan plain text (.TXT).
- **Di Luar Cakupan MVP**:
  - OCR (Optical Character Recognition) untuk dokumen hasil scan.
  - Chat sinkronus real-time (WebSocket / WebRTC).
  - Kolaborasi editor teks live (seperti Google Docs / OT / CRDT).
  - Vector database terpusat (Pinecone, Weaviate, dll.).

---

## 3. Pedoman Arsitektur Inti

### 3.1. Penyimpanan Terdesentralisasi (Solid Pod)
- **Pod Owner**: Workspace proyek tersimpan secara fisik dan logis pada Solid Pod milik Owner proyek.
- **Akses Multi-Pengguna**: Anggota lain mengakses workspace proyek menggunakan sesi Solid mereka sendiri.
- **Format Data**:
  - Data metadata terstruktur disimpan dalam format standar RDF (Resource Description Framework) menggunakan serialisasi Turtle (`.ttl`).
  - Berkas dokumen riset (PDF dan TXT) disimpan sebagai berkas biner/teks asli di dalam kontainer dokumen Pod.
- **Penegakan Izin (WAC - Web Access Control)**:
  - Hak akses ditegakkan langsung oleh server Solid Pod melalui berkas ACL (`.acl`).
  - Menyembunyikan tombol aksi pada UI peramban tidak menggantikan verifikasi izin server.

### 3.2. Model Peran (Roles)
- **Owner (Pemilik Workspace)**:
  - Mengatur keanggotaan dan penetapan role.
  - Mengonfigurasi hak akses WAC (Read, Write, Control).
  - Memberikan atau mencabut persetujuan pemrosesan dokumen untuk AI.
- **Editor**:
  - Membaca, mengunggah, dan mengelola dokumen serta papan tugas.
  - Tidak memiliki wewenang mengubah ACL Pod atau persetujuan dokumen untuk AI.
- **Viewer**:
  - Hanya membaca konten dokumen dan tugas bersama.
  - Berhak mengajukan pertanyaan kepada AI sejauh sumber dokumen telah memenuhi izin baca dan persetujuan pemrosesan AI.

### 3.3. Pemisahan Izin Baca Dokumen & Persetujuan AI
- Izin membaca dokumen (WAC Read) dan izin pemrosesan AI merupakan **dua pemeriksaan independen**.
- Dokumen hanya boleh diproses oleh AI gateway jika:
  1. Pengguna memiliki izin baca (WAC Read) ke dokumen tersebut di Pod.
  2. Owner telah memberikan persetujuan eksplisit untuk dokumen tersebut diproses AI.
- **Hash Integrity Binding**: Persetujuan AI terikat pada URL berkas dan hash konten dokumen (`SHA-256`). Jika isi dokumen diubah, persetujuan versi sebelumnya otomatis gugur/batal hingga ditinjau ulang oleh Owner.

### 3.4. Alur Pemrosesan AI Gateway & Privasi
- **Client-Side Extraction**: Browser anggota membaca berkas dokumen langsung dari Pod, melakukan ekstraksi teks lokal, dan memilih potongan konteks (chunking & context selection) yang relevan dengan pertanyaan.
- **Privasi Gateway**: AI Gateway (Next.js Route Handler) hanya menerima prompt pertanyaan dan potongan teks terpilih. Gateway **tidak pernah** menerima token autentikasi Pod pengguna dan **tidak pernah** mengunduh berkas dari URL sumber secara independen.
- **Verifikasi Jawaban**: Setiap jawaban yang dihasilkan Gemini wajib menyertakan potongan kutipan dokumen sumber.
- **Usulan Tugas (Task Suggestion)**: Usulan tugas baru yang direkomendasikan AI harus melalui konfirmasi eksplisit pengguna sebelum disimpan ke Pod.
- **Data AI Pribadi**: Riwayat pertanyaan dan preferensi AI pribadi tersimpan di Pod masing-masing pengguna, bukan pada server bersama.

---

## 4. Status Implementasi Tahap 1 vs Tahap Selanjutnya

| Modul / Kemampuan | Status Tahap 1 | Rencana Tahap Lanjutan |
|---|---|---|
| **Setup & Fondasi Arsitektur** | ✅ Selesai (Next.js 16, TS Strict, Tailwind v4, Geist) | Pemeliharaan arsitektur modular |
| **Design System Akademik** | ✅ Selesai (Teal `#0F766E`, Accessible, Responsive) | Komponen khusus viewer dokumen & papan kanban |
| **Demo Dashboard Proyek** | ✅ Selesai (Pencarian, Filter, Dialog, Sheet, Feedback) | Integrasi navigasi ke detail workspace |
| **Abstraksi Data Proyek** | ✅ Selesai (`IProjectRepository`, InMemory State) | Implementasi `SolidPodProjectRepository` (LDP/RDF) |
| **Autentikasi Solid / WebID** | ✅ Selesai Tahap 2A (masuk/keluar lewat IdP, tampil WebID, sesi dipulihkan setelah refresh) | Penulisan data ke Pod & penegakan role |
| **Penemuan Pod dari Profil** | ✅ Selesai Tahap 2B (`getPodUrlAll` dengan `session.fetch`, pemilihan Pod dalam sesi aktif) | Pemakaian Pod terpilih untuk proyek & dokumen |
| **Penyimpanan Proyek Privat** | ✅ Selesai Tahap 2C (`collabpod/projects/{id}/config/project.ttl`, ACL privat pemilik, `project-index.ttl` per pengguna) | Undangan anggota, unggah dokumen, papan tugas, AI |
| **Detail Proyek & Workspace** | ✅ Selesai Tahap 2D (kartu membuka `/dashboard/detail/[projectId]`, tetap terbaca setelah refresh, membedakan tidak ditemukan vs akses ditolak) | Edit metadata, anggota, tugas, AI |
| **Ketahanan & Verifikasi Izin Pod** | ✅ Selesai Tahap 2E (`resourceExists` hanya menganggap 404/410 sebagai belum ada; ACL dibaca ulang sebelum metadata ditulis; umpan balik akses vs koneksi dipisahkan; regresi `node:test`) | Uji dengan Pod kedua, pengujian beban, penanganan konflik tulis |
| **Manajemen Dokumen & Pod Storage**| ✅ Selesai Tahap 3A (Upload berkas asli PDF/TXT ke `{workspace}/data/documents/{id}/file.{pdf,txt}`, metadata RDF `metadata.ttl`, unduh dengan `session.fetch`, validasi 5MB/10 berkas, retry tanpa duplikat) | Pratinjau PDF, penghapusan/revisi berkas |
| **Penegakan WAC ACL** | ✅ Sebagian Tahap 2E & 3A (ACL privat Owner ditulis lalu diverifikasi baca ulang; dokumen mewarisi ACL privat workspace; role Editor/Viewer belum) | Penulisan file `.acl` untuk Editor dan Viewer |
| **Ekstraksi Teks & Persetujuan AI**| ⏳ Belum diimplementasikan (Dokumen belum disetujui untuk pemrosesan AI) | Ekstraksi PDF lokal, hashing SHA-256 consent binding |
| **AI Gateway (Gemini API)** | ⏳ Belum diimplementasikan | Next.js Route Handler dengan Google Gen AI SDK |
| **Papan Tugas Kolaboratif** | ⏳ Belum diimplementasikan | Tugas tim berbasis RDF Turtle |

