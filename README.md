# CollabPod AI

Workspace penelitian kolaboratif berbasis Solid Pod. Setiap bagian penelitian memiliki chat sendiri. Dokumen yang disetujui Owner, keputusan tim, dan percakapan relevan dalam proyek yang sama membentuk konteks jawaban AI.

Navigasi mengikuti modul referensi CollabPod Research Studio: **Ringkasan, Ruang chat, Dokumen, Papan tugas, Anggota & akses, dan Pengaturan**. Tema memakai hijau sage, ivory, judul serif, dan sidebar tetap. Fitur-fitur tidak lagi ditumpuk pada satu halaman panjang.

## Menjalankan di komputer

Gunakan Node.js **24** dan npm. Pengujian memakai dukungan TypeScript bawaan Node.

```bash
npm ci
npm run dev -- --port 49400
```

Buka `http://localhost:49400`. Tanpa login, buka kartu **Riset kualitas air** untuk mencoba seluruh navigasi. Demo menyimpan perubahan di browser dan memperagakan pemilihan konteks. Demo tidak memanggil Gemini dan tidak menyinkronkan data ke pengguna lain.

Untuk AI pada proyek Solid, salin `.env.example` menjadi `.env.local`, lalu isi `GEMINI_API_KEY` pada komputer sendiri. `GEMINI_MODEL` mengikuti model yang tersedia untuk kunci tersebut. Restart server setelah mengubah konfigurasi. Jangan membagikan atau commit `.env.local`.

Untuk server Pod pengembangan lokal, jalankan `npm run dev:pod` pada terminal lain. Untuk Pod yang sudah dimiliki, gunakan penyedia identitas Solid yang sama seperti sebelumnya.

## Alur kerja tim

1. Owner masuk dengan Solid, memilih Pod, lalu membuat atau membuka proyek.
2. Pada **Anggota & akses**, Owner memasukkan WebID lengkap teman sebagai Editor atau Viewer. Salin tautan proyek dan bagikan sendiri kepada anggota.
3. Owner/Editor mengunggah PDF berisi teks atau TXT pada **Dokumen**. Batas: 10 dokumen, 5 MB per berkas. Owner meninjau dan menyetujui versi yang boleh menjadi konteks AI.
4. Buat chat berdasarkan bagian, misalnya **Latar belakang**, **Metodologi**, dan **Hasil & pembahasan**. Chat yang terhubung dapat memberikan konteks kepada chat lain dalam proyek itu.
5. Tinjau hasil diskusi. Pilih **Jadikan konteks bersama** untuk menyimpan keputusan yang menjadi pegangan semua chat. Jangan menyimpan usulan yang belum disepakati sebagai keputusan final.
6. Ajukan pertanyaan di chat lain. Aplikasi membaca kembali data proyek, memeriksa izin serta persetujuan dokumen, memilih konteks, lalu memanggil Gemini. Tombol sumber menampilkan kutipan, asal chat, atau dokumen terkait.
7. Pilih **Jadikan tugas** pada pesan atau buat tugas melalui papan. Tentukan penanggung jawab dan ubah statusnya.

| Peran | Kemampuan di aplikasi |
| --- | --- |
| Owner | Seluruh fitur, mengelola anggota, identitas proyek, dan persetujuan AI |
| Editor | Dokumen, chat bersama, keputusan tim, dan tugas; tidak mengubah persetujuan AI atau anggota |
| Viewer | Membaca proyek; dapat mencoba AI pada sesi pribadi di memori tab, tanpa menulis ke percakapan bersama |

Chat Owner/Editor terbuka bagi seluruh anggota proyek. Menonaktifkan **Hubungkan chat ini ke konteks AI proyek** menghentikan pencarian antar-chat untuk chat tersebut, bukan menyembunyikan riwayatnya dari anggota.

## Menggunakan proyek lama

- Ekstrak paket ini ke folder baru, pasang dependensi, lalu salin konfigurasi `.env.local` milikmu sendiri. Jangan menimpa satu-satunya salinan pekerjaan lokal.
- URL lama `/dashboard/detail/[projectId]?pod=...` tetap digunakan. Subhalaman memakai `view` dan `chat` pada URL.
- Dokumen serta metadata lama tetap dibaca dari Pod. Chat dan tugas baru tersimpan pada subfolder `data/` proyek yang sama.
- **Owner perlu menyetujui ulang dokumen lama satu kali.** Flag persetujuan lama di metadata dokumen tidak lagi menjadi otorisasi karena Editor memiliki hak tulis di `data/`. Persetujuan kini berada di `config/ai-policy/`, diikat ke URL berkas dan hash SHA-256, dengan izin tulis Owner.
- Riwayat dari komponen Tanya AI lama yang hanya berada di memori browser tidak dapat dimigrasikan setelah sesi tersebut hilang.

