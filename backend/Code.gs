/**
 * Web Form Monitoring 7 KAIH - VERTIKAL SMA 2026
 * Google Apps Script Backend (Code.gs)
 * 
 * Fitur:
 * - REST API via doGet & doPost
 * - LockService untuk menangani lonjakan konkurensi (400+ siswa)
 * - Anti double-submission berbasis UID + Sesi
 * - Setup otomatis 4 Sheets (Users, Submissions, Sesi, Summary)
 */

// Konfigurasi Nama Sheet
const SHEETS = {
  USERS: 'Users',
  SUBMISSIONS: 'Submissions',
  SESI: 'Sesi',
  SUMMARY: 'Summary'
};

/**
 * Endpoint GET Handler
 */
function doGet(e) {
  return handleRequest(e, 'GET');
}

/**
 * Endpoint POST Handler
 */
function doPost(e) {
  return handleRequest(e, 'POST');
}

/**
 * Router & Handler Utama
 */
function handleRequest(e, method) {
  try {
    let params = {};
    if (method === 'GET') {
      params = e ? e.parameter : {};
    } else {
      // POST data dikirimkan sebagai text/plain JSON untuk menghindari CORS preflight OPTIONS issue
      if (e && e.postData && e.postData.contents) {
        try {
          params = JSON.parse(e.postData.contents);
        } catch (err) {
          params = e.parameter || {};
        }
      } else if (e && e.parameter) {
        params = e.parameter;
      }
    }

    const action = params.action;
    let responseData = { success: false, message: 'Action tidak dikenal' };

    switch (action) {
      case 'ping':
        responseData = { success: true, message: '7 KAIH Backend API is active', timestamp: new Date().toISOString() };
        break;

      case 'login':
        responseData = handleLogin(params.uid, params.password);
        break;

      case 'cekSesi':
        responseData = handleCekSesi();
        break;

      case 'cekSudahIsi':
        responseData = handleCekSudahIsi(params.uid, params.sesi);
        break;

      case 'submit':
        responseData = handleSubmit(params);
        break;

      case 'getPesertaDashboard':
        responseData = handleGetPesertaDashboard(params.uid);
        break;

      case 'getSubmissions':
        responseData = handleGetSubmissions(params.sesi, params.adminUid);
        break;

      case 'setSesiAktif':
        responseData = handleSetSesiAktif(params.sesi, params.adminUid);
        break;

      case 'getDetail':
        responseData = handleGetDetail(params.uid, params.sesi);
        break;

      default:
        responseData = { success: false, message: 'Parameter "action" tidak valid atau tidak disertakan.' };
        break;
    }

    return createJsonResponse(responseData);
  } catch (error) {
    return createJsonResponse({
      success: false,
      message: 'Server Error: ' + error.toString()
    });
  }
}

/**
 * Helper untuk response JSON dengan header CORS lengkap
 */
function createJsonResponse(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

/**
 * Helper mendapatkan instance Sheet
 */
function getSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Sheet "' + sheetName + '" tidak ditemukan. Silakan jalankan fungsi setupInitialSheets() terlebih dahulu.');
  }
  return sheet;
}

// ==========================================
// BUSINESS LOGIC HANDLERS
// ==========================================

/**
 * 1. Login Handler
 */
function handleLogin(uid, password) {
  if (!uid || !password) {
    return { success: false, message: 'UID dan password wajib diisi.' };
  }

  const sheet = getSheet(SHEETS.USERS);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return { success: false, message: 'Data pengguna kosong di database.' };
  }

  // Header matching dinamis (mencegah bug jika posisi kolom berubah atau bertambah)
  const headers = data[0].map(function(h) { return String(h || '').trim().toLowerCase(); });
  const colUid = headers.indexOf('uid') !== -1 ? headers.indexOf('uid') : 0;
  const colNama = headers.indexOf('nama') !== -1 ? headers.indexOf('nama') : 1;
  const colKelas = headers.indexOf('kelas') !== -1 ? headers.indexOf('kelas') : 2;
  const colTingkat = headers.indexOf('tingkat') !== -1 ? headers.indexOf('tingkat') : 3;
  let colPass = headers.indexOf('password');
  let colRole = headers.indexOf('role');
  let colJk = headers.findIndex(function(h) { return h === 'jk' || h === 'jenis kelamin' || h === 'gender'; });

  // Fallback index standar jika header tidak ada
  if (colPass === -1) colPass = (colJk !== -1 ? 5 : 4);
  if (colRole === -1) colRole = (colJk !== -1 ? 6 : 5);

  const cleanUid = String(uid).trim().toLowerCase();
  const cleanPass = String(password).trim();

  for (let i = 1; i < data.length; i++) {
    const rowUid = String(data[i][colUid]).trim().toLowerCase();
    const rowPass = String(data[i][colPass]).trim();

    if (rowUid === cleanUid && rowPass === cleanPass) {
      let jkVal = '';
      if (colJk !== -1 && data[i][colJk]) {
        jkVal = String(data[i][colJk]).trim().toUpperCase();
      }
      if (!jkVal) {
        jkVal = getStudentGender(cleanUid);
      }

      return {
        success: true,
        message: 'Login berhasil',
        user: {
          uid: String(data[i][colUid]).trim(),
          nama: data[i][colNama],
          kelas: data[i][colKelas],
          tingkat: data[i][colTingkat],
          jk: jkVal,
          role: String(data[i][colRole]).trim().toLowerCase()
        }
      };
    }
  }

  return { success: false, message: 'UID atau password salah.' };
}

/**
 * Helper memformat tanggal sel Google Sheets menjadi yyyy-MM-dd
 */
function formatCellDate(val) {
  if (!val) return '';
  if (Object.prototype.toString.call(val) === '[object Date]' || val instanceof Date) {
    try {
      return Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    } catch (e) {
      return String(val);
    }
  }
  return String(val);
}

/**
 * 2. Cek Sesi Aktif Hari Ini
 */
function handleCekSesi() {
  const sheet = getSheet(SHEETS.SESI);
  const data = sheet.getDataRange().getValues();
  // Format kolom: sesi (0), nama_sesi (1), tanggal (2), status (3)
  
  let sesiAktif = null;
  const listSesi = [];

  for (let i = 1; i < data.length; i++) {
    const item = {
      sesi: data[i][0],
      nama_sesi: data[i][1],
      tanggal: formatCellDate(data[i][2]),
      status: String(data[i][3]).trim().toLowerCase()
    };
    listSesi.push(item);
    if (item.status === 'aktif' && !sesiAktif) {
      sesiAktif = item;
    }
  }

  return {
    success: true,
    sesiAktif: sesiAktif,
    allSesi: listSesi,
    message: sesiAktif ? 'Sesi aktif ditemukan' : 'Tidak ada sesi pengisian yang aktif saat ini'
  };
}

/**
 * 3. Cek Status Pengisian Siswa untuk Sesi Tertentu
 */
function handleCekSudahIsi(uid, sesi) {
  if (!uid) {
    return { success: false, message: 'UID wajib disertakan.' };
  }

  const sheet = getSheet(SHEETS.SUBMISSIONS);
  const data = sheet.getDataRange().getValues();
  const cleanUid = String(uid).trim().toLowerCase();
  const targetSesi = sesi ? String(sesi).trim() : null;

  for (let i = 1; i < data.length; i++) {
    const rowUid = String(data[i][2]).trim().toLowerCase(); // Kolom UID (index 2)
    const rowSesi = String(data[i][6]).trim();             // Kolom Sesi (index 6)

    if (rowUid === cleanUid) {
      if (!targetSesi || rowSesi === targetSesi) {
        return {
          success: true,
          sudahIsi: true,
          sesi: rowSesi,
          waktuPengisian: data[i][1],
          submissionId: data[i][0]
        };
      }
    }
  }

  return {
    success: true,
    sudahIsi: false,
    sesi: targetSesi
  };
}

/**
 * 4. Submit Jawaban Form 7 KAIH (Menggunakan LockService)
 */
