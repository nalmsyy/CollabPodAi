# Sistem tampilan CollabPod

Acuan: https://collabpod-research-studio.jomkl.chatgpt.site

Tema: ivory dan hijau sage. Warna utama berada pada variabel CSS di `src/app/globals.css`: paper `#fcfbf8`, sidebar `#f3f2ed`, tinta `#2b3027`, garis `#e3e6da`, olive `#53643e`.

Judul memakai Newsreader dengan fallback serif. Teks memakai DM Sans dengan fallback sans-serif. Font daring memerlukan koneksi; fallback tetap menjaga keterbacaan.

Sidebar desktop memuat proyek aktif, lima modul utama, chat terbaru, koneksi Pod, dan pengaturan. Breadcrumb mempertahankan konteks proyek saat pengguna berpindah modul. Pada layar kecil, sidebar menjadi drawer.

Ringkasan memakai dua kolom: kegiatan utama di tengah dan sumber proyek di kanan. Chat memakai area pesan dan composer terpisah, dengan panel konteks berisi dokumen, keputusan, serta chat terkait. Dokumen, anggota, dan papan tugas mempunyai layar sendiri.

Tombol sumber membuka rincian kutipan. Formulir memakai dialog dengan label dan fokus keyboard. Status koneksi selalu membedakan demo browser dari workspace Solid. Tidak ada tombol yang menampilkan seolah data demo telah tersimpan ke Pod.