## Penyimpanan dan sinkronisasi

Di dalam setiap workspace Pod:

```text
config/project.ttl                 identitas proyek
config/members.ttl                 anggota dan peran
config/ai-policy/{documentId}.ttl   persetujuan Owner per versi

data/documents/{id}/metadata.ttl   metadata dokumen
data/documents/{id}/file.pdf        berkas PDF atau file.txt
data/threads/{id}.ttl              fokus chat
data/messages/{id}.ttl             satu pesan beserta sumber
data/decisions/{id}.ttl            satu keputusan tim
data/tasks/{id}.ttl                satu tugas
```

Setiap pesan memiliki resource sendiri. Pembuatan memakai `If-None-Match: *`; perubahan memakai strong ETag dan `If-Match`. Konflik ditampilkan, tidak ditimpa diam-diam. Pod perlu mengizinkan browser membaca header ETag melalui CORS. Akses ke `data/` dan `config/` mengikuti WAC yang sudah digunakan proyek.

Sinkronisasi berlangsung setiap 15 detik saat tab aktif, saat kembali ke tab, lewat tombol muat ulang, dan sebelum permintaan AI. Ini polling, belum sinkronisasi WebSocket. Pesan dan keputusan berada di Pod pemilik proyek, bukan hanya localStorage masing-masing anggota.

## Cara konteks AI bekerja

- Dokumen: ekstraksi di browser, potongan teks, lalu peringkat BM25. Ini retrieval leksikal, belum embedding atau vector database.
- Keputusan: pilih keputusan aktif dengan relevansi dan waktu pembaruan. Keputusan membantu konsistensi ruang lingkup, variabel, istilah, dan metode.
- Percakapan: gunakan riwayat singkat chat aktif dan pesan relevan dari chat lain yang terhubung. Jawaban AI tanpa sumber tidak menjadi bukti baru.
- Sumber turunan membawa versi dokumen dan keputusan asal. Pencabutan persetujuan, perubahan hash, pengarsipan atau pembaruan keputusan membuat konteks turunan yang usang tidak dipakai untuk jawaban berikutnya.
- Batas tiap permintaan: 12 sumber, total teks konteks maksimal 23.000 karakter dari pemilih konteks. Riwayat panjang tidak seluruhnya dikirim. Keputusan penting sebaiknya disimpan sebagai konteks bersama.
- Gateway memberi label `[S1]`, `[S2]`, dan seterusnya. Jawaban tanpa label valid atau dengan nomor sumber di luar konteks ditolak. Pemeriksaan label tidak membuktikan setiap klaim benar; pengguna tetap perlu meninjau isi dan sumber.
- Instruksi AI membedakan bukti dokumen, keputusan tim, dan diskusi sementara. Bila bertentangan, AI diminta menjelaskan konflik, bukan mengubah keputusan diam-diam.

Kunci Gemini hanya berada di server. Potongan terpilih, pesan pertanyaan, keputusan, dan konteks percakapan dikirim ke Gemini pada mode Solid. Pencabutan izin tidak menarik kembali salinan yang sudah diterima anggota atau layanan AI.

## Pemeriksaan

```bash
npm test
npx tsc --noEmit
npm run build
```

Lihat `docs/validation.md` untuk hasil pemeriksaan pada paket ini. Pengujian repositori memakai server tiruan. Uji login nyata, dua akun Solid, CORS ETag pada penyedia Pod, serta respons Gemini dengan kunci milikmu tetap diperlukan sebelum digunakan bersama tim.

Gateway saat ini ditujukan untuk pengembangan. Pemeriksaan origin bukan autentikasi pengguna. Sebelum hosting publik, tambahkan autentikasi server dan pembatasan penggunaan API. Jangan menganggap pemeriksaan konteks di browser sebagai validasi otorisasi server terhadap payload yang sengaja dipalsukan.

## Berkas utama

- `src/components/workspace/`: navigasi dan seluruh modul workspace.
- `src/lib/workspace-repository.ts`: penyimpanan chat, pesan, keputusan, tugas.
- `src/lib/project-context.ts`: pemilihan konteks antar-chat dan pelacakan versinya.
- `src/lib/solid-document-repository.ts`: berkas, hash, dan persetujuan Owner.
- `src/lib/retrieval.ts`: ekstraksi, cache terverifikasi, dan BM25.
- `src/lib/ai-gateway.ts`, `src/app/api/ask/route.ts`: kontrak serta panggilan Gemini.
- `src/app/workspace.css`: tata letak workspace.