function handleSubmit(params) {
  const lock = LockService.getScriptLock();
  try {
    // Tunggu giliran lock hingga 10 detik agar aman dari race-condition 400 siswa
    lock.waitLock(10000);
  } catch (e) {
    return { success: false, message: 'Server sedang padat. Silakan coba kirim ulang dalam beberapa detik.' };
  }

  try {
    const uid = String(params.uid || '').trim();
    const answers = params.answers || {};

    if (!uid) {
      return { success: false, message: 'UID peserta tidak valid.' };
    }

    // Ambil data user untuk verifikasi & melengkapi profil
    const userSheet = getSheet(SHEETS.USERS);
    const userData = userSheet.getDataRange().getValues();
    let userProfile = null;
    for (let i = 1; i < userData.length; i++) {
      if (String(userData[i][0]).trim().toLowerCase() === uid.toLowerCase()) {
        userProfile = {
          uid: userData[i][0],
          nama: userData[i][1],
          kelas: userData[i][2],
          tingkat: userData[i][3]
        };
        break;
      }
    }

    if (!userProfile) {
      return { success: false, message: 'Data peserta tidak terdaftar di sistem.' };
    }

    // Ambil info sesi aktif jika parameter sesi tidak disertakan
    let sesiTarget = params.sesi;
    if (!sesiTarget) {
      const sesiInfo = handleCekSesi();
      if (!sesiInfo.sesiAktif) {
        return { success: false, message: 'Form ditutup: Tidak ada sesi pengisian yang aktif saat ini.' };
      }
      sesiTarget = sesiInfo.sesiAktif.sesi;
    }

    // Validasi apakah user sudah pernah submit di sesi ini
    const subSheet = getSheet(SHEETS.SUBMISSIONS);
    const subData = subSheet.getDataRange().getValues();
    for (let i = 1; i < subData.length; i++) {
      const rowUid = String(subData[i][2]).trim().toLowerCase();
      const rowSesi = String(subData[i][6]).trim();
      if (rowUid === uid.toLowerCase() && rowSesi === String(sesiTarget)) {
        return {
          success: false,
          message: 'Anda sudah pernah mengisi form untuk Sesi ' + sesiTarget + '. Form hanya dapat diisi 1 kali per sesi.'
        };
      }
    }

    // Siapkan row baru
    const submissionId = 'SUB-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '-' + Math.floor(1000 + Math.random() * 9000);
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

    // Parsing ibadah dengan proteksi mutual exclusivity ketat
    const ibadah = answers.ibadah || {};
    let isBerhalangan = (ibadah.berhalangan === true || ibadah.berhalangan === 'Ya');
    let isLengkap = (ibadah.lengkap === true || ibadah.lengkap === 'Ya');
    let isShubuh = (ibadah.shubuh === true || ibadah.shubuh === 'Ya');
    let isDzuhur = (ibadah.dzuhur === true || ibadah.dzuhur === 'Ya');
    let isAshar = (ibadah.ashar === true || ibadah.ashar === 'Ya');
    let isMaghrib = (ibadah.maghrib === true || ibadah.maghrib === 'Ya');
    let isIsya = (ibadah.isya === true || ibadah.isya === 'Ya');

    // JIKA SISWA LAKI-LAKI, OPSI BERHALANGAN MUTLAK TIDAK (FALSE)!
    let studentJk = userProfile.jk || getStudentGender(cleanUid);
    if (studentJk === 'L') {
      isBerhalangan = false;
    }

    // JIKA LENGKAP ATAU ADA SHALAT YANG DILAKUKAN, MAKA BERHALANGAN MUTLAK TIDAK (FALSE)!
    if (isLengkap || isShubuh || isDzuhur || isAshar || isMaghrib || isIsya) {
      isBerhalangan = false;
    }
    // SEBALIKNYA JIKA BERHALANGAN, SELURUH SHALAT MUTLAK TIDAK (FALSE)!
    if (isBerhalangan) {
      isLengkap = false;
      isShubuh = false;
      isDzuhur = false;
      isAshar = false;
      isMaghrib = false;
      isIsya = false;
    }

    const ibadahLengkap = isLengkap ? 'Ya' : 'Tidak';
    const ibadahShubuh = isShubuh ? 'Ya' : 'Tidak';
    const ibadahDzuhur = isDzuhur ? 'Ya' : 'Tidak';
    const ibadahAshar = isAshar ? 'Ya' : 'Tidak';
    const ibadahMaghrib = isMaghrib ? 'Ya' : 'Tidak';
    const ibadahIsya = isIsya ? 'Ya' : 'Tidak';
    const ibadahBerhalangan = isBerhalangan ? 'Ya' : 'Tidak';

    // Olahraga: Kolom OLAHRAGA strictly "Ya" / "Tidak", Kolom OLAHRAGA_DURASI strictly waktu durasinya (atau "-" jika Tidak)
    const isOlahraga = (answers.olahraga === 'Ya') ? 'Ya' : 'Tidak';
    const durasiOlahraga = isOlahraga === 'Ya' ? (answers.olahragaDurasi && answers.olahragaDurasi !== '-' ? answers.olahragaDurasi : '<20 mnt') : '-';

    // Peta nilai berdasarkan nama header kolom (mencegah kolom bergeser apapun urutannya di Google Sheets)
    const columnDataMap = {
      'ID_SUBMISSION': submissionId,
      'TIMESTAMP': timestamp,
      'WAKTU PENGISIAN': timestamp,
      'WAKTU_PENGISIAN': timestamp,
      'UID': userProfile.uid,
      'NAMA PENGISI': userProfile.nama,
      'NAMA_PENGISI': userProfile.nama,
      'NAMA': userProfile.nama,
      'KELAS': userProfile.kelas,
      'TINGKAT': userProfile.tingkat,
      'TINGKAT JENJANG': userProfile.tingkat,
      'TINGKAT_JENJANG': userProfile.tingkat,
      'SESI': sesiTarget,
      'BANGUN_PAGI': answers.bangunPagi || '',
      'BANGUN PAGI': answers.bangunPagi || '',
      'IBADAH_LENGKAP': ibadahLengkap,
      'LENGKAP': ibadahLengkap,
      'IBADAH_SHUBUH': ibadahShubuh,
      'SHUBUH': ibadahShubuh,
      'IBADAH_DZUHUR': ibadahDzuhur,
      'DZUHUR': ibadahDzuhur,
      'IBADAH_ASHAR': ibadahAshar,
      'ASHAR': ibadahAshar,
      'IBADAH_MAGHRIB': ibadahMaghrib,
      'MAGHRIB': ibadahMaghrib,
      'IBADAH_ISYA': ibadahIsya,
      'ISYA': ibadahIsya,
      'IBADAH_BERHALANGAN': ibadahBerhalangan,
      'BERHALANGAN': ibadahBerhalangan,
      'OLAHRAGA': isOlahraga,
      'OLAHRAGA_DURASI': durasiOlahraga,
      'DURASI OLAHRAGA': durasiOlahraga,
      'MAKAN_SEHAT': answers.makanSehat || '',
      'MAKAN SEHAT': answers.makanSehat || '',
      'MAKAN SEHAT BERGIZI': answers.makanSehat || '',
      'GEMAR_BELAJAR_DURASI': answers.gemarBelajarDurasi || '',
      'GEMAR BELAJAR': answers.gemarBelajarDurasi || '',
      'GEMAR_BELAJAR_CATATAN': answers.gemarBelajarCatatan || '',
      'CATATAN BELAJAR': answers.gemarBelajarCatatan || '',
      'BERMASYARAKAT': answers.bermasyarakat || '',
      'TIDUR_CEPAT': answers.tidurCepat || '',
      'TIDUR CEPAT': answers.tidurCepat || '',
      'TIDUR_CATATAN': answers.tidurCatatan || '',
      'CATATAN TIDUR': answers.tidurCatatan || ''
    };

    // Ambil header baris 1 dari sheet Submissions
    const lastCol = subSheet.getLastColumn();
    let rowToAppend = [];
    if (lastCol > 0) {
      const sheetHeaders = subSheet.getRange(1, 1, 1, lastCol).getValues()[0];
      rowToAppend = sheetHeaders.map(function(h) {
        const cleanH = String(h || '').trim().toUpperCase();
        return columnDataMap.hasOwnProperty(cleanH) ? columnDataMap[cleanH] : '';
      });
    }

    // Fallback jika baris header belum ada
    if (rowToAppend.length === 0) {
      rowToAppend = [
        submissionId, timestamp, userProfile.uid, userProfile.nama, userProfile.kelas, userProfile.tingkat, sesiTarget,
        answers.bangunPagi || '', ibadahLengkap, ibadahShubuh, ibadahDzuhur, ibadahAshar, ibadahMaghrib, ibadahIsya,
        ibadahBerhalangan, isOlahraga, durasiOlahraga, answers.makanSehat || '', answers.gemarBelajarDurasi || '',
        answers.gemarBelajarCatatan || '', answers.bermasyarakat || '', answers.tidurCepat || '', answers.tidurCatatan || ''
      ];
    }

    subSheet.appendRow(rowToAppend);

    return {
      success: true,
      message: 'Alhamdulillah, data kebiasaan 7 KAIH berhasil dikirim!',
      submissionId: submissionId,
      sesi: sesiTarget
    };
  } catch (err) {
    return { success: false, message: 'Gagal menyimpan: ' + err.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * 5. Dashboard Peserta (Mendapatkan status 4 sesi untuk user)
 */
function handleGetPesertaDashboard(uid) {
  if (!uid) {
    return { success: false, message: 'UID wajib disertakan.' };
  }

  const userSheet = getSheet(SHEETS.USERS);
  const userData = userSheet.getDataRange().getValues();
  let user = null;
  const cleanUid = String(uid).trim().toLowerCase();

  const uHeaders = userData[0].map(function(h) { return String(h || '').trim().toLowerCase(); });
  const colUid = uHeaders.indexOf('uid') !== -1 ? uHeaders.indexOf('uid') : 0;
  const colNama = uHeaders.indexOf('nama') !== -1 ? uHeaders.indexOf('nama') : 1;
  const colKelas = uHeaders.indexOf('kelas') !== -1 ? uHeaders.indexOf('kelas') : 2;
  const colTingkat = uHeaders.indexOf('tingkat') !== -1 ? uHeaders.indexOf('tingkat') : 3;
  const colRole = uHeaders.indexOf('role') !== -1 ? uHeaders.indexOf('role') : (userData[0].length >= 7 ? 6 : 5);
  const colJk = uHeaders.findIndex(function(h) { return h === 'jk' || h === 'jenis kelamin' || h === 'gender'; });

  for (let i = 1; i < userData.length; i++) {
    if (String(userData[i][colUid]).trim().toLowerCase() === cleanUid) {
      let jkVal = (colJk !== -1 && userData[i][colJk]) ? String(userData[i][colJk]).trim().toUpperCase() : getStudentGender(cleanUid);
      user = {
        uid: userData[i][colUid],
        nama: userData[i][colNama],
        kelas: userData[i][colKelas],
        tingkat: userData[i][colTingkat],
        jk: jkVal,
        role: userData[i][colRole]
      };
      break;
    }
  }

  if (!user) {
    return { success: false, message: 'Peserta tidak ditemukan.' };
  }

  // Ambil daftar seluruh sesi
  const sesiSheet = getSheet(SHEETS.SESI);
  const sesiData = sesiSheet.getDataRange().getValues();
  const sesiMap = {};
  for (let i = 1; i < sesiData.length; i++) {
    const sId = String(sesiData[i][0]).trim();
    sesiMap[sId] = {
      sesi: sId,
      nama: sesiData[i][1],
      tanggal: formatCellDate(sesiData[i][2]),
      statusSesi: String(sesiData[i][3]).trim().toLowerCase(), // 'aktif' atau 'nonaktif'
      sudahIsi: false,
      detail: null
    };
  }

  // Cek riwayat submissions peserta
  const subSheet = getSheet(SHEETS.SUBMISSIONS);
  const subData = subSheet.getDataRange().getValues();
  for (let i = 1; i < subData.length; i++) {
    if (String(subData[i][2]).trim().toLowerCase() === cleanUid) {
      const sId = String(subData[i][6]).trim();
      if (sesiMap[sId]) {
        sesiMap[sId].sudahIsi = true;
        sesiMap[sId].detail = {
          submissionId: subData[i][0],
          timestamp: subData[i][1],
          bangunPagi: subData[i][7],
          ibadahLengkap: subData[i][8],
          ibadahBerhalangan: subData[i][14] === 'Ya',
          olahraga: subData[i][15],
          olahragaDurasi: subData[i][16],
          makanSehat: subData[i][17],
          gemarBelajar: subData[i][18],
          bermasyarakat: subData[i][20],
          tidurCepat: subData[i][21]
        };
      }
    }
  }

  const sessionsResult = Object.keys(sesiMap).map(key => sesiMap[key]);

  return {
    success: true,
    user: user,
    sessions: sessionsResult
  };
}

/**
 * 6. Dashboard Admin: Rekap Peserta & Kehadiran per Sesi
 */
function handleGetSubmissions(sesi, adminUid) {
  // Opsional: Cek apakah user admin
  if (adminUid) {
    const userSheet = getSheet(SHEETS.USERS);
    const userData = userSheet.getDataRange().getValues();
    let isAdmin = false;
    for (let i = 1; i < userData.length; i++) {
      if (String(userData[i][0]).trim().toLowerCase() === String(adminUid).trim().toLowerCase()) {
        if (String(userData[i][5]).trim().toLowerCase() === 'admin') {
          isAdmin = true;
        }
        break;
      }
    }
    if (!isAdmin) {
      return { success: false, message: 'Akses ditolak: Hanya admin yang dapat melihat rekap.' };
    }
  }

  const sesiSheet = getSheet(SHEETS.SESI);
  const sesiData = sesiSheet.getDataRange().getValues();
  let targetSesi = sesi ? String(sesi).trim() : null;

  // Jika sesi tidak ditentukan, ambil sesi aktif
  if (!targetSesi) {
    for (let i = 1; i < sesiData.length; i++) {
      if (String(sesiData[i][3]).trim().toLowerCase() === 'aktif') {
        targetSesi = String(sesiData[i][0]).trim();
        break;
      }
    }
    if (!targetSesi && sesiData.length > 1) {
      targetSesi = String(sesiData[1][0]).trim(); // Default ke sesi 1 jika tidak ada yg aktif
    }
  }

  // Ambil semua user peserta
  const userSheet = getSheet(SHEETS.USERS);
  const userData = userSheet.getDataRange().getValues();
  const allPeserta = [];

  for (let i = 1; i < userData.length; i++) {
    const role = String(userData[i][5]).trim().toLowerCase();
    if (role === 'peserta') {
      allPeserta.push({
        uid: String(userData[i][0]).trim(),
        nama: userData[i][1],
        kelas: userData[i][2],
        tingkat: userData[i][3],
        sudahIsi: false,
        waktuPengisian: null,
        submissionId: null
      });
    }
  }

  // Ambil submission untuk targetSesi
  const subSheet = getSheet(SHEETS.SUBMISSIONS);
  const subData = subSheet.getDataRange().getValues();
  const submissionMap = {};

  for (let i = 1; i < subData.length; i++) {
    const rowSesi = String(subData[i][6]).trim();
    if (rowSesi === targetSesi) {
      const rowUid = String(subData[i][2]).trim().toLowerCase();
      submissionMap[rowUid] = {
        submissionId: subData[i][0],
        waktuPengisian: subData[i][1]
      };
    }
  }

  let totalSudah = 0;
  for (let i = 0; i < allPeserta.length; i++) {
    const pUid = allPeserta[i].uid.toLowerCase();
    if (submissionMap[pUid]) {
      allPeserta[i].sudahIsi = true;
      allPeserta[i].waktuPengisian = submissionMap[pUid].waktuPengisian;
      allPeserta[i].submissionId = submissionMap[pUid].submissionId;
      totalSudah++;
    }
  }

  const totalPeserta = allPeserta.length;
  const persentase = totalPeserta > 0 ? Math.round((totalSudah / totalPeserta) * 100) : 0;

  return {
    success: true,
    sesi: targetSesi,
    summary: {
      totalPeserta: totalPeserta,
      totalSudah: totalSudah,
      totalBelum: totalPeserta - totalSudah,
      persentase: persentase
    },
    pesertaList: allPeserta
  };
}

/**
 * 7. Ubah Sesi Aktif (Admin Only)
 * Mengaktifkan sesi yang dipilih dan menonaktifkan sesi lainnya di Sheet Sesi
 */
function handleSetSesiAktif(targetSesi, adminUid) {
  if (!targetSesi) {
    return { success: false, message: 'Nomor sesi wajib disertakan.' };
  }

  const sheet = getSheet(SHEETS.SESI);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const sId = String(data[i][0]).trim();
    if (sId === String(targetSesi).trim()) {
      sheet.getRange(i + 1, 4).setValue('aktif');
    } else {
      sheet.getRange(i + 1, 4).setValue('nonaktif');
    }
  }

  return {
    success: true,
    message: 'Sesi ' + targetSesi + ' sekarang berstatus aktif. Sesi lainnya otomatis selesai/ditutup.',
    sesiAktif: String(targetSesi).trim()
  };
}

/**
 * 8. Ambil Detail Jawaban 1 Peserta
 */
function handleGetDetail(uid, sesi) {
  if (!uid || !sesi) {
    return { success: false, message: 'UID dan Sesi wajib disertakan.' };
  }

  const subSheet = getSheet(SHEETS.SUBMISSIONS);
  const data = subSheet.getDataRange().getValues();
  const cleanUid = String(uid).trim().toLowerCase();
  const targetSesi = String(sesi).trim();

  for (let i = 1; i < data.length; i++) {
    const rowUid = String(data[i][2]).trim().toLowerCase();
    const rowSesi = String(data[i][6]).trim();

    if (rowUid === cleanUid && rowSesi === targetSesi) {
      return {
        success: true,
        detail: {
          submissionId: data[i][0],
          timestamp: data[i][1],
          uid: data[i][2],
          nama: data[i][3],
          kelas: data[i][4],
          tingkat: data[i][5],
          sesi: data[i][6],
          bangunPagi: data[i][7],
          ibadah: {
            lengkap: data[i][8] === 'Ya',
            shubuh: data[i][9] === 'Ya',
            dzuhur: data[i][10] === 'Ya',
            ashar: data[i][11] === 'Ya',
            maghrib: data[i][12] === 'Ya',
            isya: data[i][13] === 'Ya',
            berhalangan: data[i][14] === 'Ya'
          },
          olahraga: data[i][15],
          olahragaDurasi: data[i][16],
          makanSehat: data[i][17],
          gemarBelajarDurasi: data[i][18],
          gemarBelajarCatatan: data[i][19],
          bermasyarakat: data[i][20],
          tidurCepat: data[i][21],
          tidurCatatan: data[i][22]
        }
      };
    }
  }

  return { success: false, message: 'Data submission tidak ditemukan untuk peserta dan sesi tersebut.' };
}

// ==========================================
// AUTO SETUP FUNCTION (ONE-CLICK INITIALIZATION)
// ==========================================

/**
 * Jalankan fungsi ini SEKALI di editor Apps Script untuk membuat & memformat
 * 4 sheet secara otomatis dengan header dan data sampel bawaan!
 */
function setupInitialSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Setup Sheet 'Users'
  let userSheet = ss.getSheetByName(SHEETS.USERS);
  if (!userSheet) {
    userSheet = ss.insertSheet(SHEETS.USERS);
  }
  userSheet.clear();
  const userHeaders = ['uid', 'nama', 'kelas', 'tingkat', 'jk', 'password', 'role'];
  userSheet.appendRow(userHeaders);
  userSheet.getRange(1, 1, 1, userHeaders.length).setFontWeight('bold').setBackground('#2563EB').setFontColor('#FFFFFF');
  
  // Memasukkan 1 Admin + 357 Akun Siswa (Total 358 Akun)
  const initialUsers = getAllStudentData();
  userSheet.getRange(2, 1, initialUsers.length, userHeaders.length).setValues(initialUsers);

  // 2. Setup Sheet 'Submissions'
  let subSheet = ss.getSheetByName(SHEETS.SUBMISSIONS);
  if (!subSheet) {
    subSheet = ss.insertSheet(SHEETS.SUBMISSIONS);
  }
  subSheet.clear();
  const subHeaders = [
    'ID_SUBMISSION', 'TIMESTAMP', 'UID', 'NAMA PENGISI', 'KELAS', 'TINGKAT', 'SESI',
    'BANGUN_PAGI', 'IBADAH_LENGKAP', 'IBADAH_SHUBUH', 'IBADAH_DZUHUR', 'IBADAH_ASHAR', 'IBADAH_MAGHRIB', 'IBADAH_ISYA',
    'IBADAH_BERHALANGAN',
    'OLAHRAGA', 'OLAHRAGA_DURASI', 'MAKAN_SEHAT', 'GEMAR_BELAJAR_DURASI', 'GEMAR_BELAJAR_CATATAN',
    'BERMASYARAKAT', 'TIDUR_CEPAT', 'TIDUR_CATATAN'
  ];
  subSheet.appendRow(subHeaders);
  subSheet.getRange(1, 1, 1, subHeaders.length).setFontWeight('bold').setBackground('#059669').setFontColor('#FFFFFF');

  // 3. Setup Sheet 'Sesi'
  let sesiSheet = ss.getSheetByName(SHEETS.SESI);
  if (!sesiSheet) {
    sesiSheet = ss.insertSheet(SHEETS.SESI);
  }
  sesiSheet.clear();
  const sesiHeaders = ['sesi', 'nama_sesi', 'tanggal', 'status'];
  sesiSheet.appendRow(sesiHeaders);
  sesiSheet.getRange(1, 1, 1, sesiHeaders.length).setFontWeight('bold').setBackground('#D97706').setFontColor('#FFFFFF');

  const initialSesi = [
    ['1', 'Sesi 1 (Minggu ke-1)', '2026-10-27', 'aktif'],
    ['2', 'Sesi 2 (Minggu ke-1)', '2026-10-30', 'nonaktif'],
    ['3', 'Sesi 3 (Minggu ke-2)', '2026-11-03', 'nonaktif'],
    ['4', 'Sesi 4 (Minggu ke-2)', '2026-11-06', 'nonaktif']
  ];
  sesiSheet.getRange(2, 1, initialSesi.length, sesiHeaders.length).setValues(initialSesi);

  // 4. Setup Sheet 'Summary'
  let sumSheet = ss.getSheetByName(SHEETS.SUMMARY);
  if (!sumSheet) {
    sumSheet = ss.insertSheet(SHEETS.SUMMARY);
  }
  sumSheet.clear();
  sumSheet.getRange('A1:D1').setValues([['RINGKASAN SESI', 'TOTAL SISWA', 'SUDAH ISI', 'PERSENTASE']]);
  sumSheet.getRange('A1:D1').setFontWeight('bold').setBackground('#4B5563').setFontColor('#FFFFFF');
  
  // Formula sederhana
  sumSheet.getRange('A2:D5').setValues([
    ['Sesi 1', '=COUNTIF(Users!F:F, "peserta")', '=COUNTIF(Submissions!G:G, "1")', '=IF(B2>0, C2/B2, 0)'],
    ['Sesi 2', '=COUNTIF(Users!F:F, "peserta")', '=COUNTIF(Submissions!G:G, "2")', '=IF(B3>0, C3/B3, 0)'],
    ['Sesi 3', '=COUNTIF(Users!F:F, "peserta")', '=COUNTIF(Submissions!G:G, "3")', '=IF(B4>0, C4/B4, 0)'],
    ['Sesi 4', '=COUNTIF(Users!F:F, "peserta")', '=COUNTIF(Submissions!G:G, "4")', '=IF(B5>0, C5/B5, 0)']
  ]);
  sumSheet.getRange('D2:D5').setNumberFormat('0.0%');

  Logger.log('Inisialisasi 4 Sheet 7 KAIH berhasil dibuat!');
}


/**
 * Fungsi Khusus untuk Import Ulang / Sync 357 Siswa ke Sheet Users
 * Jalankan fungsi ini jika Anda hanya ingin memperbarui tab Users tanpa mereset sheet lain.
 */
function importAllStudents() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let userSheet = ss.getSheetByName(SHEETS.USERS);
  if (!userSheet) {
    userSheet = ss.insertSheet(SHEETS.USERS);
  }
  userSheet.clear();
  const userHeaders = ['uid', 'nama', 'kelas', 'tingkat', 'jk', 'password', 'role'];
  userSheet.appendRow(userHeaders);
  userSheet.getRange(1, 1, 1, userHeaders.length).setFontWeight('bold').setBackground('#2563EB').setFontColor('#FFFFFF');
  
  const studentData = getAllStudentData();
  userSheet.getRange(2, 1, studentData.length, userHeaders.length).setValues(studentData);
  Logger.log('Berhasil mengimpor ' + studentData.length + ' akun ke Sheet Users!');
}

