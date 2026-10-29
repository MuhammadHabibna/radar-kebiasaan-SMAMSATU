/**
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
let STATUS_AKTIF = false;

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
const ALL_STUDENTS = [
  {
    "uid": "12452",
    "nama": "AHMAD HISYAM AIZAR",
    "kelas": "X-1",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12463",
    "nama": "ANINDYA KHANZA AZ ZHARIIFAH",
    "kelas": "X-1",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12465",
    "nama": "ARAYA CITRA PUSPITASARI",
    "kelas": "X-1",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12466",
    "nama": "ARDELLINO SYAPUTRA",
    "kelas": "X-1",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12470",
    "nama": "ASYIFA AURELIA ARVA",
    "kelas": "X-1",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12491",
    "nama": "DWI RAHMANIA AULIA",
    "kelas": "X-1",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12502",
    "nama": "FATWAN KHULAFA' AL BALADY",
    "kelas": "X-1",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12511",
    "nama": "IMAM BARRY WAFAUL WAFAK",
    "kelas": "X-1",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12519",
    "nama": "KEYSHA KHANSA NAHDA YUFA",
    "kelas": "X-1",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12532",
    "nama": "MIRANDA CALYSTA PUTRI",
    "kelas": "X-1",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12538",
    "nama": "MUHAMMAD EMIR ISMAT LUBAID",
    "kelas": "X-1",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12542",
    "nama": "MOH. FIKRUL ZAM ZAMI",
    "kelas": "X-1",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12544",
    "nama": "MUHAMMAD HILMI",
    "kelas": "X-1",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12552",
    "nama": "MUHAMMAD TANTOWI FARID JAUHARI",
    "kelas": "X-1",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12553",
    "nama": "MUHAMMAD YUSRI ASYFA",
    "kelas": "X-1",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12563",
    "nama": "NASYA ZAUZAHRO AIDANUR IRWANTO",
    "kelas": "X-1",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12582",
    "nama": "RIZKA NAILUL ULYA",
    "kelas": "X-1",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12584",
    "nama": "SAIF ALFATH",
    "kelas": "X-1",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12590",
    "nama": "SHERHAN GHANIYYU ATMA",
    "kelas": "X-1",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12599",
    "nama": "TSABITA MAYLAFFAYZA DAIMAH",
    "kelas": "X-1",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12604",
    "nama": "YOSI AYU WANDIRA",
    "kelas": "X-1",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12609",
    "nama": "ZAHRINATUS SYAFA ANNIDA",
    "kelas": "X-1",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12472",
    "nama": "ATHAYA LIANDRA PUTRI ARDIYATI WIBOWO",
    "kelas": "X-2",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12476",
    "nama": "AULIA ZULFA YASMIN",
    "kelas": "X-2",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12477",
    "nama": "AURELIA AISY MUMTAZ",
    "kelas": "X-2",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12480",
    "nama": "AZKA SYAFIQ RAYYAN",
    "kelas": "X-2",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12493",
    "nama": "EMIR SATRIA TAMBUNAN",
    "kelas": "X-2",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12494",
    "nama": "FAHMI AL DIN HUSAIN PUTRA WARDANI",
    "kelas": "X-2",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12505",
    "nama": "GLADIZIA AZZAHRA PURNOMO",
    "kelas": "X-2",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12507",
    "nama": "HAFSHA AZZAHRA",
    "kelas": "X-2",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12515",
    "nama": "JNO KENANDITO SUHUD",
    "kelas": "X-2",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12527",
    "nama": "MAHATMA SATRIA WARDHANA",
    "kelas": "X-2",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12534",
    "nama": "MUHAMMAD YAHYA ELANG MAULANA",
    "kelas": "X-2",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12550",
    "nama": "MUHAMMAD SHAFA FAIZATUNNAJA PUTRA AKBAR",
    "kelas": "X-2",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12561",
    "nama": "NAMIRA HILWA",
    "kelas": "X-2",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12569",
    "nama": "NUR AZMI RIYANTO",
    "kelas": "X-2",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12587",
    "nama": "SAVIERA NADHIA ZULVA",
    "kelas": "X-2",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12589",
    "nama": "SHARANI QUENICA PUTRI",
    "kelas": "X-2",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12591",
    "nama": "SINTA DEWI PELANGI",
    "kelas": "X-2",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12601",
    "nama": "XIKE AZZA GRESSIA",
    "kelas": "X-2",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12606",
    "nama": "ZAFEERA NISWA SALSABILA ARROSIDI",
    "kelas": "X-2",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12610",
    "nama": "ZHAFIRA PUTRI WIJAYA",
    "kelas": "X-2",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12450",
    "nama": "AESAR RAFIE BRAHMANTYA",
    "kelas": "X-3",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12454",
    "nama": "AHMAD JAUHAR AL-A'LA",
    "kelas": "X-3",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12458",
    "nama": "AISYAH MAULIDAH RAHMAWATI",
    "kelas": "X-3",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12459",
    "nama": "AISYAH RAHMA AZHARA",
    "kelas": "X-3",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12464",
    "nama": "AQEELA AZKA ARDHANA",
    "kelas": "X-3",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12469",
    "nama": "ARYA MIZZANY",
    "kelas": "X-3",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12479",
    "nama": "AZKA RAMADHANI JUNIAWAN",
    "kelas": "X-3",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12484",
    "nama": "BETHARI MANGGAR WIKANTO",
    "kelas": "X-3",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12490",
    "nama": "DINAR KHOIRUNNISA",
    "kelas": "X-3",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12492",
    "nama": "DZAKY ZAFRAN ALFARIZKY",
    "kelas": "X-3",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12504",
    "nama": "FILIA FATIN QAIS EL WAFA",
    "kelas": "X-3",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12508",
    "nama": "HILAL ACHMAD FAKHRUDIN",
    "kelas": "X-3",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12509",
    "nama": "IBRAHIM ATTAR BRAMANTYO",
    "kelas": "X-3",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12514",
    "nama": "JEVANYA AVRA FREDELINA QUELENE",
    "kelas": "X-3",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12516",
    "nama": "KEISHA SHAKILA HARUN",
    "kelas": "X-3",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12528",
    "nama": "MAS RAJA FIRMANSYAH",
    "kelas": "X-3",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12536",
    "nama": "MUHAMMAD AZKA ALFARIZI",
    "kelas": "X-3",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12546",
    "nama": "MUHAMMAD NAUFAL LABIB",
    "kelas": "X-3",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12549",
    "nama": "MUHAMMAD RIZQI RAMADHAN",
    "kelas": "X-3",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12556",
    "nama": "NADIN AMIRA RAHMADINAH",
    "kelas": "X-3",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12560",
    "nama": "NAJWA ASYILAH CHAIRANI",
    "kelas": "X-3",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12565",
    "nama": "NAUREEN TARA YALENA",
    "kelas": "X-3",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12574",
    "nama": "QARSAFAH AL ZAHLIYAH RACHMAWATI ZULKARNAIN",
    "kelas": "X-3",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12579",
    "nama": "REYHAAN ASMAR PRIBADI PUTRA",
    "kelas": "X-3",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12588",
    "nama": "SHABRINA PUTRI AL GHIFFARY",
    "kelas": "X-3",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12598",
    "nama": "TSABITA HASNAH HENDITA",
    "kelas": "X-3",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12600",
    "nama": "USAID RAIHAAN DAMIS",
    "kelas": "X-3",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12602",
    "nama": "YASMIN DINAAR ARAFAH",
    "kelas": "X-3",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12605",
    "nama": "YUSUF",
    "kelas": "X-3",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12611",
    "nama": "ZIDNY ILMA",
    "kelas": "X-3",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12453",
    "nama": "AHMAD IHSAN AR ROSIDY",
    "kelas": "X-4",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12455",
    "nama": "AHMAD NAUFAL FARRAS",
    "kelas": "X-4",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12461",
    "nama": "ALLSEME NIRNIAK SUCAHYA",
    "kelas": "X-4",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12467",
    "nama": "ARGYA NAWAL SATYADHARMA",
    "kelas": "X-4",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12468",
    "nama": "ARYA DAMAR WIRAWAN",
    "kelas": "X-4",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12473",
    "nama": "ATHAYA SYHAILA DZAKWAN",
    "kelas": "X-4",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12475",
    "nama": "ATHIKA NADIA RAHMA",
    "kelas": "X-4",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12478",
    "nama": "AZKA FUADY AZIZ",
    "kelas": "X-4",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12486",
    "nama": "CALVINO AZMI GANI PRATAMA",
    "kelas": "X-4",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12488",
    "nama": "DAYANA BATRISYA AN-NISA FITRI",
    "kelas": "X-4",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12498",
    "nama": "FARHAN RAFI IRFANSYAH",
    "kelas": "X-4",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12510",
    "nama": "IBRAHIM DZAKY KAISAN",
    "kelas": "X-4",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12518",
    "nama": "KEYSHA AZZAHRA",
    "kelas": "X-4",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12533",
    "nama": "MOH. NIZAR AHZA AL AZZAM",
    "kelas": "X-4",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12541",
    "nama": "MUHAMMAD FERRO AL AFGHANI",
    "kelas": "X-4",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12543",
    "nama": "MUHAMMAD HABIBI AKBAR",
    "kelas": "X-4",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12557",
    "nama": "NAFASHA PUTRI DHAVINA ALFARIZA",
    "kelas": "X-4",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12559",
    "nama": "NAFLAH KHOIRUNNISA RAHMANDA",
    "kelas": "X-4",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12562",
    "nama": "NASHWA ALIYA PUTRI",
    "kelas": "X-4",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12564",
    "nama": "NAURA AZKA SILMI",
    "kelas": "X-4",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12566",
    "nama": "NAYLA ZHAFIRAH PUTRI PAHALA",
    "kelas": "X-4",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12570",
    "nama": "NUR FAIZAH HANIA",
    "kelas": "X-4",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12571",
    "nama": "NURIL WAHYUNI AYU MAHASTI",
    "kelas": "X-4",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12573",
    "nama": "ORVALA INDRAFATA CHALIK",
    "kelas": "X-4",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12577",
    "nama": "RAIHAN ARIBUDI SULANDOKO",
    "kelas": "X-4",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12578",
    "nama": "RAKA MUHAMMAD WIGUNA",
    "kelas": "X-4",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12586",
    "nama": "SASHIMI ALENA ALBAQIS",
    "kelas": "X-4",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12592",
    "nama": "SULTAN WIRA NURRAMADHAN",
    "kelas": "X-4",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12597",
    "nama": "THORIQ BIL FURQON LESMANA",
    "kelas": "X-4",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12613",
    "nama": "RIZKY FITRAH ANUGRAH",
    "kelas": "X-4",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12614",
    "nama": "ABRAR RAYYAN",
    "kelas": "X-4",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12451",
    "nama": "AGRA MALIKA ABRAR",
    "kelas": "X-5",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12456",
    "nama": "AHMAD NAZHMI ILMI INSANI",
    "kelas": "X-5",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12457",
    "nama": "AHMAD RAFIF ATHALLAH",
    "kelas": "X-5",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12460",
    "nama": "ALDO ARIES HARIONO",
    "kelas": "X-5",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12471",
    "nama": "ATHALLAH RAFFASYA ARDHIANTO",
    "kelas": "X-5",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12474",
    "nama": "ATHAYA TABINA ZHUFAIROH",
    "kelas": "X-5",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12481",
    "nama": "BALKIZH AULIA PUTRI",
    "kelas": "X-5",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12496",
    "nama": "FANNI TISYA SAUNAH",
    "kelas": "X-5",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12500",
    "nama": "FARIS RACHMAN AL FARUQ",
    "kelas": "X-5",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12512",
    "nama": "IRZE MAULIDINA EL HAMRO",
    "kelas": "X-5",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12513",
    "nama": "JESSY RUSDA TRISNA DINI",
    "kelas": "X-5",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12517",
    "nama": "KEISYA ALIZA PUTRI",
    "kelas": "X-5",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12520",
    "nama": "KHAYRA AYESHA FAADHILLAH",
    "kelas": "X-5",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12522",
    "nama": "MUHAMMAD AS'AD IZZUL HAQ D",
    "kelas": "X-5",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12523",
    "nama": "MOCH. DAVIN JERVIS GAUTAMA",
    "kelas": "X-5",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12525",
    "nama": "M SYAHRUL ZIBRAN AL HAFIZ",
    "kelas": "X-5",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12526",
    "nama": "MUHAMMAD ZYAN ZAFFIRE ASSYAKIR",
    "kelas": "X-5",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12539",
    "nama": "MUHAMMAD FACHRI BUMI PUTRA",
    "kelas": "X-5",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12545",
    "nama": "MUHAMMAD NAUFAL AR ROYHAN",
    "kelas": "X-5",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12547",
    "nama": "MUHAMMAD NELSON MAHATHMA YUDHA",
    "kelas": "X-5",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12548",
    "nama": "MUHAMMAD RADHO ARDIANSYAH",
    "kelas": "X-5",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12554",
    "nama": "MUKHAMMAD DHAFIN AR RIZQI",
    "kelas": "X-5",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12558",
    "nama": "NAFIZA CHIARA PUTRI",
    "kelas": "X-5",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12572",
    "nama": "OCTAVIAN NUR HARTONO",
    "kelas": "X-5",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12576",
    "nama": "RAHMANIA SHAFA AZZAHRA",
    "kelas": "X-5",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12580",
    "nama": "REYHANA JASMINE",
    "kelas": "X-5",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12583",
    "nama": "SAFIRA CANDRA FUADAH",
    "kelas": "X-5",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12594",
    "nama": "SYEIKH",
    "kelas": "X-5",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12596",
    "nama": "TANISHA VANIA GELSI",
    "kelas": "X-5",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12603",
    "nama": "YASMIN QUDSI VINA",
    "kelas": "X-5",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12612",
    "nama": "ZIYADATUN NA'IMAH",
    "kelas": "X-5",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12537",
    "nama": "MUHAMMAD BAQIR ASH SHADR",
    "kelas": "X-5",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12448",
    "nama": "ABY ZHAR BAHASUAN",
    "kelas": "X-6",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12449",
    "nama": "ACHMAD ZAIN MUGEBEL",
    "kelas": "X-6",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12482",
    "nama": "BARIQ FAJAR ABDULLAH",
    "kelas": "X-6",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12483",
    "nama": "BAYU SUKMO BAGUS SATRIO",
    "kelas": "X-6",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12485",
    "nama": "BINTANG EVANDER AMUK NUGROHO",
    "kelas": "X-6",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12487",
    "nama": "DANIYAH MUHAMMAD FAUZI",
    "kelas": "X-6",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12489",
    "nama": "DIMAS MUHAMMAD",
    "kelas": "X-6",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12495",
    "nama": "FAIZ ARDI WINATA",
    "kelas": "X-6",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12497",
    "nama": "FARA ZAIMAH AURELIA",
    "kelas": "X-6",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12499",
    "nama": "FARHANDHAH HASNA NABILA",
    "kelas": "X-6",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12501",
    "nama": "FATHIR AIDIL FITRAH",
    "kelas": "X-6",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12503",
    "nama": "FERLI PUTRI ARNIS",
    "kelas": "X-6",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12521",
    "nama": "KHOIRUNNISA AZAHRAA",
    "kelas": "X-6",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12524",
    "nama": "MUHAMMAD KAYZA AL JABBAR",
    "kelas": "X-6",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12529",
    "nama": "MAULANA AL HAIDAR FISABILILLAH",
    "kelas": "X-6",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12530",
    "nama": "MAZAYA NISMAH MAULIDIYAH",
    "kelas": "X-6",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12531",
    "nama": "MELVI ROSITA OCTAVIANI",
    "kelas": "X-6",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12535",
    "nama": "MUHAMMAD ALVINO RAHADIAN KHALID",
    "kelas": "X-6",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12540",
    "nama": "MUHAMMAD FAUZAN FADILLAH DIANDRA",
    "kelas": "X-6",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12551",
    "nama": "MUHAMMAD SYAROFUL ANAM",
    "kelas": "X-6",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12555",
    "nama": "NABILA AULIA NAHDA",
    "kelas": "X-6",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12567",
    "nama": "NISA NAFAZATUL JANNAH",
    "kelas": "X-6",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12568",
    "nama": "NOVALITA TRIA KHAIRUNNISA' PERMATASARI",
    "kelas": "X-6",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12575",
    "nama": "RAFA OKTAVINO PANGGABEAN",
    "kelas": "X-6",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12581",
    "nama": "RIFKY RIZQU OKTANIAN",
    "kelas": "X-6",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12585",
    "nama": "SALMA FAHMIDA",
    "kelas": "X-6",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12593",
    "nama": "SYAIFUDIN IQBAL",
    "kelas": "X-6",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12595",
    "nama": "TALITA DZAHABIYYAH SYAUKANI",
    "kelas": "X-6",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12607",
    "nama": "ZAHIRA FARIDIA FIRDAUSY",
    "kelas": "X-6",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12608",
    "nama": "ZAHRA GRESIA",
    "kelas": "X-6",
    "tingkat": 10,
    "jk": "P"
  },
  {
    "uid": "12506",
    "nama": "HAFIZ MAHADEVANO RUDYANSYAH",
    "kelas": "X-6",
    "tingkat": 10,
    "jk": "L"
  },
  {
    "uid": "12252",
    "nama": "AIMA NUR ALIFTA TUWATUN NISA",
    "kelas": "XI Saintek 1",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12257",
    "nama": "ALEESHA MEDINA SUTIONO",
    "kelas": "XI Saintek 1",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12262",
    "nama": "AMANDA FARAHDHIA",
    "kelas": "XI Saintek 1",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12275",
    "nama": "ATHAYA MIHLAYEL AXELA NAYAKA",
    "kelas": "XI Saintek 1",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12280",
    "nama": "BERYL ALVI RAFANSYAH",
    "kelas": "XI Saintek 1",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12281",
    "nama": "BIRRU KAUTSAR ALFATH",
    "kelas": "XI Saintek 1",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12290",
    "nama": "EKA RIZKY APRILIANI",
    "kelas": "XI Saintek 1",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12292",
    "nama": "ERIKA PUTRI MAGHFIROH",
    "kelas": "XI Saintek 1",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12298",
    "nama": "FARAFISYAH BINTA ALRIANTI",
    "kelas": "XI Saintek 1",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12301",
    "nama": "FARROS ZAGHLUL WALIYYUDIN",
    "kelas": "XI Saintek 1",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12303",
    "nama": "FERGIE ACHMAD PRASETYO",
    "kelas": "XI Saintek 1",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12304",
    "nama": "FIRDA FIRMANUSSYIFA'",
    "kelas": "XI Saintek 1",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12306",
    "nama": "GARNETA AYUDIA CAHYANI",
    "kelas": "XI Saintek 1",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12310",
    "nama": "HAFIZ ALVIANO FIRST RADITYANATA",
    "kelas": "XI Saintek 1",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12339",
    "nama": "M. RIZQY DHIYA'UL HAQ",
    "kelas": "XI Saintek 1",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12344",
    "nama": "MAULIDYA OZORA PUTRI",
    "kelas": "XI Saintek 1",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12350",
    "nama": "MOH RAIHAN SAMI FIRDAUS",
    "kelas": "XI Saintek 1",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12355",
    "nama": "MUHAMMAD ALWAN HASRIANSYAH",
    "kelas": "XI Saintek 1",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12359",
    "nama": "MUHAMMAD FADHIL EL SYARIF",
    "kelas": "XI Saintek 1",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12366",
    "nama": "MUHAMMAD IBAD MUTAWWALIDIN",
    "kelas": "XI Saintek 1",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12367",
    "nama": "MUHAMMAD IKMAL NIZZAMULLAH",
    "kelas": "XI Saintek 1",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12372",
    "nama": "MUHAMMAD SHAFWAN MAULANA ZHAFRAN",
    "kelas": "XI Saintek 1",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12373",
    "nama": "MUHAMMAD ZAFRAN MARDIANSYAH",
    "kelas": "XI Saintek 1",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12374",
    "nama": "NAAILAH SHAFAA RAMADHANI",
    "kelas": "XI Saintek 1",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12380",
    "nama": "NAUFAL ALBIF AL FAROBI AGUS",
    "kelas": "XI Saintek 1",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12388",
    "nama": "NURAINI AN NISA PUTRI",
    "kelas": "XI Saintek 1",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12389",
    "nama": "NURUL ANDHINI",
    "kelas": "XI Saintek 1",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12400",
    "nama": "RAIHAN IKHSAN HIDAYAT",
    "kelas": "XI Saintek 1",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12413",
    "nama": "SALSABILA FIRDAUS",
    "kelas": "XI Saintek 1",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12419",
    "nama": "SHIDQI RAKA SYAHPUTRA",
    "kelas": "XI Saintek 1",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12422",
    "nama": "SULTAN AQIEL MUHAMMAD",
    "kelas": "XI Saintek 1",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12423",
    "nama": "SULTAN HAIDAR MUTAWAKKIL",
    "kelas": "XI Saintek 1",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12429",
    "nama": "UBAIDILLAH AKMAL FATTAN",
    "kelas": "XI Saintek 1",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12441",
    "nama": "MUHAMMAD AFDHAL RABBANI PRAYITNO",
    "kelas": "XI Saintek 1",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12248",
    "nama": "ADIS RAKHA HARDIYANTA",
    "kelas": "XI Saintek 2",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12254",
    "nama": "AISYAH FAUZIYAH ARDZI",
    "kelas": "XI Saintek 2",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12256",
    "nama": "AL TAUFIQ SYARIFUDDIN",
    "kelas": "XI Saintek 2",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12272",
    "nama": "ARSYAD FITROH MUHAMMAD PURWONO",
    "kelas": "XI Saintek 2",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12273",
    "nama": "ARYA BIMA WIJAYA",
    "kelas": "XI Saintek 2",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12278",
    "nama": "BAIHAQQY DIZHAN AZKA KHAIRI",
    "kelas": "XI Saintek 2",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12284",
    "nama": "DAI BRILLIANT RIZKI IRSANDY",
    "kelas": "XI Saintek 2",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12289",
    "nama": "EDITA LUNA RAHMADHANI",
    "kelas": "XI Saintek 2",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12302",
    "nama": "FASYA NAUBIYAN CAHYAWAN",
    "kelas": "XI Saintek 2",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12308",
    "nama": "GIDEON BAGAS BAWENGAN",
    "kelas": "XI Saintek 2",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12312",
    "nama": "HAIDAR ZADA ATHAILLAH",
    "kelas": "XI Saintek 2",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12325",
    "nama": "KHANSA DISTIAN ARYAPUTRA",
    "kelas": "XI Saintek 2",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12341",
    "nama": "MOCHAMMAD SABIQ AL NAUFAL",
    "kelas": "XI Saintek 2",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12354",
    "nama": "MUHAMMAD AIDAN AL BANIIN",
    "kelas": "XI Saintek 2",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12360",
    "nama": "MUHAMMAD FAKHRY AKBAR",
    "kelas": "XI Saintek 2",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12371",
    "nama": "MUHAMMAD RIZKY FARDAN",
    "kelas": "XI Saintek 2",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12378",
    "nama": "NARENDHRA ARYASATYA ATHARAMA",
    "kelas": "XI Saintek 2",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12385",
    "nama": "NIKITA ALFINA SYAHRIANI",
    "kelas": "XI Saintek 2",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12387",
    "nama": "NUR IZZATI HAYATUS SOPHIA",
    "kelas": "XI Saintek 2",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12396",
    "nama": "RADEN AHMAD BERYL SAFARAZ",
    "kelas": "XI Saintek 2",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12398",
    "nama": "RAFA FATHAN AL GIFFARI",
    "kelas": "XI Saintek 2",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12414",
    "nama": "SALSABILA SYAPUTRI",
    "kelas": "XI Saintek 2",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12424",
    "nama": "SULTHAN KHINAN HANAFI",
    "kelas": "XI Saintek 2",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12425",
    "nama": "SURYA SATRIA PRADANA AL RIANTO",
    "kelas": "XI Saintek 2",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12430",
    "nama": "VALKYRIE AGNI HER SAMIRANA PERTIWI",
    "kelas": "XI Saintek 2",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12431",
    "nama": "WIRADITYA WIJAYA",
    "kelas": "XI Saintek 2",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12433",
    "nama": "YASMINE AZZAHRA DISTIAN",
    "kelas": "XI Saintek 2",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12442",
    "nama": "JIBRIL DANESWARA JUNAEDI",
    "kelas": "XI Saintek 2",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12249",
    "nama": "AFIQ RAYYAN MA'ARIF",
    "kelas": "XI Saintek 3",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12253",
    "nama": "AISYAH AQILA LATIF",
    "kelas": "XI Saintek 3",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12255",
    "nama": "AKHDANY KENZIE KAYANA",
    "kelas": "XI Saintek 3",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12258",
    "nama": "ALIFATUROHMAN HADI KURNIAWAN",
    "kelas": "XI Saintek 3",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12264",
    "nama": "ANDANA ARSYAD RASENDRIYAH",
    "kelas": "XI Saintek 3",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12265",
    "nama": "ANDRIAN NAUFALI ROCHMAN",
    "kelas": "XI Saintek 3",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12266",
    "nama": "ANINDIA NUR FATIHAH",
    "kelas": "XI Saintek 3",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12270",
    "nama": "AQILA HUBBATUL LATIFAH",
    "kelas": "XI Saintek 3",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12277",
    "nama": "AZFAR CONSTANTINE ALGHIFARI",
    "kelas": "XI Saintek 3",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12287",
    "nama": "DIKA ADINATA PUTRA KASIHA",
    "kelas": "XI Saintek 3",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12288",
    "nama": "DIMAS RADITHYA PRADANA",
    "kelas": "XI Saintek 3",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12315",
    "nama": "HANOONA DWIKE MARETA",
    "kelas": "XI Saintek 3",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12321",
    "nama": "IZZUDDIN AL FATIH",
    "kelas": "XI Saintek 3",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12326",
    "nama": "KHANSA ZAHIRAH NAJLA",
    "kelas": "XI Saintek 3",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12334",
    "nama": "MUHAMMAD GALVIN RIZA ALAMSYAH",
    "kelas": "XI Saintek 3",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12335",
    "nama": "MUHAMMAD GAVIN ISLAMAY NARARYA",
    "kelas": "XI Saintek 3",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12338",
    "nama": "M. RAKHA AR RAYYAN PUTRA ARIANTO",
    "kelas": "XI Saintek 3",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12370",
    "nama": "MOCHAMMAD RANGGA DWI GUNAWAN",
    "kelas": "XI Saintek 3",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12381",
    "nama": "NAURA JIHAN FARAH RAMADHANI",
    "kelas": "XI Saintek 3",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12382",
    "nama": "NAURA ZAMI SAFA FITRIYANTARA",
    "kelas": "XI Saintek 3",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12383",
    "nama": "NAZLILLAH AISYAH JOHAR",
    "kelas": "XI Saintek 3",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12384",
    "nama": "NEHAN ATHAYANTA NURYANTO",
    "kelas": "XI Saintek 3",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12390",
    "nama": "NURUL FALAH AZZAKIYAH ARDIANSYAH",
    "kelas": "XI Saintek 3",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12399",
    "nama": "RAFIKA NOVIYA RHODIYAHTUL EFFENDI",
    "kelas": "XI Saintek 3",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12401",
    "nama": "RANIAH KHAIRUNISA",
    "kelas": "XI Saintek 3",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12406",
    "nama": "REZA AHMAD AL HAKIM",
    "kelas": "XI Saintek 3",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12407",
    "nama": "RICKO GAHRAL ADISYACH",
    "kelas": "XI Saintek 3",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12410",
    "nama": "RIZQI FANI ANUGRAH",
    "kelas": "XI Saintek 3",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12435",
    "nama": "ZAHRAN SHABIR ATHALLAH ALWAN",
    "kelas": "XI Saintek 3",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12245",
    "nama": "ABYANUL HAKIM",
    "kelas": "XI Saintek 4",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12250",
    "nama": "AHMAD HAIKAL FALAKH",
    "kelas": "XI Saintek 4",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12261",
    "nama": "ALYA AYUDYA MAHARANI",
    "kelas": "XI Saintek 4",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12263",
    "nama": "AMIRA ZAHWAH KAYYASAH",
    "kelas": "XI Saintek 4",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12279",
    "nama": "BELA ANGIE PARAHITA",
    "kelas": "XI Saintek 4",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12293",
    "nama": "FA'IZAH AMIRAH",
    "kelas": "XI Saintek 4",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12296",
    "nama": "FAJAR ARYANSYAH PUTRA",
    "kelas": "XI Saintek 4",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12297",
    "nama": "FALIZAH RAHMAN",
    "kelas": "XI Saintek 4",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12305",
    "nama": "FRAYA PARAMITHA WINDHARTA",
    "kelas": "XI Saintek 4",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12307",
    "nama": "GAVIN WILIAN BASKARA",
    "kelas": "XI Saintek 4",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12314",
    "nama": "HANDARU ZAKI CAHYA GUMELAR",
    "kelas": "XI Saintek 4",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12316",
    "nama": "HANUM AISYAWA YULDIONO",
    "kelas": "XI Saintek 4",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12318",
    "nama": "IBRAHIM RIDHO HASAN",
    "kelas": "XI Saintek 4",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12320",
    "nama": "IVAN LOUISE HARIS WICAKSONO",
    "kelas": "XI Saintek 4",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12349",
    "nama": "MIRZA AUFA MURTAZA",
    "kelas": "XI Saintek 4",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12362",
    "nama": "MUHAMMAD FIRASH ARDHIA AQSHO TYSA LUBIS",
    "kelas": "XI Saintek 4",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12363",
    "nama": "MUHAMMAD GIBRAN FATIH",
    "kelas": "XI Saintek 4",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12364",
    "nama": "MUHAMMAD HASBI AKBAR SITEPU",
    "kelas": "XI Saintek 4",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12369",
    "nama": "MUHAMMAD PRAYOGA SEJATI",
    "kelas": "XI Saintek 4",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12379",
    "nama": "NATANARARYA LANGIT SATYAKI",
    "kelas": "XI Saintek 4",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12394",
    "nama": "PUTRI VIVIAN NUR RAHMA",
    "kelas": "XI Saintek 4",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12397",
    "nama": "RAFA BENZEMA PUTRA PRADANA",
    "kelas": "XI Saintek 4",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12402",
    "nama": "RAYHAN MAULANA AL ASY'ARI",
    "kelas": "XI Saintek 4",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12405",
    "nama": "REYVAN RAMDHAN MAULANA",
    "kelas": "XI Saintek 4",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12427",
    "nama": "TALITHA NEYSA SYAKIRA ATMOJO",
    "kelas": "XI Saintek 4",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12428",
    "nama": "TANAYA KANIA RACHMANI",
    "kelas": "XI Saintek 4",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12432",
    "nama": "YAFI ASRA HABIBILLAH",
    "kelas": "XI Saintek 4",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12434",
    "nama": "YUSRA MUMTAZ RAMADHAN",
    "kelas": "XI Saintek 4",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12436",
    "nama": "ZANA RAHMADANI BARKAH LYLA",
    "kelas": "XI Saintek 4",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12444",
    "nama": "A. NAUFAL ATALLAH FIKRI",
    "kelas": "XI Saintek 4",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12247",
    "nama": "ADINDA LUTFI OXCHARIL",
    "kelas": "XI Soshum 1",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12251",
    "nama": "AHMAD WILDANUS SHIHAB",
    "kelas": "XI Soshum 1",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12269",
    "nama": "ANNISA FITIYA SEKARARUM",
    "kelas": "XI Soshum 1",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12282",
    "nama": "CANTIKA DWIYONO AZALYA SAFIRA",
    "kelas": "XI Soshum 1",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12283",
    "nama": "CARISSA AURELIA PUTRI",
    "kelas": "XI Soshum 1",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12286",
    "nama": "DELVIANO FIDANZA DA LOPES",
    "kelas": "XI Soshum 1",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12294",
    "nama": "FAIRUZ JASMINE KHOIRUNNISA'",
    "kelas": "XI Soshum 1",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12295",
    "nama": "FAIZA AMIRA SUROSO",
    "kelas": "XI Soshum 1",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12300",
    "nama": "FARDHANA KEYANO FIFALDY",
    "kelas": "XI Soshum 1",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12309",
    "nama": "GREENALDO SYIHABUDDIN GHIFARY",
    "kelas": "XI Soshum 1",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12313",
    "nama": "HANA KAMILATUN NISA`",
    "kelas": "XI Soshum 1",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12317",
    "nama": "HANUM PUTRI RAMADHANI",
    "kelas": "XI Soshum 1",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12322",
    "nama": "KANAYA SYALWA ANANTI",
    "kelas": "XI Soshum 1",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12328",
    "nama": "KHUMAIRA ZUKHRUFI MUIZMA",
    "kelas": "XI Soshum 1",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12330",
    "nama": "LUNA CANDRA SYAFAATASALIM",
    "kelas": "XI Soshum 1",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12333",
    "nama": "M. DAFA PRAMUDITIYA",
    "kelas": "XI Soshum 1",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12336",
    "nama": "MUHAMMAD JANKY DAUSAT",
    "kelas": "XI Soshum 1",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12340",
    "nama": "MUHAMMAD SHADDAM ATTALLAH",
    "kelas": "XI Soshum 1",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12351",
    "nama": "MOHAMMAD SEPTIAN NURIMANSYAH",
    "kelas": "XI Soshum 1",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12353",
    "nama": "MUHAMMAD AGHFA FIRDAUS",
    "kelas": "XI Soshum 1",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12356",
    "nama": "MUHAMMAD DAFFA KAMALUDDIN RAMDHANI",
    "kelas": "XI Soshum 1",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12357",
    "nama": "MUHAMMAD DIAS CLEARESTA",
    "kelas": "XI Soshum 1",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12365",
    "nama": "MUHAMMAD HASBI SETIAWAN",
    "kelas": "XI Soshum 1",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12368",
    "nama": "MUHAMMAD IRSYAD IFTIKHARUDDIN",
    "kelas": "XI Soshum 1",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12375",
    "nama": "NADHIFA NUR ATHIRAH",
    "kelas": "XI Soshum 1",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12376",
    "nama": "NADHIRA NUR ALIFAH",
    "kelas": "XI Soshum 1",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12393",
    "nama": "PUTRI JANNAH PUSPITASARI",
    "kelas": "XI Soshum 1",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12408",
    "nama": "RIZKA MUTHIA RAIHAN",
    "kelas": "XI Soshum 1",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12412",
    "nama": "SAFIRA FITHROTUS TSANIYAH",
    "kelas": "XI Soshum 1",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12415",
    "nama": "SANIE ANINDYA ARTANTI",
    "kelas": "XI Soshum 1",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12416",
    "nama": "SAYYIDAH AN NADHIFAH",
    "kelas": "XI Soshum 1",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12418",
    "nama": "SHEILA MELLYSA PUTRI",
    "kelas": "XI Soshum 1",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12426",
    "nama": "SYAFIRA AZZAHRA",
    "kelas": "XI Soshum 1",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12445",
    "nama": "KEYLA NUR FATIMATUZZAHRA",
    "kelas": "XI Soshum 1",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12446",
    "nama": "HAILAH AFIFAH HAKIM",
    "kelas": "XI Soshum 1",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12447",
    "nama": "HILMIYANDI",
    "kelas": "XI Soshum 1",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12243",
    "nama": "ABIDAH ULYA",
    "kelas": "XI Soshum 2",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12244",
    "nama": "ABRIELIA FI SABILILLAH ARDHINAR",
    "kelas": "XI Soshum 2",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12246",
    "nama": "ADEEL DANISH PUTRA",
    "kelas": "XI Soshum 2",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12259",
    "nama": "ALMIRA NAQIYAH FIRZANAH",
    "kelas": "XI Soshum 2",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12260",
    "nama": "ALUNA GHASSANI ARMAGITA",
    "kelas": "XI Soshum 2",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12267",
    "nama": "ANISA DWI ANDINI",
    "kelas": "XI Soshum 2",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12268",
    "nama": "ANJANI QUINN AZ ZAHRA",
    "kelas": "XI Soshum 2",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12271",
    "nama": "ARDHIAN RYADANA PRAMADITHA",
    "kelas": "XI Soshum 2",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12276",
    "nama": "AVIZA AQILAH PUTRI MAKSUN",
    "kelas": "XI Soshum 2",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12285",
    "nama": "DAVINA RAHMITA",
    "kelas": "XI Soshum 2",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12291",
    "nama": "ELVIRA AURELYN PUTRI DYAN RAMADHANI",
    "kelas": "XI Soshum 2",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12299",
    "nama": "FARAND GALE NUGRAHA",
    "kelas": "XI Soshum 2",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12319",
    "nama": "IMTINAN HAFID BAHASUAN",
    "kelas": "XI Soshum 2",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12324",
    "nama": "KEMAS ASYROF UBAIDILLAH",
    "kelas": "XI Soshum 2",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12327",
    "nama": "KHAZALIQA AL ARIF",
    "kelas": "XI Soshum 2",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12331",
    "nama": "MUHAMMAD AKBAR FADHILLAH SAPUTRA",
    "kelas": "XI Soshum 2",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12332",
    "nama": "MUHAMMAD BINTANG SULTHONI",
    "kelas": "XI Soshum 2",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12337",
    "nama": "M.NABIL FADLULLAH ARIANSYAH",
    "kelas": "XI Soshum 2",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12342",
    "nama": "MAIMANABILA APRILIA",
    "kelas": "XI Soshum 2",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12345",
    "nama": "MAYDENA VALERIE ALINE DJUNAIDI",
    "kelas": "XI Soshum 2",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12346",
    "nama": "MICHELLE PUTRI CHANDRA",
    "kelas": "XI Soshum 2",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12347",
    "nama": "MIFTAH FERROS MURTADHO ISMAIL",
    "kelas": "XI Soshum 2",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12348",
    "nama": "MIKAEL AR RIDHO",
    "kelas": "XI Soshum 2",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12358",
    "nama": "MUHAMMAD DIMAS WASI'",
    "kelas": "XI Soshum 2",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12361",
    "nama": "MUHAMMAD FANANI EL-HIKAM",
    "kelas": "XI Soshum 2",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12377",
    "nama": "NAIRA SHETRA AL FAWWAZ",
    "kelas": "XI Soshum 2",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12392",
    "nama": "PRINCE MUHAMMAD KHAYRU",
    "kelas": "XI Soshum 2",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12395",
    "nama": "QUINSHA NAURA PUTRI",
    "kelas": "XI Soshum 2",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12404",
    "nama": "REYHAN ALVARO RIZKY PERMANA",
    "kelas": "XI Soshum 2",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12409",
    "nama": "RIZKY ARDIANSYAH HARIONO",
    "kelas": "XI Soshum 2",
    "tingkat": 11,
    "jk": "L"
  },
  {
    "uid": "12411",
    "nama": "SAFA NABILA IQLIMA",
    "kelas": "XI Soshum 2",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12417",
    "nama": "SHANIA CONCETTA PICAULY",
    "kelas": "XI Soshum 2",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12420",
    "nama": "SOFIA AMALIA SAFITRI",
    "kelas": "XI Soshum 2",
    "tingkat": 11,
    "jk": "P"
  },
  {
    "uid": "12437",
    "nama": "ZIYAD ABDUL RASYID",
    "kelas": "XI Soshum 2",
    "tingkat": 11,
    "jk": "L"
  }
];

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

  console.log('\n' + '='.repeat(68));
  console.log('   PENGUJIAN FORM OTOMATIS 7 KAIH - VERTIKAL SMA 2026');
  console.log('='.repeat(68));

  // CEK SAKLAR STATUS AKTIF / NONAKTIF
  if (!STATUS_AKTIF) {
    console.log('\n[STATUS: NONAKTIF]');
    console.log('Fitur pengisian otomatis saat ini sedang DINONAKTIFKAN.');
    console.log('Tidak ada data yang dikirimkan ke database Google Sheets.');
    console.log('\nCara Mengaktifkan:');
    console.log('  1. Jalankan perintah: node auto_test.js --aktif');
    console.log('     ATAU');
    console.log('  2. Ubah baris kode di auto_test.js: STATUS_AKTIF = true;\n');
    console.log('='.repeat(68) + '\n');
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
  console.log('Memulai pengiriman jawaban acak ke Google Sheets...\n');

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

  console.log('\n' + '='.repeat(68));
  console.log('   RINGKASAN HASIL PENGUJIAN OTOMATIS');
  console.log('='.repeat(68));
  console.log('Total Akun Diproses : ' + targetList.length);
  console.log('Berhasil Disimpan   : ' + successCount + ' siswa');
  console.log('Sudah Terisi (Skip) : ' + alreadyCount + ' siswa');
  console.log('Gagal / Error       : ' + failCount + ' siswa');
  console.log('Waktu Pengerjaan    : ' + durationSec + ' detik');
  console.log('='.repeat(68));
  console.log('Data telah terekam di Google Sheets pada tab "Submissions" & "Summary".\n');
}

function printHelp() {
  console.log(`
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
`);
}

main().catch(err => {
  console.error('Fatal Error:', err);
});
