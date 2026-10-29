const fs = require('fs');

// 1. Load students
const students = JSON.parse(fs.readFileSync('scratch/students_full.json', 'utf8'));
const genderMap = {};
students.forEach(s => {
  genderMap[s.uid] = s.jk;
});

// ============================================================
// 1. UPDATE js/auth.js
// ============================================================
const authContent = `/**
 * Auth & Session Manager
 * Mengelola status login, role guard, session di localStorage, dan deteksi Jenis Kelamin
 */

const AUTH_STORAGE_KEY = '7kaih_user_session';

// Master Data Jenis Kelamin 357 Siswa ('L' = Laki-laki, 'P' = Perempuan)
const STUDENT_GENDER_MAP = ${JSON.stringify(genderMap, null, 2)};

const Auth = {
  /**
   * Cek apakah user adalah perempuan / siswi
   * @param {Object} user - objek user session
   * @returns {boolean}
   */
  isFemale(user) {
    if (!user) return false;
    const jk = String(user.jk || user.jenisKelamin || user.gender || '').toUpperCase();
    if (jk === 'P' || jk === 'PEREMPUAN' || jk === 'WANITA' || jk === 'F') return true;
    if (jk === 'L' || jk === 'LAKI-LAKI' || jk === 'PRIA' || jk === 'M') return false;

    // Fallback lookup dari STUDENT_GENDER_MAP berdasarkan UID (Nomor Induk)
    const uid = String(user.uid || '').trim();
    if (uid && STUDENT_GENDER_MAP[uid]) {
      return STUDENT_GENDER_MAP[uid] === 'P';
    }
    return false;
  },

  /**
   * Dapatkan jenis kelamin user ('L' atau 'P')
   */
  getGender(uid) {
    const clean = String(uid || '').trim();
    return STUDENT_GENDER_MAP[clean] || 'L';
  },

  /**
   * Simpan user ke localStorage dengan jaminan field jk terisi
   */
  saveUser(user) {
    if (user && !user.jk && user.uid) {
      user.jk = this.getGender(user.uid);
    }
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  },

  /**
   * Ambil data user yang sedang login
   */
  getUser() {
    try {
      const data = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!data) return null;
      const user = JSON.parse(data);
      if (user && !user.jk && user.uid) {
        user.jk = this.getGender(user.uid);
      }
      return user;
    } catch (e) {
      console.error('Error parsing session:', e);
      return null;
    }
  },

  /**
   * Cek apakah user sedang login
   */
  isLoggedIn() {
    return !!this.getUser();
  },

  /**
   * Logout dan redirect ke login.html
   */
  logout() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.location.href = 'login.html';
  },

  /**
   * Guard halaman: memastikan user login & memiliki role yang sesuai
   * @param {string} requiredRole - 'peserta' | 'admin' | null (sembarang login)
   */
  requireAuth(requiredRole = null) {
    const user = this.getUser();
    if (!user) {
      window.location.href = 'login.html';
      return null;
    }

    if (requiredRole && user.role !== requiredRole) {
      if (user.role === 'admin') {
        window.location.href = 'admin.html';
      } else {
        window.location.href = 'dashboard.html';
      }
      return null;
    }

    return user;
  },

  /**
   * Guard untuk halaman login: jika sudah login, langsung redirect ke halaman sesuai role
   */
  redirectIfLoggedIn() {
    const user = this.getUser();
    if (user) {
      if (user.role === 'admin') {
        window.location.href = 'admin.html';
      } else {
        window.location.href = 'dashboard.html';
      }
    }
  },

  /**
   * Render pill info user di header aplikasi
   */
  renderHeaderUser() {
    const userPillEl = document.getElementById('headerUserPill');
    const userNameEl = document.getElementById('headerUserName');
    const logoutBtn = document.getElementById('logoutBtn');

    const user = this.getUser();
    if (user && userPillEl) {
      userPillEl.style.display = 'inline-flex';
      if (userNameEl) {
        userNameEl.textContent = user.nama + ' (' + (user.role === 'admin' ? 'Admin' : user.kelas) + ')';
      }
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (confirm('Apakah Anda yakin ingin keluar dari akun?')) {
          this.logout();
        }
      });
    }
  }
};
`;

fs.writeFileSync('js/auth.js', authContent, 'utf8');
console.log('js/auth.js updated!');