/**
 * Helper Mendapatkan Jenis Kelamin Berdasarkan UID
 */
function getStudentGender(uid) {
  const map = {"12243":"P","12244":"P","12245":"L","12246":"L","12247":"P","12248":"L","12249":"L","12250":"L","12251":"L","12252":"P","12253":"P","12254":"P","12255":"L","12256":"L","12257":"P","12258":"L","12259":"P","12260":"P","12261":"P","12262":"P","12263":"P","12264":"L","12265":"L","12266":"P","12267":"P","12268":"P","12269":"P","12270":"P","12271":"L","12272":"L","12273":"L","12275":"L","12276":"P","12277":"L","12278":"L","12279":"P","12280":"L","12281":"L","12282":"P","12283":"P","12284":"L","12285":"P","12286":"L","12287":"L","12288":"L","12289":"P","12290":"P","12291":"P","12292":"P","12293":"P","12294":"P","12295":"P","12296":"L","12297":"P","12298":"P","12299":"L","12300":"L","12301":"L","12302":"L","12303":"L","12304":"P","12305":"P","12306":"P","12307":"L","12308":"L","12309":"L","12310":"L","12312":"L","12313":"P","12314":"L","12315":"P","12316":"P","12317":"P","12318":"L","12319":"P","12320":"L","12321":"L","12322":"P","12324":"L","12325":"L","12326":"P","12327":"P","12328":"P","12330":"P","12331":"L","12332":"L","12333":"L","12334":"L","12335":"L","12336":"L","12337":"L","12338":"L","12339":"L","12340":"L","12341":"L","12342":"P","12344":"P","12345":"P","12346":"P","12347":"L","12348":"L","12349":"L","12350":"L","12351":"L","12353":"L","12354":"L","12355":"L","12356":"L","12357":"L","12358":"L","12359":"L","12360":"L","12361":"L","12362":"L","12363":"L","12364":"L","12365":"L","12366":"L","12367":"L","12368":"L","12369":"L","12370":"L","12371":"L","12372":"L","12373":"L","12374":"P","12375":"P","12376":"P","12377":"P","12378":"L","12379":"L","12380":"L","12381":"P","12382":"P","12383":"P","12384":"L","12385":"P","12387":"P","12388":"P","12389":"P","12390":"P","12392":"L","12393":"P","12394":"P","12395":"P","12396":"L","12397":"L","12398":"L","12399":"P","12400":"L","12401":"P","12402":"L","12404":"L","12405":"L","12406":"L","12407":"L","12408":"P","12409":"L","12410":"L","12411":"P","12412":"P","12413":"P","12414":"P","12415":"P","12416":"P","12417":"P","12418":"P","12419":"L","12420":"P","12422":"L","12423":"L","12424":"L","12425":"L","12426":"P","12427":"P","12428":"P","12429":"L","12430":"P","12431":"L","12432":"L","12433":"P","12434":"L","12435":"L","12436":"P","12437":"L","12441":"L","12442":"L","12444":"L","12445":"P","12446":"P","12447":"L","12448":"L","12449":"L","12450":"L","12451":"L","12452":"L","12453":"L","12454":"L","12455":"L","12456":"L","12457":"L","12458":"P","12459":"P","12460":"L","12461":"P","12463":"P","12464":"L","12465":"P","12466":"L","12467":"L","12468":"L","12469":"L","12470":"P","12471":"L","12472":"P","12473":"P","12474":"P","12475":"P","12476":"P","12477":"P","12478":"L","12479":"P","12480":"L","12481":"P","12482":"L","12483":"L","12484":"P","12485":"L","12486":"L","12487":"P","12488":"P","12489":"L","12490":"P","12491":"P","12492":"L","12493":"L","12494":"L","12495":"L","12496":"P","12497":"P","12498":"L","12499":"P","12500":"L","12501":"L","12502":"L","12503":"P","12504":"P","12505":"P","12506":"L","12507":"P","12508":"L","12509":"L","12510":"L","12511":"L","12512":"P","12513":"P","12514":"P","12515":"L","12516":"P","12517":"P","12518":"P","12519":"P","12520":"P","12521":"P","12522":"L","12523":"L","12524":"L","12525":"L","12526":"L","12527":"L","12528":"L","12529":"L","12530":"P","12531":"P","12532":"P","12533":"L","12534":"L","12535":"L","12536":"L","12537":"L","12538":"L","12539":"L","12540":"L","12541":"L","12542":"L","12543":"L","12544":"L","12545":"L","12546":"L","12547":"L","12548":"L","12549":"L","12550":"L","12551":"L","12552":"L","12553":"L","12554":"L","12555":"P","12556":"P","12557":"P","12558":"P","12559":"P","12560":"P","12561":"P","12562":"P","12563":"P","12564":"P","12565":"P","12566":"P","12567":"P","12568":"P","12569":"L","12570":"P","12571":"P","12572":"L","12573":"L","12574":"P","12575":"L","12576":"P","12577":"L","12578":"L","12579":"L","12580":"P","12581":"L","12582":"P","12583":"P","12584":"L","12585":"P","12586":"P","12587":"P","12588":"P","12589":"P","12590":"L","12591":"P","12592":"L","12593":"L","12594":"L","12595":"P","12596":"P","12597":"L","12598":"P","12599":"P","12600":"L","12601":"P","12602":"P","12603":"P","12604":"P","12605":"L","12606":"P","12607":"P","12608":"P","12609":"P","12610":"P","12611":"P","12612":"P","12613":"L","12614":"L"};
  return map[String(uid).trim()] || 'L';
}

