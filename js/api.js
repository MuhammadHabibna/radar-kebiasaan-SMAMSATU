/**
 * API Client Layer
 * Menghubungkan Frontend dengan Google Apps Script Web App
 * Dilengkapi dengan Auto-Mock Fallback saat SCRIPT_URL belum dikonfigurasi
 */

const Api = {
  /**
   * Helper Request ke Apps Script
   */
  async request(action, params = {}, method = 'GET') {
    const isMock = !CONFIG.SCRIPT_URL || CONFIG.SCRIPT_URL.trim() === '';

    if (isMock) {
      if (CONFIG.ENABLE_MOCK_FALLBACK) {
        console.warn(`[API] SCRIPT_URL kosong. Menjalankan '${action}' dengan Mock Storage lokal.`);
        return await this.mockHandler(action, params);
      } else {
        throw new Error('Google Apps Script URL belum dikonfigurasi di js/config.js');
      }
    }

    try {
      if (method === 'GET') {
        const urlParams = new URLSearchParams({ action, ...params });
        const res = await fetch(`${CONFIG.SCRIPT_URL}?${urlParams.toString()}`);
        return await res.json();
      } else {
        // Gunakan text/plain untuk POST agar menghindari preflight OPTIONS CORS issue di Google Apps Script
        const res = await fetch(CONFIG.SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action, ...params })
        });
        return await res.json();
      }
    } catch (err) {
      console.error(`[API Error: ${action}]`, err);
      return {
        success: false,
        message: 'Gagal terhubung ke server Google Sheets. Periksa koneksi internet atau konfigurasi Apps Script.'
      };
    }
  },

  // ==========================================
  // ENDPOINT METHODS
  // ==========================================

  async login(uid, password) {
    return await this.request('login', { uid, password }, 'POST');
  },

  async cekSesi() {
    return await this.request('cekSesi', {}, 'GET');
  },

  async cekSudahIsi(uid, sesi) {
    return await this.request('cekSudahIsi', { uid, sesi }, 'GET');
  },

  async submit(uid, sesi, answers) {
    return await this.request('submit', { uid, sesi, answers }, 'POST');
  },

  async getPesertaDashboard(uid) {
    return await this.request('getPesertaDashboard', { uid }, 'GET');
  },

  async getSubmissions(sesi = null, adminUid = null) {
    return await this.request('getSubmissions', { sesi, adminUid }, 'GET');
  },

  async getDetail(uid, sesi) {
    return await this.request('getDetail', { uid, sesi }, 'GET');
  },

  async setSesiAktif(sesi, adminUid = null) {
    return await this.request('setSesiAktif', { sesi, adminUid }, 'POST');
  },

  // ==========================================
  // LOCAL MOCK DATABASE (DEMO & OFFLINE TESTING)
  // ==========================================

  async mockHandler(action, params) {
    // Simulasi latency jaringan 200ms
    await new Promise(r => setTimeout(r, 200));

    // Load / init mock state dari localStorage
    const MOCK_USERS_KEY = '7kaih_mock_users';
    const MOCK_SUBS_KEY = '7kaih_mock_submissions';
    const MOCK_SESI_KEY = '7kaih_mock_sesi';

    let users = JSON.parse(localStorage.getItem(MOCK_USERS_KEY) || 'null');
    if (!users) {
      users = [
        { uid: 'admin', nama: 'Administrator 7 KAIH', kelas: 'Guru BK / Panitia', tingkat: 'Umum', jk: 'L', password: 'admin2026', role: 'admin' },
        { uid: '1001', nama: 'Ahmad Rizky Pratama', kelas: 'X-A', tingkat: 'X', jk: 'L', password: 'siswa123', role: 'peserta' },
        { uid: '1002', nama: 'Siti Nur Aisyah', kelas: 'X-B', tingkat: 'X', jk: 'P', password: 'siswa123', role: 'peserta' },
        { uid: '1101', nama: 'Budi Santoso', kelas: 'XI-MIPA-1', tingkat: 'XI', jk: 'L', password: 'siswa123', role: 'peserta' },
        { uid: '1102', nama: 'Dewi Lestari', kelas: 'XI-IPS-2', tingkat: 'XI', jk: 'P', password: 'siswa123', role: 'peserta' },
        { uid: '1201', nama: 'Muhammad Fajar', kelas: 'XII-MIPA-3', tingkat: 'XII', jk: 'L', password: 'siswa123', role: 'peserta' },
        { uid: '1202', nama: 'Zahra Putri Amelia', kelas: 'XII-IPS-1', tingkat: 'XII', jk: 'P', password: 'siswa123', role: 'peserta' }
      ];
      localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users));
    }

    let sessions = JSON.parse(localStorage.getItem(MOCK_SESI_KEY) || 'null');
    if (!sessions) {
      sessions = [
        { sesi: '1', nama_sesi: 'Sesi 1 (Minggu ke-1)', tanggal: '2026-10-27', status: 'aktif' },
        { sesi: '2', nama_sesi: 'Sesi 2 (Minggu ke-1)', tanggal: '2026-10-30', status: 'nonaktif' },
        { sesi: '3', nama_sesi: 'Sesi 3 (Minggu ke-2)', tanggal: '2026-11-03', status: 'nonaktif' },
        { sesi: '4', nama_sesi: 'Sesi 4 (Minggu ke-2)', tanggal: '2026-11-06', status: 'nonaktif' }
      ];
      localStorage.setItem(MOCK_SESI_KEY, JSON.stringify(sessions));
    }

    let submissions = JSON.parse(localStorage.getItem(MOCK_SUBS_KEY) || '[]');

    switch (action) {
      case 'login': {
        const u = users.find(x => x.uid.toLowerCase() === String(params.uid).toLowerCase().trim() && x.password === String(params.password).trim());
        if (u) {
          return {
            success: true,
            user: { uid: u.uid, nama: u.nama, kelas: u.kelas, tingkat: u.tingkat, role: u.role }
          };
        }
        return { success: false, message: 'UID atau password salah (Coba: 1001 / siswa123 atau admin / admin2026).' };
      }

      case 'cekSesi': {
        const active = sessions.find(s => s.status === 'aktif');
        return { success: true, sesiAktif: active || null, allSesi: sessions };
      }

      case 'cekSudahIsi': {
        const existing = submissions.find(s => s.uid.toLowerCase() === String(params.uid).toLowerCase() && String(s.sesi) === String(params.sesi));
        return { success: true, sudahIsi: !!existing, data: existing || null };
      }

      case 'submit': {
        const u = users.find(x => x.uid.toLowerCase() === String(params.uid).toLowerCase());
        if (!u) return { success: false, message: 'Peserta tidak ditemukan.' };

        const targetSesi = params.sesi || (sessions.find(s => s.status === 'aktif') || {}).sesi || '1';
        const already = submissions.find(s => s.uid.toLowerCase() === u.uid.toLowerCase() && String(s.sesi) === String(targetSesi));
        if (already) {
          return { success: false, message: `Anda sudah pernah mengisi form untuk Sesi ${targetSesi}.` };
        }

        const subId = 'SUB-MOCK-' + Date.now();
        const newSub = {
          submissionId: subId,
          timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
          uid: u.uid,
          nama: u.nama,
          kelas: u.kelas,
          tingkat: u.tingkat,
          sesi: String(targetSesi),
          answers: params.answers
        };

        submissions.push(newSub);
        localStorage.setItem(MOCK_SUBS_KEY, JSON.stringify(submissions));

        return {
          success: true,
          message: 'Data kebiasaan 7 KAIH berhasil dikirim (Demo Mode)!',
          submissionId: subId,
          sesi: targetSesi
        };
      }

      case 'getPesertaDashboard': {
        const u = users.find(x => x.uid.toLowerCase() === String(params.uid).toLowerCase());
        if (!u) return { success: false, message: 'Peserta tidak ditemukan.' };

        const userSubs = submissions.filter(s => s.uid.toLowerCase() === u.uid.toLowerCase());
        const mappedSessions = sessions.map(s => {
          const sub = userSubs.find(x => String(x.sesi) === String(s.sesi));
          return {
            sesi: s.sesi,
            nama: s.nama_sesi,
            tanggal: s.tanggal,
            statusSesi: s.status,
            sudahIsi: !!sub,
            detail: sub ? sub.answers : null
          };
        });

        return {
          success: true,
          user: { uid: u.uid, nama: u.nama, kelas: u.kelas, tingkat: u.tingkat, role: u.role },
          sessions: mappedSessions
        };
      }

      case 'getSubmissions': {
        const targetSesi = params.sesi || (sessions.find(s => s.status === 'aktif') || {}).sesi || '1';
        const pesertaList = users
          .filter(u => u.role === 'peserta')
          .map(p => {
            const sub = submissions.find(s => s.uid.toLowerCase() === p.uid.toLowerCase() && String(s.sesi) === String(targetSesi));
            return {
              uid: p.uid,
              nama: p.nama,
              kelas: p.kelas,
              tingkat: p.tingkat,
              sudahIsi: !!sub,
              waktuPengisian: sub ? sub.timestamp : null,
              submissionId: sub ? sub.submissionId : null
            };
          });

        const totalPeserta = pesertaList.length;
        const totalSudah = pesertaList.filter(p => p.sudahIsi).length;

        return {
          success: true,
          sesi: targetSesi,
          summary: {
            totalPeserta,
            totalSudah,
            totalBelum: totalPeserta - totalSudah,
            persentase: totalPeserta > 0 ? Math.round((totalSudah / totalPeserta) * 100) : 0
          },
          pesertaList
        };
      }

      case 'getDetail': {
        const sub = submissions.find(s => s.uid.toLowerCase() === String(params.uid).toLowerCase() && String(s.sesi) === String(params.sesi));
        if (sub) {
          return {
            success: true,
            detail: {
              ...sub,
              ...sub.answers
            }
          };
        }
        return { success: false, message: 'Detail jawaban tidak ditemukan.' };
      }

      case 'setSesiAktif': {
        const targetSesi = String(params.sesi);
        sessions.forEach(s => {
          s.status = String(s.sesi) === targetSesi ? 'aktif' : 'nonaktif';
        });
        localStorage.setItem(MOCK_SESI_KEY, JSON.stringify(sessions));
        return {
          success: true,
          message: `Sesi ${targetSesi} sekarang berstatus aktif. Sesi lainnya otomatis selesai.`,
          sesiAktif: targetSesi
        };
      }

      default:
        return { success: false, message: 'Action tidak dikenal di Mock Mode.' };
    }
  }
};
