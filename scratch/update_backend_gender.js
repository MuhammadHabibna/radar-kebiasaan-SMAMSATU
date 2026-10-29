const fs = require('fs');

// 1. Read students
const students = JSON.parse(fs.readFileSync('scratch/students_full.json', 'utf8'));

// 2. Prepare array for Code.gs and TSV
// Format: ['uid', 'nama', 'kelas', 'tingkat', 'jk', 'password', 'role']
const allUsers = [
  ['admin', 'Administrator 7 KAIH', 'Guru BK / Tim Panitia', 'Umum', 'L', 'admin2026', 'admin']
];

for (const s of students) {
  allUsers.push([
    s.uid,
    s.nama,
    s.kelas,
    String(s.tingkat),
    s.jk,
    s.uid, // password = uid
    'peserta'
  ]);
}

// 3. Write backend/users_data.tsv
const tsvHeader = ['uid', 'nama', 'kelas', 'tingkat', 'jk', 'password', 'role'].join('\t');
const tsvRows = allUsers.map(u => u.join('\t'));
const tsvContent = [tsvHeader, ...tsvRows].join('\n');
fs.writeFileSync('backend/users_data.tsv', tsvContent, 'utf8');
console.log('backend/users_data.tsv updated with jk column!');

// 4. Update backend/Code.gs
let code = fs.readFileSync('backend/Code.gs', 'utf8');

// Replace handleLogin
const oldLoginMarker = 'function handleLogin(uid, password) {';
const oldLoginEndMarker = '/**\n * Helper memformat tanggal sel Google Sheets menjadi yyyy-MM-dd';

const newLoginFunc = `function handleLogin(uid, password) {
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

`;

// Replace handleGetPesertaDashboard user extraction
const oldDashMarker = '  for (let i = 1; i < userData.length; i++) {\n    if (String(userData[i][0]).trim().toLowerCase() === cleanUid) {\n      user = {\n        uid: userData[i][0],\n        nama: userData[i][1],\n        kelas: userData[i][2],\n        tingkat: userData[i][3],\n        role: userData[i][5]\n      };\n      break;\n    }\n  }';

const newDashCode = `  const uHeaders = userData[0].map(function(h) { return String(h || '').trim().toLowerCase(); });
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
  }`;

// Replace handleSubmit gender check
const oldSubmitBerhalanganMarker = '    // JIKA LENGKAP ATAU ADA SHALAT YANG DILAKUKAN, MAKA BERHALANGAN MUTLAK TIDAK (FALSE)!';
const newSubmitBerhalanganCode = `    // JIKA SISWA LAKI-LAKI, OPSI BERHALANGAN MUTLAK TIDAK (FALSE)!
    let studentJk = userProfile.jk || getStudentGender(cleanUid);
    if (studentJk === 'L') {
      isBerhalangan = false;
    }

    // JIKA LENGKAP ATAU ADA SHALAT YANG DILAKUKAN, MAKA BERHALANGAN MUTLAK TIDAK (FALSE)!`;

// Replace setupInitialSheets and importAllStudents headers
const oldSetupHeader = "const userHeaders = ['uid', 'nama', 'kelas', 'tingkat', 'password', 'role'];";
const newSetupHeader = "const userHeaders = ['uid', 'nama', 'kelas', 'tingkat', 'jk', 'password', 'role'];";

// Replace getAllStudentData
const genderMap = {};
students.forEach(s => { genderMap[s.uid] = s.jk; });

const jsUsersArray = allUsers.map(u => `    ['${u[0]}', '${u[1].replace(/'/g, "\\'")}', '${u[2]}', '${u[3]}', '${u[4]}', '${u[5]}', '${u[6]}']`);

const newGenderHelperAndData = `
/**
 * Helper Mendapatkan Jenis Kelamin Berdasarkan UID
 */
function getStudentGender(uid) {
  const map = ${JSON.stringify(genderMap)};
  return map[String(uid).trim()] || 'L';
}

/**
 * Database Master 357 Akun Siswa + 1 Akun Admin (Dengan Kolom JK: 'L' / 'P')
 */
function getAllStudentData() {
  return [
${jsUsersArray.join(',\\n')}
  ];
}
`;

// Apply replacements
const loginStart = code.indexOf(oldLoginMarker);
const loginEnd = code.indexOf(oldLoginEndMarker);
if (loginStart !== -1 && loginEnd !== -1) {
  code = code.substring(0, loginStart) + newLoginFunc + code.substring(loginEnd);
}

if (code.includes(oldDashMarker)) {
  code = code.replace(oldDashMarker, newDashCode);
}

if (code.includes(oldSubmitBerhalanganMarker)) {
  code = code.replace(oldSubmitBerhalanganMarker, newSubmitBerhalanganCode);
}

code = code.split(oldSetupHeader).join(newSetupHeader);

const getAllStudentDataIndex = code.indexOf('function getAllStudentData() {');
if (getAllStudentDataIndex !== -1) {
  // Find preceding comments
  const helperIndex = code.indexOf('/**', getAllStudentDataIndex - 100);
  code = code.substring(0, helperIndex !== -1 ? helperIndex : getAllStudentDataIndex) + newGenderHelperAndData.trim() + '\n';
}

fs.writeFileSync('backend/Code.gs', code, 'utf8');
console.log('backend/Code.gs updated with gender logic! Total lines:', code.split('\n').length);
