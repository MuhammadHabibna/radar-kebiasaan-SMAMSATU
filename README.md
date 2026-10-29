# 📋 Panduan Lengkap Web Form Monitoring 7 KAIH
### **VERTIKAL SMA 2026 — Kemendikdasmen RI**
*Sistem Monitoring 7 Kebiasaan Anak Indonesia Hebat Berbasis Google Sheets Serverless (100% Gratis / Rp 0)*

---

## 🌟 1. Ringkasan Proyek & Tujuan

Aplikasi ini adalah platform pemantauan harian pelaksanaan program **7 Kebiasaan Anak Indonesia Hebat (7 KAIH)** yang dirancang untuk siswa SMA (Kelas X dan XI) serta Guru BK/Panitia Sekolah.

Aplikasi dibangun dengan arsitektur **Serverless Static Web** yang berkomunikasi langsung dengan database **Google Sheets** melalui **Google Apps Script REST API**. Sistem ini 100% gratis (*zero-cost*), tahan lonjakan ratusan pengiriman data sekaligus (*concurrency safe* via `LockService`), dan ramah digunakan di smartphone maupun laptop.

---

## 📂 2. Penjelasan Fungsi Setiap File Proyek

```
Form Data/
├── index.html            # Gerbang masuk utama (otomatis me-redirect sesuai status login)
├── login.html            # Halaman login siswa & admin (bersih, aman, tanpa emoji berlebih)
├── form.html             # Formulir interaktif wizard 7 pertanyaan kebiasaan
├── dashboard.html        # Dashboard siswa: jadwal 4 sesi, status pengisian & riwayat jawaban
├── admin.html            # Panel Admin: rekapitulasi real-time, filter rombel, dan ekspor CSV
├── auto_test.html        # Simulator pengujian visual browser (dilengkapi saklar ON/OFF)
├── auto_test.js          # Script terminal Node.js untuk pengujian pengisian otomatis
├── package.json          # Konfigurasi npm scripts (build, test, local server)
├── css/
│   ├── style.css         # Desain sistem global (warna, tipografi Plus Jakarta Sans, layout)
│   └── components.css    # Desain kartu pertanyaan, tombol wizard, modal detail, dan animasi SVG
├── js/
│   ├── config.js         # Pengaturan URL Google Apps Script Web App & Spreadsheet ID
│   ├── auth.js           # Manajemen sesi pengguna, role guard, dan basis data jenis kelamin siswa
│   ├── api.js            # Lapisan komunikasi fetch (GET/POST) ke Google Apps Script
│   ├── form.js           # Kontroler alur pengisian form, validasi bertahap, dan logika gender
│   ├── dashboard.js      # Kontroler dashboard siswa & pemformat tanggal Indonesia
│   └── admin.js          # Kontroler panel admin, filter tingkat, dan ekspor CSV
├── backend/
│   ├── Code.gs           # Source code backend Google Apps Script (REST API & Database Engine)
│   ├── SheetsTemplate.md # Petunjuk pembuatan sheet & struktur kolom database
│   └── users_data.tsv    # File master data 358 akun (1 Admin + 357 Siswa) siap copy-paste
└── scripts/
    └── build.js          # Script verifikasi integritas kode dan keterhubungan aset (npm run build)
```

---

## 📊 3. Penjelasan Mendalam Struktur Database Google Sheets

Spreadsheet target menggunakan **4 lembar kerja (sheets)** yang bekerja secara terintegrasi:

