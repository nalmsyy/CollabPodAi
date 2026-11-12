# Konteks produk dan batas implementasi

CollabPod AI adalah ruang penelitian bersama. Satu proyek menampung dokumen, chat per bagian, keputusan lintas bagian, tugas, dan anggota. Situs referensi menjadi acuan modul dan hierarki tampilan. Catatan rancangan lama yang memusatkan semua fitur dalam satu halaman tidak lagi menjadi struktur antarmuka.

## Unit kerja dan sumber konteks

**Proyek** adalah batas isolasi. Pemilih konteks tidak memiliki riwayat global dari semua proyek. Repositori hanya membaca folder workspace yang sedang dibuka.

**Chat** mewakili fokus pekerjaan. Satu pengguna dapat mengerjakan latar belakang, pengguna lain metodologi. Keduanya membaca dokumen yang sama. Pesan yang relevan dari chat terhubung dapat membantu pertanyaan di chat lainnya.

**Keputusan tim** adalah memori kerja yang ditinjau manusia. Pesan atau jawaban AI tidak otomatis menjadi keputusan. Pengguna harus membuka formulir, memeriksa isi, dan menyimpannya. Pembaruan keputusan mengubah versi waktunya sehingga jawaban turunan yang bergantung pada versi lama tidak masuk konteks baru.

**Dokumen** adalah bukti yang dapat ditelusuri. Owner menyetujui satu versi berdasarkan URL dan SHA-256. Peringkat BM25 memilih potongan yang relevan. Pemeriksaan isi aktual dilakukan lagi sebelum memakai cache ekstraksi. PDF hasil scan membutuhkan OCR di luar fitur saat ini.

**Percakapan** adalah diskusi atau jawaban terdahulu. Label sumber mempertahankan asalnya. Diskusi anggota dan jawaban AI bukan pengganti bukti ilmiah dari dokumen.

**Tugas** adalah hasil tindakan dari diskusi. Setiap tugas memiliki penanggung jawab, deskripsi, status, dan asal chat/pesan bila dibuat dari percakapan.

## Alur contoh

Tim menyepakati parameter kualitas air pada chat latar belakang. Anggota menyimpan kesepakatan itu menjadi keputusan aktif. Saat anggota lain bertanya di chat metodologi, sistem mengambil keputusan tersebut, dokumen yang disetujui, serta pesan relevan dari chat latar belakang. Jawaban dapat menyebut sumber tiap informasi. Bila rencana sampling belum tersedia, AI harus menyatakan kekurangan informasi, bukan membuat angka sampel.

Jika tim kemudian mengubah parameter, anggota memperbarui keputusan. Sistem tidak menulis ulang sejarah chat. Jawaban lama tetap terlihat sebagai riwayat, tetapi konteks yang merujuk versi keputusan lama tidak dipakai untuk generasi berikutnya.

## Perbedaan demo dan Solid

Demo memakai data ilustrasi di localStorage dan jawaban pratinjau deterministik. Tidak ada panggilan AI. Proyek demo baru dimulai kosong agar tidak membawa konteks contoh dari proyek lain.

Mode Solid membaca dan menulis RDF lewat sesi pengguna. Pembatasan akses utama tetap pada server Pod. Folder config hanya ditulis Owner; Editor dapat menulis data bersama. Riwayat Viewer tidak tersimpan bersama dan hilang ketika halaman dimuat ulang.

## Batas yang perlu dipahami

Konsistensi dibantu konteks dan instruksi, bukan jaminan kebenaran model. Retrieval bersifat leksikal dan dibatasi jumlah sumber. Pengguna perlu meninjau keputusan, memperbaiki konflik, serta memastikan sumber ilmiah sesuai klaim. Sinergi dua akun pada Pod nyata dan gateway produksi memerlukan pengujian integrasi terpisah.
