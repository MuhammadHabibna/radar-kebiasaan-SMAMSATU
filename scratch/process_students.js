const fs = require('fs');

const raw = fs.readFileSync('d:/WEB/Form Data/scratch/students_raw.csv', 'utf8');
const lines = raw.split(/\r?\n/);

const seenUids = new Set();
const users = [];

// Header baris Users: uid | nama | kelas | tingkat | password | role
// 1. Akun Admin
users.push({
  uid: 'admin',
  nama: 'Administrator 7 KAIH',
  kelas: 'Guru BK / Tim Panitia',
  tingkat: 'Umum',
  password: 'admin2026',
  role: 'admin'
});
seenUids.add('admin');

for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('No,Induk')) continue;
  
  const parts = trimmed.split(',');
  if (parts.length >= 6) {
    const induk = parts[1].trim();
    const nama = parts[3].trim();
    const kelas = parts[5].trim();
    
    // Tentukan tingkat sesuai aturan
    // X-1 s/d X-6 -> 10
    // XI Saintek 1 s/d 4 -> 11
    // XI Soshum 1 s/d 2 -> 11
    let tingkat = '10';
    if (kelas.startsWith('X-') || kelas.startsWith('X ')) {
      tingkat = '10';
    } else if (kelas.startsWith('XI')) {
      tingkat = '11';
    } else if (kelas.startsWith('XII')) {
      tingkat = '12';
    }

    if (induk && !seenUids.has(induk)) {
      seenUids.add(induk);
      users.push({
        uid: induk,
        nama: nama,
        kelas: kelas,
        tingkat: tingkat,
        password: induk, // Password = Nomor Induk
        role: 'peserta'
      });
    }
  }
}

console.log(`Berhasil memproses ${users.length} akun (1 Admin + ${users.length - 1} Peserta Siswa)`);

// 1. Buat TSV (Tab Separated Values) untuk langsung Copy-Paste ke Google Sheets tab 'Users'
const tsvHeader = ['uid', 'nama', 'kelas', 'tingkat', 'password', 'role'].join('\t');
const tsvRows = users.map(u => [u.uid, u.nama, u.kelas, u.tingkat, u.password, u.role].join('\t'));
const tsvContent = [tsvHeader, ...tsvRows].join('\n');
fs.writeFileSync('d:/WEB/Form Data/scratch/users_for_sheets.tsv', tsvContent, 'utf8');

// 2. Buat array JS untuk Code.gs
const jsArray = users.map(u => `    ['${u.uid}', '${u.nama.replace(/'/g, "\\'")}', '${u.kelas}', '${u.tingkat}', '${u.password}', '${u.role}']`);
fs.writeFileSync('d:/WEB/Form Data/scratch/users_array.txt', '[\n' + jsArray.join(',\n') + '\n];', 'utf8');

// 3. Simpan JSON
fs.writeFileSync('d:/WEB/Form Data/scratch/users.json', JSON.stringify(users, null, 2), 'utf8');