Spreadsheet Link: [Buka Google Sheets 7 KAIH](https://docs.google.com/spreadsheets/d/1mOZ5wnaW4SCVRDdfgJd8rSFqs11fyndA-y9AuWoXpQ0/edit)

---

### Tab 1: Sheet `Users` (Master Data Pengguna)
Sheet ini menyimpan seluruh daftar akun login siswa dan panitia.
- **Urutan Kolom**:
  1. `uid`: Username login (menggunakan Nomor Induk siswa, misal: `12452`).
  2. `nama`: Nama lengkap asli siswa (contoh: `AHMAD HISYAM AIZAR`).
  3. `kelas`: Rombongan belajar asli (contoh: `X-1`, `X-2`, `XI Saintek 1`, `XI Soshum 2`).
  4. `tingkat`: Jenjang kelas (`10` untuk kelas X, `11` untuk kelas XI).
  5. `jk`: Jenis Kelamin (`L` untuk Laki-laki, `P` untuk Perempuan) — *Mendasari logika opsi berhalangan di form*.
  6. `password`: Kata sandi akun (disamakan dengan Nomor Induk siswa).
  7. `role`: Hak akses sistem (`peserta` untuk siswa, `admin` untuk guru BK/panitia).

---

### Tab 2: Sheet `Submissions` (Penyimpanan Rekaman Jawaban Siswa)
Setiap kali siswa menyelesaikan form dan mengklik tombol "Kirim Jawaban", satu baris baru akan ditambahkan ke sheet ini. Sistem menggunakan **Dynamic Header Matching**, sehingga data tidak akan tertukar kolom meskipun urutan header di spreadsheet diubah.

| Kolom | Nama Header | Penjelasan & Format Data |
|:---:|---|---|
| **A** | `ID_SUBMISSION` | Kode unik pengiriman, contoh: `SUB-20261028-194902-6689` |
| **B** | `TIMESTAMP` | Waktu pengisian tersimpan dalam format `yyyy-MM-dd HH:mm:ss` |
| **C** | `UID` | Nomor Induk siswa yang mengisi form |
| **D** | `NAMA PENGISI` | Nama lengkap siswa pengisi |
| **E** | `KELAS` | Rombel kelas pengisi (misal: `X-1`, `XI Saintek 3`) |
| **F** | `TINGKAT` | Jenjang tingkatan (`10` atau `11`) |
| **G** | `SESI` | Nomor sesi pengisian yang aktif saat form dikirim (`1`, `2`, `3`, atau `4`) |
| **H** | `BANGUN_PAGI` | Pilihan waktu bangun: `Sebelum 04.00`, `04.00–04.30`, `04.30–05.00`, `05.00–05.30`, `05.30–06.00`, atau `Setelah 06.00` |
| **I** | `IBADAH_LENGKAP` | `"Ya"` jika seluruh 5 shalat fardhu terlaksana, atau `"Tidak"` |
| **J** | `IBADAH_SHUBUH` | `"Ya"` jika shalat Shubuh dikerjakan, `"Tidak"` jika tidak |
| **K** | `IBADAH_DZUHUR` | `"Ya"` jika shalat Dzuhur dikerjakan, `"Tidak"` jika tidak |
| **L** | `IBADAH_ASHAR` | `"Ya"` jika shalat Ashar dikerjakan, `"Tidak"` jika tidak |
| **M** | `IBADAH_MAGHRIB` | `"Ya"` jika shalat Maghrib dikerjakan, `"Tidak"` jika tidak |
| **N** | `IBADAH_ISYA` | `"Ya"` jika shalat Isya dikerjakan, `"Tidak"` jika tidak |
| **O** | `IBADAH_BERHALANGAN` | `"Ya"` jika siswi sedang berhalangan / haid, atau `"Tidak"` *(Opsi ini hanya dapat diisi oleh siswi perempuan)* |
| **P** | `OLAHRAGA` | `"Ya"` jika berolahraga hari ini, atau `"Tidak"` |
| **Q** | `OLAHRAGA_DURASI` | Pilihan durasi: `<20 mnt`, `20–30 mnt`, `>30 mnt`, atau `"-"` jika tidak olahraga |
| **R** | `MAKAN_SEHAT` | Kualitas pola makan: `Selalu`, `Kadang`, atau `Tidak` |
| **S** | `GEMAR_BELAJAR_DURASI` | Durasi belajar mandiri di luar jam sekolah: `0`, `<30 mnt`, `30–60 mnt`, atau `>60 mnt` |
| **T** | `GEMAR_BELAJAR_CATATAN` | Catatan opsional topik / mata pelajaran yang dipelajari |
| **U** | `BERMASYARAKAT` | Keterlibatan sosial/gotong royong: `Ya` atau `Tidak` |
| **V** | `TIDUR_CEPAT` | Rencana jam tidur malam: `Sebelum 21.00`, `21–22.00`, `22–23.00`, atau `Setelah 23.00` |
| **W** | `TIDUR_CATATAN` | Catatan evaluasi / refleksi diri siswa hari ini |

---

### Tab 3: Sheet `Sesi` (Pengaturan Jadwal & Sesi Aktif)
Sheet ini mengatur kapan suatu sesi dibuka dan ditutup.
- Kolom: `sesi` | `nama_sesi` | `tanggal` | `status`
- Nilai status: **`aktif`** (hanya boleh 1 sesi yang aktif) atau **`nonaktif`**.
- **Cara Kerja Sesi**:
  - Ketika Sesi 1 berstatus `aktif`, siswa hanya bisa mengisi Sesi 1.
  - Ketika Admin membuka Sesi 2 (via tombol "Buka Sesi Ini" di Panel Admin), status Sesi 2 otomatis menjadi `aktif`, dan Sesi 1 otomatis menjadi `nonaktif` (selesai/ditutup).
  - Siswa yang belum mengisi Sesi 1 tidak dapat lagi mengisi Sesi 1 (ditandai "Sesi Selesai / Ditutup"), dan langsung diarahkan untuk mengisi Sesi 2.

---

### Tab 4: Sheet `Summary` (Rekapitulasi Otomatis dengan Rumus)
Sheet ini menggunakan rumus bawaan spreadsheet untuk menghitung rekapitulasi secara otomatis tanpa perlu script:
- `TOTAL SISWA`: `=COUNTIF(Users!G:G, "peserta")`
- `SUDAH ISI`: `=COUNTIF(Submissions!G:G, "1")` (disesuaikan per sesi)
- `PERSENTASE`: `=IF(B2>0, C2/B2, 0)`

---

## 🔒 4. Logika Bisnis & Fitur Khusus

### A. Logika Penyaringan Jenis Kelamin (Gender-Based Filter)
- **Siswa Laki-laki (`L`)**: Opsi "Sedang Berhalangan" disembunyikan sepenuhnya dari layar form. Pada validasi langkah 2, siswa laki-laki wajib memilih minimal satu shalat fardhu atau shalat lengkap.
- **Siswi Perempuan (`P`)**: Opsi "Sedang Berhalangan (Khusus Perempuan)" ditampilkan. Jika dipilih, seluruh pilihan shalat fardhu otomatis dibatalkan, dan nilai `IBADAH_BERHALANGAN` dicatat `"Ya"`.

### B. Proteksi Anti Double-Submission
Sistem memeriksa kombinasi `UID + Sesi`. Setiap akun siswa hanya memiliki hak mengisi form 1 kali per sesi. Jika siswa mencoba membuka form sesi yang sudah pernah dikirimkan, sistem langsung mengarahkan siswa ke dashboard dengan badge "Sudah Mengisi".

### C. Keamanan Concurrency (`LockService`)
Saat puluhan hingga ratusan siswa menekan tombol "Kirim Jawaban" pada detik yang sama di sekolah, Google Apps Script menggunakan `LockService.getScriptLock()` untuk mengantrekan proses penulisan ke spreadsheet secara tertib. Hal ini mencegah data saling menimpa atau terjadinya baris kosong.

---

## ⚙️ 5. Panduan Instalasi & Deploy Google Apps Script

Jika Anda ingin memperbarui atau memasang ulang backend ke Google Sheets:

1. Buka spreadsheet Google Sheets Anda.
2. Klik menu **Ekstensi (Extensions)** > pilih **Apps Script**.
3. Buka file [`backend/Code.gs`](backend/Code.gs) di proyek ini, salin seluruh kodenya (**Ctrl + A** lalu **Ctrl + C**), lalu tempelkan ke editor Apps Script.
4. Klik tombol **Simpan** (ikon disket 💾).
5. **Inisialisasi Data Siswa**:
   - Di toolbar atas editor Apps Script, pada dropdown pilihan fungsi pilih: **`importAllStudents`** (atau `setupInitialSheets`).
   - Klik tombol **Run (Jalankan)** ▶️.
   - Sheet `Users` akan langsung terisi lengkap dengan 358 akun siswa.
6. **Deploy Web App**:
   - Di pojok kanan atas, klik tombol **Deploy** > pilih **Manage deployments**.
   - Klik ikon **Pensil (Edit)** > pada bagian Version pilih **New version** (Versi baru).
   - Pastikan *Execute as*: **Me** dan *Who has access*: **Anyone**.
   - Klik **Deploy**.
   - Salin **Web app URL** yang dihasilkan dan pastikan terpasang pada variabel `SCRIPT_URL` di [`js/config.js`](js/config.js).

---

## 🧪 6. Panduan Alat Pengujian Otomatis (Simulator Database)

Untuk menguji performa database dan melihat bagaimana tampilan dashboard saat ratusan data masuk, telah disediakan simulator pengisian otomatis yang dilengkapi **saklar keamanan (Aktif / Nonaktif)**:

### Cara 1: Menggunakan Browser Visual ([`auto_test.html`](auto_test.html))
1. Klik dua kali file `auto_test.html` untuk membukanya di browser.
2. Geser saklar ke **AKTIF (Hijau)**.
3. Tentukan Sesi (contoh: Sesi 1) dan jumlah siswa yang ingin diuji (contoh: 10 Siswa untuk tes cepat, atau 357 Siswa untuk tes penuh).
4. Klik **Mulai Pengisian Otomatis**.
5. Anda dapat melihat progress bar dan respons Google Sheets secara langsung.
6. Jika ingin membatalkan, geser saklar ke **NONAKTIF (Abu-abu)** atau klik tombol **Hentikan**.

### Cara 2: Menggunakan Terminal CLI ([`auto_test.js`](auto_test.js))
Melalui terminal PowerShell / CMD di folder proyek:
```bash
# Uji coba cepat 10 siswa pertama pada Sesi 1
node auto_test.js --count 10 --sesi 1

# Matikan / nonaktifkan simulator (tidak akan mengirim data)
node auto_test.js --nonaktif

# Jalankan pengujian penuh seluruh 357 siswa
node auto_test.js --aktif --sesi 1
```

---

## 🚀 7. Perintah Build & Eksekusi Cepat (NPM Scripts)

Aplikasi telah dilengkapi `package.json` untuk kemudahan pengujian dan validasi:

| Perintah | Deskripsi |
|---|---|
| `npm run build` | Menjalankan verifikasi sintaks seluruh file JS, HTML, CSS, dan integritas data |
| `npm test` | Menampilkan panduan parameter simulator otomatis |
| `npm run test:quick` | Menguji pengisian otomatis 10 siswa pertama ke database |
| `npm run test:all` | Menjalankan pengisian otomatis untuk seluruh 357 siswa |
| `npm start` | Menjalankan local server web di port `http://localhost:3000` |

---

## 👥 8. Informasi Akun Default

- **Akun Administrator / Guru BK**:
  - UID / Username: `admin`
  - Password: `admin2026`
  - Akses: Panel Pemantauan Rekapitulasi, Pembukaan Sesi, Ekspor CSV.
- **Akun Siswa (Peserta)**:
  - Username: Nomor Induk masing-masing siswa (contoh: `12452`, `12463`, `12097`).
  - Password: Nomor Induk masing-masing siswa.
  - Akses: Dashboard Pribadi, Form Pengisian 7 KAIH.