/**
 * Database Master 357 Akun Siswa + 1 Akun Admin (Dengan Kolom JK: 'L' / 'P')
 */
function getAllStudentData() {
  return [
  [
    "admin",
    "Administrator 7 KAIH",
    "Guru BK / Tim Panitia",
    "Umum",
    "L",
    "admin2026",
    "admin"
  ],
  [
    "12452",
    "AHMAD HISYAM AIZAR",
    "X-1",
    "10",
    "L",
    "12452",
    "peserta"
  ],
  [
    "12463",
    "ANINDYA KHANZA AZ ZHARIIFAH",
    "X-1",
    "10",
    "P",
    "12463",
    "peserta"
  ],
  [
    "12465",
    "ARAYA CITRA PUSPITASARI",
    "X-1",
    "10",
    "P",
    "12465",
    "peserta"
  ],
  [
    "12466",
    "ARDELLINO SYAPUTRA",
    "X-1",
    "10",
    "L",
    "12466",
    "peserta"
  ],
  [
    "12470",
    "ASYIFA AURELIA ARVA",
    "X-1",
    "10",
    "P",
    "12470",
    "peserta"
  ],
  [
    "12491",
    "DWI RAHMANIA AULIA",
    "X-1",
    "10",
    "P",
    "12491",
    "peserta"
  ],
  [
    "12502",
    "FATWAN KHULAFA' AL BALADY",
    "X-1",
    "10",
    "L",
    "12502",
    "peserta"
  ],
  [
    "12511",
    "IMAM BARRY WAFAUL WAFAK",
    "X-1",
    "10",
    "L",
    "12511",
    "peserta"
  ],
  [
    "12519",
    "KEYSHA KHANSA NAHDA YUFA",
    "X-1",
    "10",
    "P",
    "12519",
    "peserta"
  ],
  [
    "12532",
    "MIRANDA CALYSTA PUTRI",
    "X-1",
    "10",
    "P",
    "12532",
    "peserta"
  ],
  [
    "12538",
    "MUHAMMAD EMIR ISMAT LUBAID",
    "X-1",
    "10",
    "L",
    "12538",
    "peserta"
  ],
  [
    "12542",
    "MOH. FIKRUL ZAM ZAMI",
    "X-1",
    "10",
    "L",
    "12542",
    "peserta"
  ],
  [
    "12544",
    "MUHAMMAD HILMI",
    "X-1",
    "10",
    "L",
    "12544",
    "peserta"
  ],
  [
    "12552",
    "MUHAMMAD TANTOWI FARID JAUHARI",
    "X-1",
    "10",
    "L",
    "12552",
    "peserta"
  ],
  [
    "12553",
    "MUHAMMAD YUSRI ASYFA",
    "X-1",
    "10",
    "L",
    "12553",
    "peserta"
  ],
  [
    "12563",
    "NASYA ZAUZAHRO AIDANUR IRWANTO",
    "X-1",
    "10",
    "P",
    "12563",
    "peserta"
  ],
  [
    "12582",
    "RIZKA NAILUL ULYA",
    "X-1",
    "10",
    "P",
    "12582",
    "peserta"
  ],
  [
    "12584",
    "SAIF ALFATH",
    "X-1",
    "10",
    "L",
    "12584",
    "peserta"
  ],
  [
    "12590",
    "SHERHAN GHANIYYU ATMA",
    "X-1",
    "10",
    "L",
    "12590",
    "peserta"
  ],
  [
    "12599",
    "TSABITA MAYLAFFAYZA DAIMAH",
    "X-1",
    "10",
    "P",
    "12599",
    "peserta"
  ],
  [
    "12604",
    "YOSI AYU WANDIRA",
    "X-1",
    "10",
    "P",
    "12604",
    "peserta"
  ],
  [
    "12609",
    "ZAHRINATUS SYAFA ANNIDA",
    "X-1",
    "10",
    "P",
    "12609",
    "peserta"
  ],
  [
    "12472",
    "ATHAYA LIANDRA PUTRI ARDIYATI WIBOWO",
    "X-2",
    "10",
    "P",
    "12472",
    "peserta"
  ],
  [
    "12476",
    "AULIA ZULFA YASMIN",
    "X-2",
    "10",
    "P",
    "12476",
    "peserta"
  ],
  [
    "12477",
    "AURELIA AISY MUMTAZ",
    "X-2",
    "10",
    "P",
    "12477",
    "peserta"
  ],
  [
    "12480",
    "AZKA SYAFIQ RAYYAN",
    "X-2",
    "10",
    "L",
    "12480",
    "peserta"
  ],
  [
    "12493",
    "EMIR SATRIA TAMBUNAN",
    "X-2",
    "10",
    "L",
    "12493",
    "peserta"
  ],
  [
    "12494",
    "FAHMI AL DIN HUSAIN PUTRA WARDANI",
    "X-2",
    "10",
    "L",
    "12494",
    "peserta"
  ],
  [
    "12505",
    "GLADIZIA AZZAHRA PURNOMO",
    "X-2",
    "10",
    "P",
    "12505",
    "peserta"
  ],
  [
    "12507",
    "HAFSHA AZZAHRA",
    "X-2",
    "10",
    "P",
    "12507",
    "peserta"
  ],
  [
    "12515",
    "JNO KENANDITO SUHUD",
    "X-2",
    "10",
    "L",
    "12515",
    "peserta"
  ],
  [
    "12527",
    "MAHATMA SATRIA WARDHANA",
    "X-2",
    "10",
    "L",
    "12527",
    "peserta"
  ],
  [
    "12534",
    "MUHAMMAD YAHYA ELANG MAULANA",
    "X-2",
    "10",
    "L",
    "12534",
    "peserta"
  ],
  [
    "12550",
    "MUHAMMAD SHAFA FAIZATUNNAJA PUTRA AKBAR",
    "X-2",
    "10",
    "L",
    "12550",
    "peserta"
  ],
  [
    "12561",
    "NAMIRA HILWA",
    "X-2",
    "10",
    "P",
    "12561",
    "peserta"
  ],
  [
    "12569",
    "NUR AZMI RIYANTO",
    "X-2",
    "10",
    "L",
    "12569",
    "peserta"
  ],
  [
    "12587",
    "SAVIERA NADHIA ZULVA",
    "X-2",
    "10",
    "P",
    "12587",
    "peserta"
  ],
  [
    "12589",
    "SHARANI QUENICA PUTRI",
    "X-2",
    "10",
    "P",
    "12589",
    "peserta"
  ],
  [
    "12591",
    "SINTA DEWI PELANGI",
    "X-2",
    "10",
    "P",
    "12591",
    "peserta"
  ],
  [
    "12601",
    "XIKE AZZA GRESSIA",
    "X-2",
    "10",
    "P",
    "12601",
    "peserta"
  ],
  [
    "12606",
    "ZAFEERA NISWA SALSABILA ARROSIDI",
    "X-2",
    "10",
    "P",
    "12606",
    "peserta"
  ],
  [
    "12610",
    "ZHAFIRA PUTRI WIJAYA",
    "X-2",
    "10",
    "P",
    "12610",
    "peserta"
  ],
  [
    "12450",
    "AESAR RAFIE BRAHMANTYA",
    "X-3",
    "10",
    "L",
    "12450",
    "peserta"
  ],
  [
    "12454",
    "AHMAD JAUHAR AL-A'LA",
    "X-3",
    "10",
    "L",
    "12454",
    "peserta"
  ],
  [
    "12458",
    "AISYAH MAULIDAH RAHMAWATI",
    "X-3",
    "10",
    "P",
    "12458",
    "peserta"
  ],
  [
    "12459",
    "AISYAH RAHMA AZHARA",
    "X-3",
    "10",
    "P",
    "12459",
    "peserta"
  ],
  [
    "12464",
    "AQEELA AZKA ARDHANA",
    "X-3",
    "10",
    "L",
    "12464",
    "peserta"
  ],
  [
    "12469",
    "ARYA MIZZANY",
    "X-3",
    "10",
    "L",
    "12469",
    "peserta"
  ],
  [
    "12479",
    "AZKA RAMADHANI JUNIAWAN",
    "X-3",
    "10",
    "P",
    "12479",
    "peserta"
  ],
  [
    "12484",
    "BETHARI MANGGAR WIKANTO",
    "X-3",
    "10",
    "P",
    "12484",
    "peserta"
  ],
  [
    "12490",
    "DINAR KHOIRUNNISA",
    "X-3",
    "10",
    "P",
    "12490",
    "peserta"
  ],
  [
    "12492",
    "DZAKY ZAFRAN ALFARIZKY",
    "X-3",
    "10",
    "L",
    "12492",
    "peserta"
  ],
  [
    "12504",
    "FILIA FATIN QAIS EL WAFA",
    "X-3",
    "10",
    "P",
    "12504",
    "peserta"
  ],
  [
    "12508",
    "HILAL ACHMAD FAKHRUDIN",
    "X-3",
    "10",
    "L",
    "12508",
    "peserta"
  ],
  [
    "12509",
    "IBRAHIM ATTAR BRAMANTYO",
    "X-3",
    "10",
    "L",
    "12509",
    "peserta"
  ],
  [
    "12514",
    "JEVANYA AVRA FREDELINA QUELENE",
    "X-3",
    "10",
    "P",
    "12514",
    "peserta"
  ],
  [
    "12516",
    "KEISHA SHAKILA HARUN",
    "X-3",
    "10",
    "P",
    "12516",
    "peserta"
  ],
  [
    "12528",
    "MAS RAJA FIRMANSYAH",
    "X-3",
    "10",
    "L",
    "12528",
    "peserta"
  ],
  [
    "12536",
    "MUHAMMAD AZKA ALFARIZI",
    "X-3",
    "10",
    "L",
    "12536",
    "peserta"
  ],
  [
    "12546",
    "MUHAMMAD NAUFAL LABIB",
    "X-3",
    "10",
    "L",
    "12546",
    "peserta"
  ],
  [
    "12549",
    "MUHAMMAD RIZQI RAMADHAN",
    "X-3",
    "10",
    "L",
    "12549",
    "peserta"
  ],
  [
    "12556",
    "NADIN AMIRA RAHMADINAH",
    "X-3",
    "10",
    "P",
    "12556",
    "peserta"
  ],
  [
    "12560",
    "NAJWA ASYILAH CHAIRANI",
    "X-3",
    "10",
    "P",
    "12560",
    "peserta"
  ],
  [
    "12565",
    "NAUREEN TARA YALENA",
    "X-3",
    "10",
    "P",
    "12565",
    "peserta"
  ],
  [
    "12574",
    "QARSAFAH AL ZAHLIYAH RACHMAWATI ZULKARNAIN",
    "X-3",
    "10",
    "P",
    "12574",
    "peserta"
  ],
  [
    "12579",
    "REYHAAN ASMAR PRIBADI PUTRA",
    "X-3",
    "10",
    "L",
    "12579",
    "peserta"
  ],
  [
    "12588",
    "SHABRINA PUTRI AL GHIFFARY",
    "X-3",
    "10",
    "P",
    "12588",
    "peserta"
  ],
  [
    "12598",
    "TSABITA HASNAH HENDITA",
    "X-3",
    "10",
    "P",
    "12598",
    "peserta"
  ],
  [
    "12600",
    "USAID RAIHAAN DAMIS",
    "X-3",
    "10",
    "L",
    "12600",
    "peserta"
  ],
  [
    "12602",
    "YASMIN DINAAR ARAFAH",
    "X-3",
    "10",
    "P",
    "12602",
    "peserta"
  ],
  [
    "12605",
    "YUSUF",
    "X-3",
    "10",
    "L",
    "12605",
    "peserta"
  ],
  [
    "12611",
    "ZIDNY ILMA",
    "X-3",
    "10",
    "P",
    "12611",
    "peserta"
  ],
  [
    "12453",
    "AHMAD IHSAN AR ROSIDY",
    "X-4",
    "10",
    "L",
    "12453",
    "peserta"
  ],
  [
    "12455",
    "AHMAD NAUFAL FARRAS",
    "X-4",
    "10",
    "L",
    "12455",
    "peserta"
  ],
  [
    "12461",
    "ALLSEME NIRNIAK SUCAHYA",
    "X-4",
    "10",
    "P",
    "12461",
    "peserta"
  ],
  [
    "12467",
    "ARGYA NAWAL SATYADHARMA",
    "X-4",
    "10",
    "L",
    "12467",
    "peserta"
  ],
  [
    "12468",
    "ARYA DAMAR WIRAWAN",
    "X-4",
    "10",
    "L",
    "12468",
    "peserta"
  ],
  [
    "12473",
    "ATHAYA SYHAILA DZAKWAN",
    "X-4",
    "10",
    "P",
    "12473",
    "peserta"
  ],
  [
    "12475",
    "ATHIKA NADIA RAHMA",
    "X-4",
    "10",
    "P",
    "12475",
    "peserta"
  ],
  [
    "12478",
    "AZKA FUADY AZIZ",
    "X-4",
    "10",
    "L",
    "12478",
    "peserta"
  ],
  [
    "12486",
    "CALVINO AZMI GANI PRATAMA",
    "X-4",
    "10",
    "L",
    "12486",
    "peserta"
  ],
  [
    "12488",
    "DAYANA BATRISYA AN-NISA FITRI",
    "X-4",
    "10",
    "P",
    "12488",
    "peserta"
  ],
  [
    "12498",
    "FARHAN RAFI IRFANSYAH",
    "X-4",
    "10",
    "L",
    "12498",
    "peserta"
  ],
  [
    "12510",
    "IBRAHIM DZAKY KAISAN",
    "X-4",
    "10",
    "L",
    "12510",
    "peserta"
  ],
  [
    "12518",
    "KEYSHA AZZAHRA",
    "X-4",
    "10",
    "P",
    "12518",
    "peserta"
  ],
  [
    "12533",
    "MOH. NIZAR AHZA AL AZZAM",
    "X-4",
    "10",
    "L",
    "12533",
    "peserta"
  ],
  [
    "12541",
    "MUHAMMAD FERRO AL AFGHANI",
    "X-4",
    "10",
    "L",
    "12541",
    "peserta"
  ],
  [
    "12543",
    "MUHAMMAD HABIBI AKBAR",
    "X-4",
    "10",
    "L",
    "12543",
    "peserta"
  ],
  [
    "12557",
    "NAFASHA PUTRI DHAVINA ALFARIZA",
    "X-4",
    "10",
    "P",
    "12557",
    "peserta"
  ],
  [
    "12559",
    "NAFLAH KHOIRUNNISA RAHMANDA",
    "X-4",
    "10",
    "P",
    "12559",
    "peserta"
  ],
  [
    "12562",
    "NASHWA ALIYA PUTRI",
    "X-4",
    "10",
    "P",
    "12562",
    "peserta"
  ],
  [
    "12564",
    "NAURA AZKA SILMI",
    "X-4",
    "10",
    "P",
    "12564",
    "peserta"
  ],
  [
    "12566",
    "NAYLA ZHAFIRAH PUTRI PAHALA",
    "X-4",
    "10",
    "P",
    "12566",
    "peserta"
  ],
  [
    "12570",
    "NUR FAIZAH HANIA",
    "X-4",
    "10",
    "P",
    "12570",
    "peserta"
  ],
  [
    "12571",
    "NURIL WAHYUNI AYU MAHASTI",
    "X-4",
    "10",
    "P",
    "12571",
    "peserta"
  ],
  [
    "12573",
    "ORVALA INDRAFATA CHALIK",
    "X-4",
    "10",
    "L",
    "12573",
    "peserta"
  ],
  [
    "12577",
    "RAIHAN ARIBUDI SULANDOKO",
    "X-4",
    "10",
    "L",
    "12577",
    "peserta"
  ],
  [
    "12578",
    "RAKA MUHAMMAD WIGUNA",
    "X-4",
    "10",
    "L",
    "12578",
    "peserta"
  ],
  [
    "12586",
    "SASHIMI ALENA ALBAQIS",
    "X-4",
    "10",
    "P",
    "12586",
    "peserta"
  ],
  [
    "12592",
    "SULTAN WIRA NURRAMADHAN",
    "X-4",
    "10",
    "L",
    "12592",
    "peserta"
  ],
  [
    "12597",
    "THORIQ BIL FURQON LESMANA",
    "X-4",
    "10",
    "L",
    "12597",
    "peserta"
  ],
  [
    "12613",
    "RIZKY FITRAH ANUGRAH",
    "X-4",
    "10",
    "L",
    "12613",
    "peserta"
  ],
  [
    "12614",
    "ABRAR RAYYAN",
    "X-4",
    "10",
    "L",
    "12614",
    "peserta"
  ],
  [
    "12451",
    "AGRA MALIKA ABRAR",
    "X-5",
    "10",
    "L",
    "12451",
    "peserta"
  ],
  [
    "12456",
    "AHMAD NAZHMI ILMI INSANI",
    "X-5",
    "10",
    "L",
    "12456",
    "peserta"
  ],
  [
    "12457",
    "AHMAD RAFIF ATHALLAH",
    "X-5",
    "10",
    "L",
    "12457",
    "peserta"
  ],
  [
    "12460",
    "ALDO ARIES HARIONO",
    "X-5",
    "10",
    "L",
    "12460",
    "peserta"
  ],
  [
    "12471",
    "ATHALLAH RAFFASYA ARDHIANTO",
    "X-5",
    "10",
    "L",
    "12471",
    "peserta"
  ],
  [
    "12474",
    "ATHAYA TABINA ZHUFAIROH",
    "X-5",
    "10",
    "P",
    "12474",
    "peserta"
  ],
  [
    "12481",
    "BALKIZH AULIA PUTRI",
    "X-5",
    "10",
    "P",
    "12481",
    "peserta"
  ],
  [
    "12496",
    "FANNI TISYA SAUNAH",
    "X-5",
    "10",
    "P",
    "12496",
    "peserta"
  ],
  [
    "12500",
    "FARIS RACHMAN AL FARUQ",
    "X-5",
    "10",
    "L",
    "12500",
    "peserta"
  ],
  [
    "12512",
    "IRZE MAULIDINA EL HAMRO",
    "X-5",
    "10",
    "P",
    "12512",
    "peserta"
  ],
  [
    "12513",
    "JESSY RUSDA TRISNA DINI",
    "X-5",
    "10",
    "P",
    "12513",
    "peserta"
  ],
  [
    "12517",
    "KEISYA ALIZA PUTRI",
    "X-5",
    "10",
    "P",
    "12517",
    "peserta"
  ],
  [
    "12520",
    "KHAYRA AYESHA FAADHILLAH",
    "X-5",
    "10",
    "P",
    "12520",
    "peserta"
  ],
  [
    "12522",
    "MUHAMMAD AS'AD IZZUL HAQ D",
    "X-5",
    "10",
    "L",
    "12522",
    "peserta"
  ],
  [
    "12523",
    "MOCH. DAVIN JERVIS GAUTAMA",
    "X-5",
    "10",
    "L",
    "12523",
    "peserta"
  ],
  [
    "12525",
    "M SYAHRUL ZIBRAN AL HAFIZ",
    "X-5",
    "10",
    "L",
    "12525",
    "peserta"
  ],
  [
    "12526",
    "MUHAMMAD ZYAN ZAFFIRE ASSYAKIR",
    "X-5",
    "10",
    "L",
    "12526",
    "peserta"
  ],
  [
    "12539",
    "MUHAMMAD FACHRI BUMI PUTRA",
    "X-5",
    "10",
    "L",
    "12539",
    "peserta"
  ],
  [
    "12545",
    "MUHAMMAD NAUFAL AR ROYHAN",
    "X-5",
    "10",
    "L",
    "12545",
    "peserta"
  ],
  [
    "12547",
    "MUHAMMAD NELSON MAHATHMA YUDHA",
    "X-5",
    "10",
    "L",
    "12547",
    "peserta"
  ],
  [
    "12548",
    "MUHAMMAD RADHO ARDIANSYAH",
    "X-5",
    "10",
    "L",
    "12548",
    "peserta"
  ],
  [
    "12554",
    "MUKHAMMAD DHAFIN AR RIZQI",
    "X-5",
    "10",
    "L",
    "12554",
    "peserta"
  ],
  [
    "12558",
    "NAFIZA CHIARA PUTRI",
    "X-5",
    "10",
    "P",
    "12558",
    "peserta"
  ],
  [
    "12572",
    "OCTAVIAN NUR HARTONO",
    "X-5",
    "10",
    "L",
    "12572",
    "peserta"
  ],
  [
    "12576",
    "RAHMANIA SHAFA AZZAHRA",
    "X-5",
    "10",
    "P",
    "12576",
    "peserta"
  ],
  [
    "12580",
    "REYHANA JASMINE",
    "X-5",
    "10",
    "P",
    "12580",
    "peserta"
  ],
  [
    "12583",
    "SAFIRA CANDRA FUADAH",
    "X-5",
    "10",
    "P",
    "12583",
    "peserta"
  ],
  [
    "12594",
    "SYEIKH",
    "X-5",
    "10",
    "L",
    "12594",
    "peserta"
  ],
  [
    "12596",
    "TANISHA VANIA GELSI",
    "X-5",
    "10",
    "P",
    "12596",
    "peserta"
  ],
  [
    "12603",
    "YASMIN QUDSI VINA",
    "X-5",
    "10",
    "P",
    "12603",
    "peserta"
  ],
  [
    "12612",
    "ZIYADATUN NA'IMAH",
    "X-5",
    "10",
    "P",
    "12612",
    "peserta"
  ],
  [
    "12537",
    "MUHAMMAD BAQIR ASH SHADR",
    "X-5",
    "10",
    "L",
    "12537",
    "peserta"
  ],
  [
    "12448",
    "ABY ZHAR BAHASUAN",
    "X-6",
    "10",
    "L",
    "12448",
    "peserta"
  ],
  [
    "12449",
    "ACHMAD ZAIN MUGEBEL",
    "X-6",
    "10",
    "L",
    "12449",
    "peserta"
  ],
  [
    "12482",
    "BARIQ FAJAR ABDULLAH",
    "X-6",
    "10",
    "L",
    "12482",
    "peserta"
  ],
  [
    "12483",
    "BAYU SUKMO BAGUS SATRIO",
    "X-6",
    "10",
    "L",
    "12483",
    "peserta"
  ],
  [
    "12485",
    "BINTANG EVANDER AMUK NUGROHO",
    "X-6",
    "10",
    "L",
    "12485",
    "peserta"
  ],
  [
    "12487",
    "DANIYAH MUHAMMAD FAUZI",
    "X-6",
    "10",
    "P",
    "12487",
    "peserta"
  ],
  [
    "12489",
    "DIMAS MUHAMMAD",
    "X-6",
    "10",
    "L",
    "12489",
    "peserta"
  ],
  [
    "12495",
    "FAIZ ARDI WINATA",
    "X-6",
    "10",
    "L",
    "12495",
    "peserta"
  ],
  [
    "12497",
    "FARA ZAIMAH AURELIA",
    "X-6",
    "10",
    "P",
    "12497",
    "peserta"
  ],
  [
    "12499",
    "FARHANDHAH HASNA NABILA",
    "X-6",
    "10",
    "P",
    "12499",
    "peserta"
  ],
  [
    "12501",
    "FATHIR AIDIL FITRAH",
    "X-6",
    "10",
    "L",
    "12501",
    "peserta"
  ],
  [
    "12503",
    "FERLI PUTRI ARNIS",
    "X-6",
    "10",
    "P",
    "12503",
    "peserta"
  ],
  [
    "12521",
    "KHOIRUNNISA AZAHRAA",
    "X-6",
    "10",
    "P",
    "12521",
    "peserta"
  ],
  [
    "12524",
    "MUHAMMAD KAYZA AL JABBAR",
    "X-6",
    "10",
    "L",
    "12524",
    "peserta"
  ],
  [
    "12529",
    "MAULANA AL HAIDAR FISABILILLAH",
    "X-6",
    "10",
    "L",
    "12529",
    "peserta"
  ],
  [
    "12530",
    "MAZAYA NISMAH MAULIDIYAH",
    "X-6",
    "10",
    "P",
    "12530",
    "peserta"
  ],
  [
    "12531",
    "MELVI ROSITA OCTAVIANI",
    "X-6",
    "10",
    "P",
    "12531",
    "peserta"
  ],
  [
    "12535",
    "MUHAMMAD ALVINO RAHADIAN KHALID",
    "X-6",
    "10",
    "L",
    "12535",
    "peserta"
  ],
  [
    "12540",
    "MUHAMMAD FAUZAN FADILLAH DIANDRA",
    "X-6",
    "10",
    "L",
    "12540",
    "peserta"
  ],
  [
    "12551",
    "MUHAMMAD SYAROFUL ANAM",
    "X-6",
    "10",
    "L",
    "12551",
    "peserta"
  ],
  [
    "12555",
    "NABILA AULIA NAHDA",
    "X-6",
    "10",
    "P",
    "12555",
    "peserta"
  ],
  [
    "12567",
    "NISA NAFAZATUL JANNAH",
    "X-6",
    "10",
    "P",
    "12567",
    "peserta"
  ],
  [
    "12568",
    "NOVALITA TRIA KHAIRUNNISA' PERMATASARI",
    "X-6",
    "10",
    "P",
    "12568",
    "peserta"
  ],
  [
    "12575",
    "RAFA OKTAVINO PANGGABEAN",
    "X-6",
    "10",
    "L",
    "12575",
    "peserta"
  ],
  [
    "12581",
    "RIFKY RIZQU OKTANIAN",
    "X-6",
    "10",
    "L",
    "12581",
    "peserta"
  ],
  [
    "12585",
    "SALMA FAHMIDA",
    "X-6",
    "10",
    "P",
    "12585",
    "peserta"
  ],
  [
    "12593",
    "SYAIFUDIN IQBAL",
    "X-6",
    "10",
    "L",
    "12593",
    "peserta"
  ],
  [
    "12595",
    "TALITA DZAHABIYYAH SYAUKANI",
    "X-6",
    "10",
    "P",
    "12595",
    "peserta"
  ],
  [
    "12607",
    "ZAHIRA FARIDIA FIRDAUSY",
    "X-6",
    "10",
    "P",
    "12607",
    "peserta"
  ],
  [
    "12608",
    "ZAHRA GRESIA",
    "X-6",
    "10",
    "P",
    "12608",
    "peserta"
  ],
  [
    "12506",
    "HAFIZ MAHADEVANO RUDYANSYAH",
    "X-6",
    "10",
    "L",
    "12506",
    "peserta"
  ],
  [
    "12252",
    "AIMA NUR ALIFTA TUWATUN NISA",
    "XI Saintek 1",
    "11",
    "P",
    "12252",
    "peserta"
  ],
  [
    "12257",
    "ALEESHA MEDINA SUTIONO",
    "XI Saintek 1",
    "11",
    "P",
    "12257",
    "peserta"
  ],
  [
    "12262",
    "AMANDA FARAHDHIA",
    "XI Saintek 1",
    "11",
    "P",
    "12262",
    "peserta"
  ],
  [
    "12275",
    "ATHAYA MIHLAYEL AXELA NAYAKA",
    "XI Saintek 1",
    "11",
    "L",
    "12275",
    "peserta"
  ],
  [
    "12280",
    "BERYL ALVI RAFANSYAH",
    "XI Saintek 1",
    "11",
    "L",
    "12280",
    "peserta"
  ],
  [
    "12281",
    "BIRRU KAUTSAR ALFATH",
    "XI Saintek 1",
    "11",
    "L",
    "12281",
    "peserta"
  ],
  [
    "12290",
    "EKA RIZKY APRILIANI",
    "XI Saintek 1",
    "11",
    "P",
    "12290",
    "peserta"
  ],
  [
    "12292",
    "ERIKA PUTRI MAGHFIROH",
    "XI Saintek 1",
    "11",
    "P",
    "12292",
    "peserta"
  ],
  [
    "12298",
    "FARAFISYAH BINTA ALRIANTI",
    "XI Saintek 1",
    "11",
    "P",
    "12298",
    "peserta"
  ],
  [
    "12301",
    "FARROS ZAGHLUL WALIYYUDIN",
    "XI Saintek 1",
    "11",
    "L",
    "12301",
    "peserta"
  ],
  [
    "12303",
    "FERGIE ACHMAD PRASETYO",
    "XI Saintek 1",
    "11",
    "L",
    "12303",
    "peserta"
  ],
  [
    "12304",
    "FIRDA FIRMANUSSYIFA'",
    "XI Saintek 1",
    "11",
    "P",
    "12304",
    "peserta"
  ],
  [
    "12306",
    "GARNETA AYUDIA CAHYANI",
    "XI Saintek 1",
    "11",
    "P",
    "12306",
    "peserta"
  ],
  [
    "12310",
    "HAFIZ ALVIANO FIRST RADITYANATA",
    "XI Saintek 1",
    "11",
    "L",
    "12310",
    "peserta"
  ],
  [
    "12339",
    "M. RIZQY DHIYA'UL HAQ",
    "XI Saintek 1",
    "11",
    "L",
    "12339",
    "peserta"
  ],
  [
    "12344",
    "MAULIDYA OZORA PUTRI",
    "XI Saintek 1",
    "11",
    "P",
    "12344",
    "peserta"
  ],
  [
    "12350",
    "MOH RAIHAN SAMI FIRDAUS",
    "XI Saintek 1",
    "11",
    "L",
    "12350",
    "peserta"
  ],
  [
    "12355",
    "MUHAMMAD ALWAN HASRIANSYAH",
    "XI Saintek 1",
    "11",
    "L",
    "12355",
    "peserta"
  ],
  [
    "12359",
    "MUHAMMAD FADHIL EL SYARIF",
    "XI Saintek 1",
    "11",
    "L",
    "12359",
    "peserta"
  ],
  [
    "12366",
    "MUHAMMAD IBAD MUTAWWALIDIN",
    "XI Saintek 1",
    "11",
    "L",
    "12366",
    "peserta"
  ],
  [
    "12367",
    "MUHAMMAD IKMAL NIZZAMULLAH",
    "XI Saintek 1",
    "11",
    "L",
    "12367",
    "peserta"
  ],
  [
    "12372",
    "MUHAMMAD SHAFWAN MAULANA ZHAFRAN",
    "XI Saintek 1",
    "11",
    "L",
    "12372",
    "peserta"
  ],
  [
    "12373",
    "MUHAMMAD ZAFRAN MARDIANSYAH",
    "XI Saintek 1",
    "11",
    "L",
    "12373",
    "peserta"
  ],
  [
    "12374",
    "NAAILAH SHAFAA RAMADHANI",
    "XI Saintek 1",
    "11",
    "P",
    "12374",
    "peserta"
  ],
  [
    "12380",
    "NAUFAL ALBIF AL FAROBI AGUS",
    "XI Saintek 1",
    "11",
    "L",
    "12380",
    "peserta"
  ],
  [
    "12388",
    "NURAINI AN NISA PUTRI",
    "XI Saintek 1",
    "11",
    "P",
    "12388",
    "peserta"
  ],
  [
    "12389",
    "NURUL ANDHINI",
    "XI Saintek 1",
    "11",
    "P",
    "12389",
    "peserta"
  ],
  [
    "12400",
    "RAIHAN IKHSAN HIDAYAT",
    "XI Saintek 1",
    "11",
    "L",
    "12400",
    "peserta"
  ],
  [
    "12413",
    "SALSABILA FIRDAUS",
    "XI Saintek 1",
    "11",
    "P",
    "12413",
    "peserta"
  ],
  [
    "12419",
    "SHIDQI RAKA SYAHPUTRA",
    "XI Saintek 1",
    "11",
    "L",
    "12419",
    "peserta"
  ],
  [
    "12422",
    "SULTAN AQIEL MUHAMMAD",
    "XI Saintek 1",
    "11",
    "L",
    "12422",
    "peserta"
  ],
  [
    "12423",
    "SULTAN HAIDAR MUTAWAKKIL",
    "XI Saintek 1",
    "11",
    "L",
    "12423",
    "peserta"
  ],
  [
    "12429",
    "UBAIDILLAH AKMAL FATTAN",
    "XI Saintek 1",
    "11",
    "L",
    "12429",
    "peserta"
  ],
  [
    "12441",
    "MUHAMMAD AFDHAL RABBANI PRAYITNO",
    "XI Saintek 1",
    "11",
    "L",
    "12441",
    "peserta"
  ],
  [
    "12248",
    "ADIS RAKHA HARDIYANTA",
    "XI Saintek 2",
    "11",
    "L",
    "12248",
    "peserta"
  ],
  [
    "12254",
    "AISYAH FAUZIYAH ARDZI",
    "XI Saintek 2",
    "11",
    "P",
    "12254",
    "peserta"
  ],
  [
    "12256",
    "AL TAUFIQ SYARIFUDDIN",
    "XI Saintek 2",
    "11",
    "L",
    "12256",
    "peserta"
  ],
  [
    "12272",
    "ARSYAD FITROH MUHAMMAD PURWONO",
    "XI Saintek 2",
    "11",
    "L",
    "12272",
    "peserta"
  ],
  [
    "12273",
    "ARYA BIMA WIJAYA",
    "XI Saintek 2",
    "11",
    "L",
    "12273",
    "peserta"
  ],
  [
    "12278",
    "BAIHAQQY DIZHAN AZKA KHAIRI",
    "XI Saintek 2",
    "11",
    "L",
    "12278",
    "peserta"
  ],
  [
    "12284",
    "DAI BRILLIANT RIZKI IRSANDY",
    "XI Saintek 2",
    "11",
    "L",
    "12284",
    "peserta"
  ],
  [
    "12289",
    "EDITA LUNA RAHMADHANI",
    "XI Saintek 2",
    "11",
    "P",
    "12289",
    "peserta"
  ],
  [
    "12302",
    "FASYA NAUBIYAN CAHYAWAN",
    "XI Saintek 2",
    "11",
    "L",
    "12302",
    "peserta"
  ],
  [
    "12308",
    "GIDEON BAGAS BAWENGAN",
    "XI Saintek 2",
    "11",
    "L",
    "12308",
    "peserta"
  ],
  [
    "12312",
    "HAIDAR ZADA ATHAILLAH",
    "XI Saintek 2",
    "11",
    "L",
    "12312",
    "peserta"
  ],
  [
    "12325",
    "KHANSA DISTIAN ARYAPUTRA",
    "XI Saintek 2",
    "11",
    "L",
    "12325",
    "peserta"
  ],
  [
    "12341",
    "MOCHAMMAD SABIQ AL NAUFAL",
    "XI Saintek 2",
    "11",
    "L",
    "12341",
    "peserta"
  ],
  [
    "12354",
    "MUHAMMAD AIDAN AL BANIIN",
    "XI Saintek 2",
    "11",
    "L",
    "12354",
    "peserta"
  ],
  [
    "12360",
    "MUHAMMAD FAKHRY AKBAR",
    "XI Saintek 2",
    "11",
    "L",
    "12360",
    "peserta"
  ],
  [
    "12371",
    "MUHAMMAD RIZKY FARDAN",
    "XI Saintek 2",
    "11",
    "L",
    "12371",
    "peserta"
  ],
  [
    "12378",
    "NARENDHRA ARYASATYA ATHARAMA",
    "XI Saintek 2",
    "11",
    "L",
    "12378",
    "peserta"
  ],
  [
    "12385",
    "NIKITA ALFINA SYAHRIANI",
    "XI Saintek 2",
    "11",
    "P",
    "12385",
    "peserta"
  ],
  [
    "12387",
    "NUR IZZATI HAYATUS SOPHIA",
    "XI Saintek 2",
    "11",
    "P",
    "12387",
    "peserta"
  ],
  [
    "12396",
    "RADEN AHMAD BERYL SAFARAZ",
    "XI Saintek 2",
    "11",
    "L",
    "12396",
    "peserta"
  ],
  [
    "12398",
    "RAFA FATHAN AL GIFFARI",
    "XI Saintek 2",
    "11",
    "L",
    "12398",
    "peserta"
  ],
  [
    "12414",
    "SALSABILA SYAPUTRI",
    "XI Saintek 2",
    "11",
    "P",
    "12414",
    "peserta"
  ],
  [
    "12424",
    "SULTHAN KHINAN HANAFI",
    "XI Saintek 2",
    "11",
    "L",
    "12424",
    "peserta"
  ],
  [
    "12425",
    "SURYA SATRIA PRADANA AL RIANTO",
    "XI Saintek 2",
    "11",
    "L",
    "12425",
    "peserta"
  ],
  [
    "12430",
    "VALKYRIE AGNI HER SAMIRANA PERTIWI",
    "XI Saintek 2",
    "11",
    "P",
    "12430",
    "peserta"
  ],
  [
    "12431",
    "WIRADITYA WIJAYA",
    "XI Saintek 2",
    "11",
    "L",
    "12431",
    "peserta"
  ],
  [
    "12433",
    "YASMINE AZZAHRA DISTIAN",
    "XI Saintek 2",
    "11",
    "P",
    "12433",
    "peserta"
  ],
  [
    "12442",
    "JIBRIL DANESWARA JUNAEDI",
    "XI Saintek 2",
    "11",
    "L",
    "12442",
    "peserta"
  ],
  [
    "12249",
    "AFIQ RAYYAN MA'ARIF",
    "XI Saintek 3",
    "11",
    "L",
    "12249",
    "peserta"
  ],
  [
    "12253",
    "AISYAH AQILA LATIF",
    "XI Saintek 3",
    "11",
    "P",
    "12253",
    "peserta"
  ],
  [
    "12255",
    "AKHDANY KENZIE KAYANA",
    "XI Saintek 3",
    "11",
    "L",
    "12255",
    "peserta"
  ],
  [
    "12258",
    "ALIFATUROHMAN HADI KURNIAWAN",
    "XI Saintek 3",
    "11",
    "L",
    "12258",
    "peserta"
  ],
  [
    "12264",
    "ANDANA ARSYAD RASENDRIYAH",
    "XI Saintek 3",
    "11",
    "L",
    "12264",
    "peserta"
  ],
  [
    "12265",
    "ANDRIAN NAUFALI ROCHMAN",
    "XI Saintek 3",
    "11",
    "L",
    "12265",
    "peserta"
  ],
  [
    "12266",
    "ANINDIA NUR FATIHAH",
    "XI Saintek 3",
    "11",
    "P",
    "12266",
    "peserta"
  ],
  [
    "12270",
    "AQILA HUBBATUL LATIFAH",
    "XI Saintek 3",
    "11",
    "P",
    "12270",
    "peserta"
  ],
  [
    "12277",
    "AZFAR CONSTANTINE ALGHIFARI",
    "XI Saintek 3",
    "11",
    "L",
    "12277",
    "peserta"
  ],
  [
    "12287",
    "DIKA ADINATA PUTRA KASIHA",
    "XI Saintek 3",
    "11",
    "L",
    "12287",
    "peserta"
  ],
  [
    "12288",
    "DIMAS RADITHYA PRADANA",
    "XI Saintek 3",
    "11",
    "L",
    "12288",
    "peserta"
  ],
  [
    "12315",
    "HANOONA DWIKE MARETA",
    "XI Saintek 3",
    "11",
    "P",
    "12315",
    "peserta"
  ],
  [
    "12321",
    "IZZUDDIN AL FATIH",
    "XI Saintek 3",
    "11",
    "L",
    "12321",
    "peserta"
  ],
  [
    "12326",
    "KHANSA ZAHIRAH NAJLA",
    "XI Saintek 3",
    "11",
    "P",
    "12326",
    "peserta"
  ],
  [
    "12334",
    "MUHAMMAD GALVIN RIZA ALAMSYAH",
    "XI Saintek 3",
    "11",
    "L",
    "12334",
    "peserta"
  ],
  [
    "12335",
    "MUHAMMAD GAVIN ISLAMAY NARARYA",
    "XI Saintek 3",
    "11",
    "L",
    "12335",
    "peserta"
  ],
  [
    "12338",
    "M. RAKHA AR RAYYAN PUTRA ARIANTO",
    "XI Saintek 3",
    "11",
    "L",
    "12338",
    "peserta"
  ],
  [
    "12370",
    "MOCHAMMAD RANGGA DWI GUNAWAN",
    "XI Saintek 3",
    "11",
    "L",
    "12370",
    "peserta"
  ],
  [
    "12381",
    "NAURA JIHAN FARAH RAMADHANI",
    "XI Saintek 3",
    "11",
    "P",
    "12381",
    "peserta"
  ],
  [
    "12382",
    "NAURA ZAMI SAFA FITRIYANTARA",
    "XI Saintek 3",
    "11",
    "P",
    "12382",
    "peserta"
  ],
  [
    "12383",
    "NAZLILLAH AISYAH JOHAR",
    "XI Saintek 3",
    "11",
    "P",
    "12383",
    "peserta"
  ],
  [
    "12384",
    "NEHAN ATHAYANTA NURYANTO",
    "XI Saintek 3",
    "11",
    "L",
    "12384",
    "peserta"
  ],
  [
    "12390",
    "NURUL FALAH AZZAKIYAH ARDIANSYAH",
    "XI Saintek 3",
    "11",
    "P",
    "12390",
    "peserta"
  ],
  [
    "12399",
    "RAFIKA NOVIYA RHODIYAHTUL EFFENDI",
    "XI Saintek 3",
    "11",
    "P",
    "12399",
    "peserta"
  ],
  [
    "12401",
    "RANIAH KHAIRUNISA",
    "XI Saintek 3",
    "11",
    "P",
    "12401",
    "peserta"
  ],
  [
    "12406",
    "REZA AHMAD AL HAKIM",
    "XI Saintek 3",
    "11",
    "L",
    "12406",
    "peserta"
  ],
  [
    "12407",
    "RICKO GAHRAL ADISYACH",
    "XI Saintek 3",
    "11",
    "L",
    "12407",
    "peserta"
  ],
  [
    "12410",
    "RIZQI FANI ANUGRAH",
    "XI Saintek 3",
    "11",
    "L",
    "12410",
    "peserta"
  ],
  [
    "12435",
    "ZAHRAN SHABIR ATHALLAH ALWAN",
    "XI Saintek 3",
    "11",
    "L",
    "12435",
    "peserta"
  ],
  [
    "12245",
    "ABYANUL HAKIM",
    "XI Saintek 4",
    "11",
    "L",
    "12245",
    "peserta"
  ],
  [
    "12250",
    "AHMAD HAIKAL FALAKH",
    "XI Saintek 4",
    "11",
    "L",
    "12250",
    "peserta"
  ],
  [
    "12261",
    "ALYA AYUDYA MAHARANI",
    "XI Saintek 4",
    "11",
    "P",
    "12261",
    "peserta"
  ],
  [
    "12263",
    "AMIRA ZAHWAH KAYYASAH",
    "XI Saintek 4",
    "11",
    "P",
    "12263",
    "peserta"
  ],
  [
    "12279",
    "BELA ANGIE PARAHITA",
    "XI Saintek 4",
    "11",
    "P",
    "12279",
    "peserta"
  ],
  [
    "12293",
    "FA'IZAH AMIRAH",
    "XI Saintek 4",
    "11",
    "P",
    "12293",
    "peserta"
  ],
  [
    "12296",
    "FAJAR ARYANSYAH PUTRA",
    "XI Saintek 4",
    "11",
    "L",
    "12296",
    "peserta"
  ],
  [
    "12297",
    "FALIZAH RAHMAN",
    "XI Saintek 4",
    "11",
    "P",
    "12297",
    "peserta"
  ],
  [
    "12305",
    "FRAYA PARAMITHA WINDHARTA",
    "XI Saintek 4",
    "11",
    "P",
    "12305",
    "peserta"
  ],
  [
    "12307",
    "GAVIN WILIAN BASKARA",
    "XI Saintek 4",
    "11",
    "L",
    "12307",
    "peserta"
  ],
  [
    "12314",
    "HANDARU ZAKI CAHYA GUMELAR",
    "XI Saintek 4",
    "11",
    "L",
    "12314",
    "peserta"
  ],
  [
    "12316",
    "HANUM AISYAWA YULDIONO",
    "XI Saintek 4",
    "11",
    "P",
    "12316",
    "peserta"
  ],
  [
    "12318",
    "IBRAHIM RIDHO HASAN",
    "XI Saintek 4",
    "11",
    "L",
    "12318",
    "peserta"
  ],
  [
    "12320",
    "IVAN LOUISE HARIS WICAKSONO",
    "XI Saintek 4",
    "11",
    "L",
    "12320",
    "peserta"
  ],
  [
    "12349",
    "MIRZA AUFA MURTAZA",
    "XI Saintek 4",
    "11",
    "L",
    "12349",
    "peserta"
  ],
  [
    "12362",
    "MUHAMMAD FIRASH ARDHIA AQSHO TYSA LUBIS",
    "XI Saintek 4",
    "11",
    "L",
    "12362",
    "peserta"
  ],
  [
    "12363",
    "MUHAMMAD GIBRAN FATIH",
    "XI Saintek 4",
    "11",
    "L",
    "12363",
    "peserta"
  ],
  [
    "12364",
    "MUHAMMAD HASBI AKBAR SITEPU",
    "XI Saintek 4",
    "11",
    "L",
    "12364",
    "peserta"
  ],
  [
    "12369",
    "MUHAMMAD PRAYOGA SEJATI",
    "XI Saintek 4",
    "11",
    "L",
    "12369",
    "peserta"
  ],
  [
    "12379",
    "NATANARARYA LANGIT SATYAKI",
    "XI Saintek 4",
    "11",
    "L",
    "12379",
    "peserta"
  ],
  [
    "12394",
    "PUTRI VIVIAN NUR RAHMA",
    "XI Saintek 4",
    "11",
    "P",
    "12394",
    "peserta"
  ],
  [
    "12397",
    "RAFA BENZEMA PUTRA PRADANA",
    "XI Saintek 4",
    "11",
    "L",
    "12397",
    "peserta"
  ],
  [
    "12402",
    "RAYHAN MAULANA AL ASY'ARI",
    "XI Saintek 4",
    "11",
    "L",
    "12402",
    "peserta"
  ],
  [
    "12405",
    "REYVAN RAMDHAN MAULANA",
    "XI Saintek 4",
    "11",
    "L",
    "12405",
    "peserta"
  ],
  [
    "12427",
    "TALITHA NEYSA SYAKIRA ATMOJO",
    "XI Saintek 4",
    "11",
    "P",
    "12427",
    "peserta"
  ],
  [
    "12428",
    "TANAYA KANIA RACHMANI",
    "XI Saintek 4",
    "11",
    "P",
    "12428",
    "peserta"
  ],
  [
    "12432",
    "YAFI ASRA HABIBILLAH",
    "XI Saintek 4",
    "11",
    "L",
    "12432",
    "peserta"
  ],
  [
    "12434",
    "YUSRA MUMTAZ RAMADHAN",
    "XI Saintek 4",
    "11",
    "L",
    "12434",
    "peserta"
  ],
  [
    "12436",
    "ZANA RAHMADANI BARKAH LYLA",
    "XI Saintek 4",
    "11",
    "P",
    "12436",
    "peserta"
  ],
  [
    "12444",
    "A. NAUFAL ATALLAH FIKRI",
    "XI Saintek 4",
    "11",
    "L",
    "12444",
    "peserta"
  ],
  [
    "12247",
    "ADINDA LUTFI OXCHARIL",
    "XI Soshum 1",
    "11",
    "P",
    "12247",
    "peserta"
  ],
  [
    "12251",
    "AHMAD WILDANUS SHIHAB",
    "XI Soshum 1",
    "11",
    "L",
    "12251",
    "peserta"
  ],
  [
    "12269",
    "ANNISA FITIYA SEKARARUM",
    "XI Soshum 1",
    "11",
    "P",
    "12269",
    "peserta"
  ],
  [
    "12282",
    "CANTIKA DWIYONO AZALYA SAFIRA",
    "XI Soshum 1",
    "11",
    "P",
    "12282",
    "peserta"
  ],
  [
    "12283",
    "CARISSA AURELIA PUTRI",
    "XI Soshum 1",
    "11",
    "P",
    "12283",
    "peserta"
  ],
  [
    "12286",
    "DELVIANO FIDANZA DA LOPES",
    "XI Soshum 1",
    "11",
    "L",
    "12286",
    "peserta"
  ],
  [
    "12294",
    "FAIRUZ JASMINE KHOIRUNNISA'",
    "XI Soshum 1",
    "11",
    "P",
    "12294",
    "peserta"
  ],
  [
    "12295",
    "FAIZA AMIRA SUROSO",
    "XI Soshum 1",
    "11",
    "P",
    "12295",
    "peserta"
  ],
  [
    "12300",
    "FARDHANA KEYANO FIFALDY",
    "XI Soshum 1",
    "11",
    "L",
    "12300",
    "peserta"
  ],
  [
    "12309",
    "GREENALDO SYIHABUDDIN GHIFARY",
    "XI Soshum 1",
    "11",
    "L",
    "12309",
    "peserta"
  ],
  [
    "12313",
    "HANA KAMILATUN NISA`",
    "XI Soshum 1",
    "11",
    "P",
    "12313",
    "peserta"
  ],
  [
    "12317",
    "HANUM PUTRI RAMADHANI",
    "XI Soshum 1",
    "11",
    "P",
    "12317",
    "peserta"
  ],
  [
    "12322",
    "KANAYA SYALWA ANANTI",
    "XI Soshum 1",
    "11",
    "P",
    "12322",
    "peserta"
  ],
  [
    "12328",
    "KHUMAIRA ZUKHRUFI MUIZMA",
    "XI Soshum 1",
    "11",
    "P",
    "12328",
    "peserta"
  ],
  [
    "12330",
    "LUNA CANDRA SYAFAATASALIM",
    "XI Soshum 1",
    "11",
    "P",
    "12330",
    "peserta"
  ],
  [
    "12333",
    "M. DAFA PRAMUDITIYA",
    "XI Soshum 1",
    "11",
    "L",
    "12333",
    "peserta"
  ],
  [
    "12336",
    "MUHAMMAD JANKY DAUSAT",
    "XI Soshum 1",
    "11",
    "L",
    "12336",
    "peserta"
  ],
  [
    "12340",
    "MUHAMMAD SHADDAM ATTALLAH",
    "XI Soshum 1",
    "11",
    "L",
    "12340",
    "peserta"
  ],
  [
    "12351",
    "MOHAMMAD SEPTIAN NURIMANSYAH",
    "XI Soshum 1",
    "11",
    "L",
    "12351",
    "peserta"
  ],
  [
    "12353",
    "MUHAMMAD AGHFA FIRDAUS",
    "XI Soshum 1",
    "11",
    "L",
    "12353",
    "peserta"
  ],
  [
    "12356",
    "MUHAMMAD DAFFA KAMALUDDIN RAMDHANI",
    "XI Soshum 1",
    "11",
    "L",
    "12356",
    "peserta"
  ],
  [
    "12357",
    "MUHAMMAD DIAS CLEARESTA",
    "XI Soshum 1",
    "11",
    "L",
    "12357",
    "peserta"
  ],
  [
    "12365",
    "MUHAMMAD HASBI SETIAWAN",
    "XI Soshum 1",
    "11",
    "L",
    "12365",
    "peserta"
  ],
  [
    "12368",
    "MUHAMMAD IRSYAD IFTIKHARUDDIN",
    "XI Soshum 1",
    "11",
    "L",
    "12368",
    "peserta"
  ],
  [
    "12375",
    "NADHIFA NUR ATHIRAH",
    "XI Soshum 1",
    "11",
    "P",
    "12375",
    "peserta"
  ],
  [
    "12376",
    "NADHIRA NUR ALIFAH",
    "XI Soshum 1",
    "11",
    "P",
    "12376",
    "peserta"
  ],
  [
    "12393",
    "PUTRI JANNAH PUSPITASARI",
    "XI Soshum 1",
    "11",
    "P",
    "12393",
    "peserta"
  ],
  [
    "12408",
    "RIZKA MUTHIA RAIHAN",
    "XI Soshum 1",
    "11",
    "P",
    "12408",
    "peserta"
  ],
  [
    "12412",
    "SAFIRA FITHROTUS TSANIYAH",
    "XI Soshum 1",
    "11",
    "P",
    "12412",
    "peserta"
  ],
  [
    "12415",
    "SANIE ANINDYA ARTANTI",
    "XI Soshum 1",
    "11",
    "P",
    "12415",
    "peserta"
  ],
  [
    "12416",
    "SAYYIDAH AN NADHIFAH",
    "XI Soshum 1",
    "11",
    "P",
    "12416",
    "peserta"
  ],
  [
    "12418",
    "SHEILA MELLYSA PUTRI",
    "XI Soshum 1",
    "11",
    "P",
    "12418",
    "peserta"
  ],
  [
    "12426",
    "SYAFIRA AZZAHRA",
    "XI Soshum 1",
    "11",
    "P",
    "12426",
    "peserta"
  ],
  [
    "12445",
    "KEYLA NUR FATIMATUZZAHRA",
    "XI Soshum 1",
    "11",
    "P",
    "12445",
    "peserta"
  ],
  [
    "12446",
    "HAILAH AFIFAH HAKIM",
    "XI Soshum 1",
    "11",
    "P",
    "12446",
    "peserta"
  ],
  [
    "12447",
    "HILMIYANDI",
    "XI Soshum 1",
    "11",
    "L",
    "12447",
    "peserta"
  ],
  [
    "12243",
    "ABIDAH ULYA",
    "XI Soshum 2",
    "11",
    "P",
    "12243",
    "peserta"
  ],
  [
    "12244",
    "ABRIELIA FI SABILILLAH ARDHINAR",
    "XI Soshum 2",
    "11",
    "P",
    "12244",
    "peserta"
  ],
  [
    "12246",
    "ADEEL DANISH PUTRA",
    "XI Soshum 2",
    "11",
    "L",
    "12246",
    "peserta"
  ],
  [
    "12259",
    "ALMIRA NAQIYAH FIRZANAH",
    "XI Soshum 2",
    "11",
    "P",
    "12259",
    "peserta"
  ],
  [
    "12260",
    "ALUNA GHASSANI ARMAGITA",
    "XI Soshum 2",
    "11",
    "P",
    "12260",
    "peserta"
  ],
  [
    "12267",
    "ANISA DWI ANDINI",
    "XI Soshum 2",
    "11",
    "P",
    "12267",
    "peserta"
  ],
  [
    "12268",
    "ANJANI QUINN AZ ZAHRA",
    "XI Soshum 2",
    "11",
    "P",
    "12268",
    "peserta"
  ],
  [
    "12271",
    "ARDHIAN RYADANA PRAMADITHA",
    "XI Soshum 2",
    "11",
    "L",
    "12271",
    "peserta"
  ],
  [
    "12276",
    "AVIZA AQILAH PUTRI MAKSUN",
    "XI Soshum 2",
    "11",
    "P",
    "12276",
    "peserta"
  ],
  [
    "12285",
    "DAVINA RAHMITA",
    "XI Soshum 2",
    "11",
    "P",
    "12285",
    "peserta"
  ],
  [
    "12291",
    "ELVIRA AURELYN PUTRI DYAN RAMADHANI",
    "XI Soshum 2",
    "11",
    "P",
    "12291",
    "peserta"
  ],
  [
    "12299",
    "FARAND GALE NUGRAHA",
    "XI Soshum 2",
    "11",
    "L",
    "12299",
    "peserta"
  ],
  [
    "12319",
    "IMTINAN HAFID BAHASUAN",
    "XI Soshum 2",
    "11",
    "P",
    "12319",
    "peserta"
  ],
  [
    "12324",
    "KEMAS ASYROF UBAIDILLAH",
    "XI Soshum 2",
    "11",
    "L",
    "12324",
    "peserta"
  ],
  [
    "12327",
    "KHAZALIQA AL ARIF",
    "XI Soshum 2",
    "11",
    "P",
    "12327",
    "peserta"
  ],
  [
    "12331",
    "MUHAMMAD AKBAR FADHILLAH SAPUTRA",
    "XI Soshum 2",
    "11",
    "L",
    "12331",
    "peserta"
  ],
  [
    "12332",
    "MUHAMMAD BINTANG SULTHONI",
    "XI Soshum 2",
    "11",
    "L",
    "12332",
    "peserta"
  ],
  [
    "12337",
    "M.NABIL FADLULLAH ARIANSYAH",
    "XI Soshum 2",
    "11",
    "L",
    "12337",
    "peserta"
  ],
  [
    "12342",
    "MAIMANABILA APRILIA",
    "XI Soshum 2",
    "11",
    "P",
    "12342",
    "peserta"
  ],
  [
    "12345",
    "MAYDENA VALERIE ALINE DJUNAIDI",
    "XI Soshum 2",
    "11",
    "P",
    "12345",
    "peserta"
  ],
  [
    "12346",
    "MICHELLE PUTRI CHANDRA",
    "XI Soshum 2",
    "11",
    "P",
    "12346",
    "peserta"
  ],
  [
    "12347",
    "MIFTAH FERROS MURTADHO ISMAIL",
    "XI Soshum 2",
    "11",
    "L",
    "12347",
    "peserta"
  ],
  [
    "12348",
    "MIKAEL AR RIDHO",
    "XI Soshum 2",
    "11",
    "L",
    "12348",
    "peserta"
  ],
  [
    "12358",
    "MUHAMMAD DIMAS WASI'",
    "XI Soshum 2",
    "11",
    "L",
    "12358",
    "peserta"
  ],
  [
    "12361",
    "MUHAMMAD FANANI EL-HIKAM",
    "XI Soshum 2",
    "11",
    "L",
    "12361",
    "peserta"
  ],
  [
    "12377",
    "NAIRA SHETRA AL FAWWAZ",
    "XI Soshum 2",
    "11",
    "P",
    "12377",
    "peserta"
  ],
  [
    "12392",
    "PRINCE MUHAMMAD KHAYRU",
    "XI Soshum 2",
    "11",
    "L",
    "12392",
    "peserta"
  ],
  [
    "12395",
    "QUINSHA NAURA PUTRI",
    "XI Soshum 2",
    "11",
    "P",
    "12395",
    "peserta"
  ],
  [
    "12404",
    "REYHAN ALVARO RIZKY PERMANA",
    "XI Soshum 2",
    "11",
    "L",
    "12404",
    "peserta"
  ],
  [
    "12409",
    "RIZKY ARDIANSYAH HARIONO",
    "XI Soshum 2",
    "11",
    "L",
    "12409",
    "peserta"
  ],
  [
    "12411",
    "SAFA NABILA IQLIMA",
    "XI Soshum 2",
    "11",
    "P",
    "12411",
    "peserta"
  ],
  [
    "12417",
    "SHANIA CONCETTA PICAULY",
    "XI Soshum 2",
    "11",
    "P",
    "12417",
    "peserta"
  ],
  [
    "12420",
    "SOFIA AMALIA SAFITRI",
    "XI Soshum 2",
    "11",
    "P",
    "12420",
    "peserta"
  ],
  [
    "12437",
    "ZIYAD ABDUL RASYID",
    "XI Soshum 2",
    "11",
    "L",
    "12437",
    "peserta"
  ]
];
}