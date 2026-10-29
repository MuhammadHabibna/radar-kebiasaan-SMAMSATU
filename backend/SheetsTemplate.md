# 📖 Panduan Setup Backend & Google Sheets 7 KAIH

Spreadsheet Target:
[Buka Google Sheets 7 KAIH](https://docs.google.com/spreadsheets/d/1mOZ5wnaW4SCVRDdfgJd8rSFqs11fyndA-y9AuWoXpQ0/edit)

---

## Langkah 1: Membuka Google Apps Script
1. Buka spreadsheet Google Sheets di atas pada browser.
2. Pada menu atas, klik **Ekstensi (Extensions)** > pilih **Apps Script**.
3. Tab baru editor Apps Script akan terbuka.

---

## Langkah 2: Memasukkan Kode `Code.gs`
1. Di editor Apps Script, hapus semua kode bawaan di file `Code.gs`.
2. Buka file `backend/Code.gs` di proyek ini, copy seluruh kodenya, dan paste ke editor Apps Script.
3. Klik tombol **Simpan** (ikon disket 💾 atau tekan `Ctrl + S`).

---

## Langkah 3: Inisialisasi Otomatis (One-Click Setup)
Anda **tidak perlu** membuat sheet & mengetik kolom secara manual! Script ini sudah dilengkapi fungsi otomatis:
1. Di toolbar atas editor Apps Script, cari dropdown pilihan fungsi (biasanya tertulis `myFunction` atau `doGet`).
2. Pilih fungsi: **`setupInitialSheets`**.
3. Klik tombol **Jalankan (Run)** ▶️.
4. Google akan meminta izin otorisasi pertama kali:
   - Klik **Review Permissions** (Tinjau Izin).
   - Pilih akun Google Anda.
   - Klik **Advanced** (Lanjutan) di kiri bawah modal > Klik **Go to Untitled project (unsafe)** / Buka project.
   - Klik **Allow** (Izinkan).
5. Tunggu 3–5 detik hingga log selesai.
6. Cek kembali spreadsheet Anda: 4 Sheet (`Users`, `Submissions`, `Sesi`, `Summary`) sudah langsung terbentuk rapi beserta kolom dan contoh datanya!

---

## Langkah 4: Deploy Menjadi Web App (Endpoint API)
1. Di editor Apps Script pojok kanan atas, klik tombol biru **Deploy** > pilih **New deployment** (Terapkan baru).
2. Di sebelah kiri modal *Select type*, klik ikon gerigi ⚙️ > pilih **Web app**.
3. Isi konfigurasinya persis seperti berikut:
   - **Description**: `Web Form 7 KAIH v1`
   - **Execute as**: **Me (email Anda)** *(PENTING! Agar data tersimpan atas nama pemilik sheet)*
   - **Who has access**: **Anyone** *(PENTING! Agar siswa dapat mengirim jawaban tanpa harus punya izin edit ke sheet)*
4. Klik tombol **Deploy**.
5. Salin (**Copy**) link **Web app URL** yang muncul (formatnya: `https://script.google.com/macros/s/AKfycb.../exec`).

---

## Langkah 5: Masukkan URL ke Konfigurasi Web Form
Tempelkan Web app URL yang didapat tadi ke dalam file:
`d:\WEB\Form Data\js\config.js` pada variabel `SCRIPT_URL`.

```javascript
const CONFIG = {
  SCRIPT_URL: "https://script.google.com/macros/s/AKfycb.../exec",
  ...
};
```

---

## Catatan Kolom Sheet `Submissions`
Urutan kolom sheet `Submissions`:
```
A: ID_SUBMISSION
B: TIMESTAMP
C: UID
D: NAMA PENGISI
E: KELAS
F: TINGKAT
G: SESI
H: BANGUN_PAGI
I: IBADAH_LENGKAP
J: IBADAH_SHUBUH
K: IBADAH_DZUHUR
L: IBADAH_ASHAR
M: IBADAH_MAGHRIB
N: IBADAH_ISYA
O: IBADAH_BERHALANGAN (Khusus Siswi / Uzur Syar'i)
P: OLAHRAGA
Q: OLAHRAGA_DURASI
R: MAKAN_SEHAT
S: GEMAR_BELAJAR_DURASI
T: GEMAR_BELAJAR_CATATAN
U: BERMASYARAKAT
V: TIDUR_CEPAT
W: TIDUR_CATATAN
```
*Jika Anda sudah menjalankan `setupInitialSheets` sebelumnya, cukup buka Apps Script lalu jalankan fungsi `setupInitialSheets` sekali lagi untuk memperbarui kolom secara otomatis, ATAU sisipkan satu kolom baru di sebelah kanan `IBADAH_ISYA` dengan nama header `IBADAH_BERHALANGAN`.*

---

## Akun Siswa & Master Data (357 Akun Siswa + 1 Admin):
Seluruh data akun 357 siswa dari kelas X-1 s/d X-6 (Tingkat 10) dan XI Saintek/Soshum (Tingkat 11) telah dimasukkan ke dalam `backend/Code.gs` dan file `backend/users_data.tsv`.

### Cara Memasukkan Akun Siswa ke Google Sheet:
**Cara 1 (Paling Mudah - 1 Klik di Apps Script):**
1. Salin seluruh isi file `backend/Code.gs` yang baru ke editor Google Apps Script.
2. Di toolbar atas dropdown fungsi, pilih: **`importAllStudents`** (atau jalankan `setupInitialSheets`).
3. Klik **Run (Jalankan)**.
4. Sheet `Users` langsung terisi lengkap dengan 358 baris akun siswa!

**Cara 2 (Copy-Paste Manual):**
1. Buka file [users_data.tsv](file:///d:/WEB/Form%20Data/backend/users_data.tsv).
2. Salin (**Ctrl + A** lalu **Ctrl + C**).
3. Buka tab sheet **`Users`** di Google Sheets.
4. Klik sel **A1**, lalu tempel (**Ctrl + V**).

### Aturan Kolom Sheet `Users`:
`uid | nama | kelas | tingkat | jk | password | role`

- **Username (UID)**: Nomor Induk siswa (misal: `12452`)
- **Password**: Nomor Induk siswa (misal: `12452`)
- **Nama Tampilan**: Nama lengkap asli siswa (misal: `AHMAD HISYAM AIZAR`)
- **Kelas**: Sesuai rombel asli (`X-1` s/d `X-6`, `XI Saintek 1` s/d `4`, `XI Soshum 1` s/d `2`)
- **Tingkat**: `10` untuk kelas X, `11` untuk kelas XI
- **JK (Jenis Kelamin)**: `L` (Laki-laki) atau `P` (Perempuan) — *Mendukung filter logika form: opsi Sedang Berhalangan hanya tampil untuk siswi perempuan (`P`)*
- **Role**: `peserta`

| Role | Username (UID) | Password | Nama Tampilan | Kelas | Tingkat | JK |
|---|---|---|---|---|---|:---:|
| **Admin** | `admin` | `admin2026` | Administrator 7 KAIH | Tim BK/Panitia | Umum | L |
| **Peserta 1** | `12452` | `12452` | AHMAD HISYAM AIZAR | X-1 | 10 | L |
| **Peserta 2** | `12463` | `12463` | ANINDYA KHANZA AZ ZHARIIFAH | X-1 | 10 | P |
| ... | *(355 siswa lainnya)* | ... | ... | ... | ... | ... |

*Anda dapat menambahkan 400 siswa lainnya langsung di sheet `Users` kapan saja.*
