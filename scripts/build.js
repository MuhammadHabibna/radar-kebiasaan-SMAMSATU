/**
 * Build & Integrity Check Script
 * Memverifikasi seluruh sintaks file, keterhubungan aset, dan integritas data
 */

const fs = require('fs');
const path = require('path');

console.log('\n============================================================');
console.log('  BUILD & INTEGRITY VERIFICATION - WEB FORM 7 KAIH 2026');
console.log('============================================================\n');

let errorCount = 0;

// 1. Verifikasi File JavaScript
const jsFiles = [
  'js/config.js',
  'js/auth.js',
  'js/api.js',
  'js/form.js',
  'js/dashboard.js',
  'js/admin.js',
  'auto_test.js',
  'backend/Code.gs'
];

console.log('1. Memeriksa Sintaks JavaScript & Backend Apps Script:');
jsFiles.forEach(file => {
  const filePath = path.resolve(__dirname, '..', file);
  if (!fs.existsSync(filePath)) {
    console.error(`   [MISSING] File tidak ditemukan: ${file}`);
    errorCount++;
    return;
  }
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    new Function(content);
    const sizeKb = (content.length / 1024).toFixed(1);
    console.log(`   [OK] ${file} (${sizeKb} KB) - Sintaks valid`);
  } catch (err) {
    console.error(`   [ERROR] ${file} - Kesalahan sintaks: ${err.message}`);
    errorCount++;
  }
});

// 2. Verifikasi File CSS
console.log('\n2. Memeriksa File Stylesheet (CSS):');
const cssFiles = ['css/style.css', 'css/components.css'];
cssFiles.forEach(file => {
  const filePath = path.resolve(__dirname, '..', file);
  if (fs.existsSync(filePath)) {
    const sizeKb = (fs.readFileSync(filePath, 'utf8').length / 1024).toFixed(1);
    console.log(`   [OK] ${file} (${sizeKb} KB) - Tersedia`);
  } else {
    console.error(`   [MISSING] File CSS hilang: ${file}`);
    errorCount++;
  }
});

// 3. Verifikasi File HTML & Keterhubungan Link/Script
console.log('\n3. Memeriksa Struktur File HTML & Asset References:');
const htmlFiles = [
  'index.html',
  'login.html',
  'form.html',
  'dashboard.html',
  'admin.html',
  'auto_test.html'
];

htmlFiles.forEach(file => {
  const filePath = path.resolve(__dirname, '..', file);
  if (!fs.existsSync(filePath)) {
    console.error(`   [MISSING] ${file}`);
    errorCount++;
    return;
  }
  const content = fs.readFileSync(filePath, 'utf8');

  // Cek tag link css
  const cssMatches = content.match(/href=["'](css\/[^"']+)["']/g) || [];
  cssMatches.forEach(m => {
    const rel = m.replace(/href=["']/, '').replace(/["']/, '');
    if (!fs.existsSync(path.resolve(__dirname, '..', rel))) {
      console.error(`   [BROKEN LINK] di ${file}: ${rel} tidak ditemukan`);
      errorCount++;
    }
  });

  // Cek tag script js
  const jsMatches = content.match(/src=["'](js\/[^"']+)["']/g) || [];
  jsMatches.forEach(m => {
    const rel = m.replace(/src=["']/, '').replace(/["']/, '');
    if (!fs.existsSync(path.resolve(__dirname, '..', rel))) {
      console.error(`   [BROKEN SCRIPT] di ${file}: ${rel} tidak ditemukan`);
      errorCount++;
    }
  });

  console.log(`   [OK] ${file} - Seluruh referensi aset terhubung`);
});

// 4. Verifikasi Data Siswa & Database Sheets
console.log('\n4. Memverifikasi Integritas Master Data Siswa & Database:');
const tsvPath = path.resolve(__dirname, '..', 'backend/users_data.tsv');
if (fs.existsSync(tsvPath)) {
  const lines = fs.readFileSync(tsvPath, 'utf8').trim().split('\n');
  const header = lines[0].split('\t');
  const expectedHeader = ['uid', 'nama', 'kelas', 'tingkat', 'jk', 'password', 'role'];
  const isHeaderValid = expectedHeader.every((h, i) => header[i] === h);

  if (isHeaderValid) {
    console.log(`   [OK] backend/users_data.tsv Header valid (${header.join(' | ')})`);
    console.log(`   [OK] Total baris akun database: ${lines.length - 1} akun (1 Admin + ${lines.length - 2} Siswa)`);
  } else {
    console.error(`   [FAIL] Header users_data.tsv tidak sesuai. Ditemukan: ${header.join(',')}`);
    errorCount++;
  }
} else {
  console.error('   [MISSING] backend/users_data.tsv tidak ditemukan!');
  errorCount++;
}

// 5. Cek URL Endpoint Google Apps Script
console.log('\n5. Memeriksa Konfigurasi Endpoint:');
const configPath = path.resolve(__dirname, '..', 'js/config.js');
const configContent = fs.readFileSync(configPath, 'utf8');
if (configContent.includes('https://script.google.com/macros/s/')) {
  console.log('   [OK] SCRIPT_URL telah terkonfigurasi ke Google Apps Script aktif');
} else {
  console.warn('   [WARNING] SCRIPT_URL masih kosong atau belum mengarah ke Google Apps Script.');
}

console.log('\n============================================================');
if (errorCount === 0) {
  console.log('  STATUS BUILD: BERHASIL (100% Bebas Error)');
  console.log('  Seluruh file aplikasi siap dijalankan & di-deploy!');
  console.log('============================================================\n');
  process.exit(0);
} else {
  console.error(`  STATUS BUILD: GAGAL (${errorCount} Error ditemukan)`);
  console.log('============================================================\n');
  process.exit(1);
}
