# EduRanker — Sistem Perangkingan Nilai Rapor

EduRanker adalah aplikasi berbasis web interaktif untuk melakukan pengurutan dan perangkingan nilai rapor siswa multi mata pelajaran secara instan. Sistem ini menggunakan algoritma **Counting Sort** untuk mengurutkan nilai rata-rata dari tertinggi ke terendah secara efisien dengan kompleksitas waktu $O(n + k)$.

---

## 1. Spesifikasi Program

* **Bahasa Pemrograman**: JavaScript (Node.js untuk Backend, Vanilla JavaScript untuk Frontend)
* **Teknologi Visual/Tampilan**: HTML5, CSS3 (Vanilla CSS dengan variabel modern), dan Google Material Symbols.
* **Database**: JSON File-based Database (`eduranker_db.json`) sebagai penyimpanan persisten berstruktur data relasional virtual (bebas kendala build compiler pada Windows).

---

## 2. Kebutuhan Library / Dependency

Program ini berjalan di atas runtime Node.js dan membutuhkan library berikut:
* **`express`**: Framework web untuk menangani routing statis dan API.
* **`bcryptjs`**: Digunakan untuk enkripsi password demi keamanan akun pengguna.
* **`express-session`**: Manajemen sesi login pengguna (cookie-based session).

---

## 3. Cara Instalasi & Menjalankan Server Lokal

### Prasyarat
Pastikan komputer Anda sudah terinstal **Node.js** (rekomendasi versi LTS 16 ke atas). Jika belum, unduh dan instal dari [nodejs.org](https://nodejs.org/).

### Langkah-Langkah Menjalankan Aplikasi:

1. **Ekstrak/Buka Folder Project**
   Buka terminal (Command Prompt atau PowerShell di Windows, atau Terminal di macOS/Linux) dan arahkan ke folder ini:
   ```bash
   cd "Counting Sort"
   ```

2. **Instalasi Library (Dependencies)**
   Jalankan perintah berikut untuk mengunduh dan menginstal semua library pendukung yang diperlukan secara otomatis:
   ```bash
   npm install
   ```

3. **Jalankan Server Lokal**
   Nyalakan server web backend dan sistem database dengan menjalankan perintah:
   ```bash
   npm start
   ```

4. **Akses Aplikasi**
   Setelah server menyala dengan log `✅ Database initialized` dan `🎓 EduRanker Server running...`, buka web browser pilihan Anda (Chrome/Firefox/Edge) lalu kunjungi alamat berikut:
   
   🌐 URL: **[http://localhost:3000](http://localhost:3000)**

---

## 4. Akun Login Dummy (Untuk Dosen/Pemeriksa)

Aplikasi memiliki fitur kontrol hak akses berbasis peran (Role-based Access Control). Gunakan salah satu kredensial berikut untuk masuk:

| Role | Username | Password | Deskripsi Hak Akses |
|------|----------|----------|----------------------|
| **Admin (Dosen/Wali Kelas)** | `admin` | `admin123` | Bisa menambah siswa, mengedit nilai, menghapus data, generate data acak, import file CSV, mengekspor laporan rangking, serta melihat detail langkah algoritma. |
| **User (Siswa/Pemeriksa Umum)** | `user` | `user123` | Read-only. Hanya dapat melihat ringkasan performa kelas di Dashboard dan tabel Hasil Ranking yang **otomatis sudah terurut** (menu input, proses algoritma, dan tombol modifikasi disembunyikan secara otomatis). |

---

## 5. Dokumentasi Database & Cara Import (phpMyAdmin)

Program ini menggunakan database **MySQL/MariaDB**.

### A. Persiapan Database (via XAMPP & phpMyAdmin):
1. Buka aplikasi **XAMPP Control Panel**.
2. Klik tombol **Start** pada modul **Apache** dan **MySQL** hingga berwarna hijau.
3. Buka browser dan pergi ke halaman **[http://localhost/phpmyadmin](http://localhost/phpmyadmin)**.
4. Buat database baru dengan nama `eduranker`.
5. Klik tab **Import** di bagian atas, klik **Choose File**, lalu pilih file `database.sql` yang berada di dalam folder project ini.
6. Scroll ke bawah dan klik tombol **Import** (atau **Go**). Database dan data dummy default akan otomatis terisi.

> [!TIP]
> **Fitur Autogenerate**: Jika Anda tidak melakukan import secara manual, server Node.js kami juga memiliki fitur autogenerate yang akan otomatis membuat database `eduranker` beserta tabel dan isi datanya saat Anda pertama kali menjalankan `npm start` (selama MySQL di XAMPP Anda aktif).

---

## 6. Contoh Input & Output Skenario Program

### A. Format Input CSV (Import Massal)
Jika Anda masuk sebagai **Admin**, Anda dapat mengimport file `.csv` dengan memetakan kolom nama dan nilai mata pelajaran secara dinamis.

**Contoh isi file input (`nilai_kelas_10.csv`):**
```csv
Nama Siswa,Matematika,B. Indonesia,B. Inggris,IPA,IPS
Rahmat Hidayat,85,90,80,88,85
Siti Aminah,95,92,90,94,89
Budi Setiawan,70,75,72,68,70
```

### B. Format Output Ekspor (Hasil Ranking)
Pada halaman **Hasil Ranking**, Admin dapat mengklik tombol **Unduh Laporan (CSV)** untuk mendapatkan file excel/csv rangking terurut.

**Contoh file output (`ranking_rapor_2026-xx-xx.csv`):**
```csv
"Ranking","Nama","ID","Matematika","B. Indonesia","B. Inggris","IPA","IPS","Rata-rata","Grade","Status"
"01","Siti Aminah","ER-2024-007","95","92","90","94","89","92.0","A","Lulus"
"02","Rahmat Hidayat","ER-2024-006","85","90","80","88","85","85.6","B","Lulus"
"03","Budi Setiawan","ER-2024-008","70","75","72","68","70","71.0","C","Lulus"
```
*(Catatan: Rata-rata dihitung dinamis berdasarkan mata pelajaran yang diisi, dan status kelulusan KKM diset pada batas rata-rata $\ge 55$)*
