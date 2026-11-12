# Hasil pemeriksaan paket

Pemeriksaan pada 12 November 2026. Runtime Node.js 24.22.1.

| Pemeriksaan | Hasil |
| --- | --- |
| `npm test` | 85 pengujian lulus, 0 gagal |
| TypeScript strict | Lulus, termasuk pemeriksaan pada build terakhir |
| `npm run build` | Berhasil dengan Next.js webpack |
| Dashboard ke workspace | Diperiksa di browser |
| Navigasi ringkasan, chat, dokumen, tugas, anggota | Diperiksa di browser |
| Konteks chat metodologi | Demo memilih potongan dokumen, keputusan tim, dan pesan dari chat latar belakang |
| Rincian sumber antar-chat | Dialog menunjukkan teks serta tautan chat asal |
| Simpan keputusan dari pesan | Tersimpan dan muncul pada konteks proyek |
| Buat dan ubah nama chat | Tersimpan, URL chat tetap mengarah ke ID yang sama |
| Status tugas setelah refresh | Perubahan tetap tersimpan |
| Persetujuan dan pratinjau TXT | Jumlah sumber disetujui berubah dan isi TXT tampil |
| Perubahan peran demo | Viewer dan Editor diperbarui sesuai pilihan |

Pengujian otomatis mencakup isolasi proyek, penolakan sumber yang usang, dependensi keputusan/dokumen lintas jawaban, larangan memakai jawaban demo sebagai bukti, pemeriksaan ulang izin pada cache, dua penulis membuat pesan terpisah, konflik ETag, Viewer baca saja, serta validasi sitasi gateway. Pengujian penyimpanan dan WAC menggunakan Pod tiruan, bukan akun produksi.

Belum diverifikasi langsung pada paket ini: login dengan akun Solid pengguna, kolaborasi dua akun pada penyedia Pod nyata, ekspose ETag oleh CORS penyedia, respons Gemini dengan API key pengguna, serta pemeriksaan visual perangkat mobile. Tidak ada klaim bahwa uji demo membuktikan integrasi layanan tersebut.

Paket ini belum dipush ke GitHub dan belum dipublikasikan. Kunci API, konfigurasi `.env.local`, data akun, `node_modules`, cache build, log, dan data Pod lokal tidak disertakan.
