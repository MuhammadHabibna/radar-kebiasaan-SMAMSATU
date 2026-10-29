const fs = require('fs');

const students = JSON.parse(fs.readFileSync('scratch/students_full.json', 'utf8'));

const code = `/**
 * Web Form Monitoring 7 KAIH - VERTIKAL SMA 2026
 * SCRIPT PENGUJIAN OTOMATIS & SIMULASI DATABASE (auto_test.js)
 * 
 * Fitur:
 * - Mengisi form 7 KAIH secara otomatis dengan akun 357 siswa asli
 * - Pengisian jawaban dilakukan secara acak (random) namun tetap realistis & valid
 * - Memiliki saklar STATUS AKTIF / NONAKTIF untuk keamanan database
 * - Pengaturan jeda (delay) antar siswa agar Google Sheets & LockService stabil 100%
 * - Rekapitulasi hasil otomatis di akhir pengujian
 * 
 * Cara Penggunaan:
 *   node auto_test.js                 -> Menjalankan pengujian (jika status AKTIF)
 *   node auto_test.js --aktif         -> Mengaktifkan & langsung menjalankan pengujian
 *   node auto_test.js --nonaktif      -> Mematikan / menonaktifkan fitur pengisian otomatis
 *   node auto_test.js --count 10      -> Hanya menguji 10 siswa pertama (uji coba cepat)
 *   node auto_test.js --sesi 1        -> Mengisi target Sesi 1 (atau sesi 2, 3, 4)
 *   node auto_test.js --delay 400     -> Menentukan jeda 400ms antar pengiriman
 *   node auto_test.js --help          -> Menampilkan bantuan lengkap
 */

// ============================================================
// 🔘 SAKLAR UTAMA (ON / OFF SWITCH)
// Ubah nilai di bawah ini:
// true  = STATUS AKTIF    (Bisa melakukan pengisian form otomatis)
// false = STATUS NONAKTIF (Terkunci, tidak akan mengirim data apapun)
// ============================================================
let STATUS_AKTIF = true;

// ============================================================
// KONFIGURASI PENGUJIAN
// ============================================================
const CONFIG = {
  // URL Web App Google Apps Script
  SCRIPT_URL: 'https://script.google.com/macros/s/AKfycby4kdmwOasyyql_Sd6glfu_CkK9ko-cN7mjIQY_g39-wHr0olL4kcbQ23eek_XXJSxI/exec',
  
  // Target sesi pengisian (1, 2, 3, atau 4)
  TARGET_SESI: '1',
  
  // Batas jumlah siswa yang akan diisi (0 = seluruh 357 siswa)
  MAX_STUDENTS: 0,
  
  // Jeda waktu antar pengiriman (milidetik).
  // Disarankan minimal 350ms agar Google Sheet LockService stabil
  DELAY_MS: 350
};

// ============================================================
// DATA PILIHAN JAWABAN REALISTIS (7 KAIH)
// ============================================================
const CHOICES = {
  bangunPagi: [
    'Sebelum 04.00',
    '04.00–04.30',
    '04.30–05.00',
    '05.00–05.30',
    '05.30–06.00',
    'Setelah 06.00'
  ],
  olahragaDurasi: ['<20 mnt', '20–30 mnt', '>30 mnt'],
  makanSehat: ['Selalu', 'Kadang', 'Tidak'],
  gemarBelajarDurasi: ['0', '<30 mnt', '30–60 mnt', '>60 mnt'],
  gemarBelajarCatatan: [
    'Latihan soal Matematika dan persiapan ujian',
    'Membaca materi Biologi Bab 3',
    'Merangkum materi Sejarah Kebangsaan',
    'Mengerjakan tugas Fisika materi Dinamika Gerak',
    'Latihan soal UTBK / SNBT penalaran matematika',
    'Membaca modul Kimia materi ikatan kimia',
    'Belajar mandiri Bahasa Inggris grammar dan reading',
    'Membahas soal-soal latihan Bahasa Indonesia',
    'Mengulang materi pelajaran yang disampaikan guru tadi pagi'
  ],
  bermasyarakat: ['Ya', 'Tidak'],
  tidurCepat: ['Sebelum 21.00', '21–22.00', '22–23.00', 'Setelah 23.00'],
  tidurCatatan: [
    'Alhamdulillah seluruh target kegiatan hari ini tercapai dengan baik',
    'Hari ini cukup padat, perlu istirahat lebih cukup',
    'Besok harus bangun lebih awal untuk persiapan piket kelas',
    'Evaluasi diri: perlu kurangi screen time sebelum tidur',
    'Kondisi tubuh fit setelah berolahraga, siap untuk esok hari',
    'Hari yang produktif dan menyenangkan'
  ]
};

// ============================================================
// GENERATOR JAWABAN ACAK
// ============================================================
function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateRandomAnswers(student) {
  // 1. Bangun Pagi
  const bangunPagi = getRandomItem(CHOICES.bangunPagi);

  // 2. Ibadah
  // Siswi (JK: P) memiliki peluang 15% sedang berhalangan / haid
  const isFemale = (student.jk === 'P');
  const isBerhalangan = isFemale && (Math.random() < 0.15);

  let ibadahObj = {
    berhalangan: isBerhalangan,
    lengkap: false,
    shubuh: false,
    dzuhur: false,
    ashar: false,
    maghrib: false,
    isya: false
  };

  if (!isBerhalangan) {
    // 70% siswa shalat lengkap 5 waktu
    const isLengkap = Math.random() < 0.70;
    if (isLengkap) {
      ibadahObj.lengkap = true;
      ibadahObj.shubuh = true;
      ibadahObj.dzuhur = true;
      ibadahObj.ashar = true;
      ibadahObj.maghrib = true;
      ibadahObj.isya = true;
    } else {
      ibadahObj.shubuh = Math.random() < 0.90;
      ibadahObj.dzuhur = Math.random() < 0.95;
      ibadahObj.ashar = Math.random() < 0.85;
      ibadahObj.maghrib = Math.random() < 0.90;
      ibadahObj.isya = Math.random() < 0.85;
      ibadahObj.lengkap = (ibadahObj.shubuh && ibadahObj.dzuhur && ibadahObj.ashar && ibadahObj.maghrib && ibadahObj.isya);
    }
  }

  // 3. Olahraga (75% berolahraga)
  const isOlahraga = Math.random() < 0.75;
  const olahraga = isOlahraga ? 'Ya' : 'Tidak';
  const olahragaDurasi = isOlahraga ? getRandomItem(CHOICES.olahragaDurasi) : '-';

  // 4. Makan Sehat
  const makanSehat = Math.random() < 0.65 ? 'Selalu' : (Math.random() < 0.75 ? 'Kadang' : 'Tidak');

  // 5. Gemar Belajar
  const gemarBelajarDurasi = getRandomItem(CHOICES.gemarBelajarDurasi);
  const gemarBelajarCatatan = (gemarBelajarDurasi !== '0' && Math.random() < 0.7)
    ? getRandomItem(CHOICES.gemarBelajarCatatan)
    : '';

  // 6. Bermasyarakat (80% Ya)
  const bermasyarakat = Math.random() < 0.80 ? 'Ya' : 'Tidak';

  // 7. Tidur Cepat
  const tidurCepat = getRandomItem(CHOICES.tidurCepat);
  const tidurCatatan = Math.random() < 0.6 ? getRandomItem(CHOICES.tidurCatatan) : '';

  return {
    bangunPagi,
    ibadah: ibadahObj,
    olahraga,
    olahragaDurasi,
    makanSehat,
    gemarBelajarDurasi,
    gemarBelajarCatatan,
    bermasyarakat,
    tidurCepat,
    tidurCatatan
  };
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// DAFTAR 357 SISWA LENGKAP DENGAN NIS & ROMBEL
// ============================================================
const ALL_STUDENTS = ` + JSON.stringify(students, null, 2) + `;

// ============================================================
// FUNGSI UTAMA EKSEKUSI
// ============================================================
async function main() {
  const args = process.argv.slice(2);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i].toLowerCase();
    if (arg === '--aktif' || arg === '--on' || arg === '--start') {
      STATUS_AKTIF = true;
    } else if (arg === '--nonaktif' || arg === '--off' || arg === '--stop') {
      STATUS_AKTIF = false;
    } else if (arg === '--count' && args[i + 1]) {
      CONFIG.MAX_STUDENTS = parseInt(args[i + 1], 10) || 0;
      i++;
    } else if (arg === '--sesi' && args[i + 1]) {
      CONFIG.TARGET_SESI = String(args[i + 1]).trim();
      i++;
    } else if (arg === '--delay' && args[i + 1]) {
      CONFIG.DELAY_MS = parseInt(args[i + 1], 10) || 350;
      i++;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      return;
    }
  }

  console.log('\\n' + '='.repeat(68));
  console.log('   PENGUJIAN FORM OTOMATIS 7 KAIH - VERTIKAL SMA 2026');
  console.log('='.repeat(68));

  // CEK SAKLAR STATUS AKTIF / NONAKTIF
  if (!STATUS_AKTIF) {
    console.log('\\n[STATUS: NONAKTIF]');
    console.log('Fitur pengisian otomatis saat ini sedang DINONAKTIFKAN.');
    console.log('Tidak ada data yang dikirimkan ke database Google Sheets.');
    console.log('\\nCara Mengaktifkan:');
    console.log('  1. Jalankan perintah: node auto_test.js --aktif');
    console.log('     ATAU');
    console.log('  2. Ubah baris kode di auto_test.js: STATUS_AKTIF = true;\\n');
    console.log('='.repeat(68) + '\\n');
    return;
  }

  console.log('[STATUS: AKTIF]');
  console.log('Target Sesi       : Sesi ' + CONFIG.TARGET_SESI);
  console.log('Jeda per Siswa    : ' + CONFIG.DELAY_MS + ' ms');
  console.log('Endpoint Web App  : ' + CONFIG.SCRIPT_URL);

  let targetList = ALL_STUDENTS;
  if (CONFIG.MAX_STUDENTS > 0 && CONFIG.MAX_STUDENTS < targetList.length) {
    targetList = targetList.slice(0, CONFIG.MAX_STUDENTS);
  }
  console.log('Jumlah Siswa Diuji: ' + targetList.length + ' dari total ' + ALL_STUDENTS.length + ' siswa');
  console.log('='.repeat(68));
  console.log('Memulai pengiriman jawaban acak ke Google Sheets...\\n');

  let successCount = 0;
  let alreadyCount = 0;
  let failCount = 0;
  const startTime = Date.now();

  for (let idx = 0; idx < targetList.length; idx++) {
    const student = targetList[idx];
    const seq = String(idx + 1).padStart(3, '0');
    const total = targetList.length;
    const answers = generateRandomAnswers(student);

    const payload = {
      action: 'submit',
      uid: student.uid,
      sesi: CONFIG.TARGET_SESI,
      answers: answers
    };

    const studentInfo = '[' + seq + '/' + total + '] ' + student.uid + ' - ' + student.nama.padEnd(28).substring(0, 28) + ' (' + student.kelas + ')';

    try {
      const res = await fetch(CONFIG.SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (data.success) {
        successCount++;
        console.log(studentInfo + ' -> OK (' + (data.submissionId || 'Berhasil') + ')');
      } else {
        if (data.message && data.message.includes('sudah pernah mengisi')) {
          alreadyCount++;
          console.log(studentInfo + ' -> SKIP (Sudah pernah mengisi Sesi ' + CONFIG.TARGET_SESI + ')');
        } else {
          failCount++;
          console.log(studentInfo + ' -> GAGAL (' + data.message + ')');
        }
      }
    } catch (err) {
      failCount++;
      console.log(studentInfo + ' -> ERROR KONEKSI (' + err.message + ')');
    }

    if (idx < targetList.length - 1 && CONFIG.DELAY_MS > 0) {
      await sleep(CONFIG.DELAY_MS);
    }
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\\n' + '='.repeat(68));
  console.log('   RINGKASAN HASIL PENGUJIAN OTOMATIS');
  console.log('='.repeat(68));
  console.log('Total Akun Diproses : ' + targetList.length);
  console.log('Berhasil Disimpan   : ' + successCount + ' siswa');
  console.log('Sudah Terisi (Skip) : ' + alreadyCount + ' siswa');
  console.log('Gagal / Error       : ' + failCount + ' siswa');
  console.log('Waktu Pengerjaan    : ' + durationSec + ' detik');
  console.log('='.repeat(68));
  console.log('Data telah terekam di Google Sheets pada tab "Submissions" & "Summary".\\n');
}

function printHelp() {
  console.log(\`
PANDUAN PERINTAH auto_test.js:
-------------------------------------------------------------
node auto_test.js                 Jalankan pengisian (jika status AKTIF)
node auto_test.js --aktif         Aktifkan & langsung jalankan pengisian
node auto_test.js --nonaktif      Matikan / nonaktifkan fitur pengisian
node auto_test.js --count <n>     Batasi jumlah siswa (contoh: --count 10)
node auto_test.js --sesi <1-4>    Tentukan sesi pengisian (contoh: --sesi 2)
node auto_test.js --delay <ms>    Tentukan jeda waktu (contoh: --delay 400)

Contoh Uji Coba Cepat (10 Siswa di Sesi 1):
  node auto_test.js --count 10 --sesi 1

Contoh Mengisi Seluruh 357 Siswa:
  node auto_test.js --sesi 1
-------------------------------------------------------------
\`);
}

main().catch(err => {
  console.error('Fatal Error:', err);
});
`;

fs.writeFileSync('auto_test.js', code, 'utf8');
console.log('auto_test.js created! File size:', (code.length / 1024).toFixed(2), 'KB');
