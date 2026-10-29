/**
 * Participant Dashboard Controller
 * Menampilkan profil siswa, status 4 sesi pengisian, dan riwayat jawaban
 */

// Helper pemformat tanggal Indonesia (Hari, Tanggal Bulan Tahun)
function formatTanggalIndo(dateStr) {
  if (!dateStr || dateStr === '-') return '-';
  try {
    let cleanStr = String(dateStr).trim().replace(/\s*\([^)]*\)/g, '');
    const parts = cleanStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (parts) {
      cleanStr = parts[3] + '-' + parts[2].padStart(2, '0') + '-' + parts[1].padStart(2, '0');
    }
    const d = new Date(cleanStr);
    if (isNaN(d.getTime())) {
      return String(dateStr);
    }
    return d.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  } catch (e) {
    return String(dateStr);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const currentUser = Auth.requireAuth('peserta');
  if (!currentUser) return;
  Auth.renderHeaderUser();

  // DOM Elements
  const profileNama = document.getElementById('profileNama');
  const profileUid = document.getElementById('profileUid');
  const profileKelas = document.getElementById('profileKelas');
  const profileTingkat = document.getElementById('profileTingkat');
  const profileJk = document.getElementById('profileJk');
  const activeSessionCta = document.getElementById('activeSessionCta');

  const sessionsLoader = document.getElementById('sessionsLoader');
  const sessionsContainer = document.getElementById('sessionsContainer');
  const historyDetailSection = document.getElementById('historyDetailSection');
  const historyCard = document.getElementById('historyCard');

  profileNama.textContent = currentUser.nama;
  profileUid.textContent = currentUser.uid;
  profileKelas.textContent = currentUser.kelas;
  profileTingkat.textContent = currentUser.tingkat;
  if (profileJk) {
    const isP = Auth.isFemale(currentUser);
    profileJk.textContent = isP ? 'Perempuan' : 'Laki-laki';
  }

  try {
    const res = await Api.getPesertaDashboard(currentUser.uid);

    if (res.success && res.sessions) {
      sessionsLoader.style.display = 'none';
      sessionsContainer.style.display = 'grid';

      let hasActiveUnfilled = false;
      const activeSessionObj = res.sessions.find(s => s.statusSesi === 'aktif');
      const activeSessionNum = activeSessionObj ? parseInt(activeSessionObj.sesi, 10) : 1;

      sessionsContainer.innerHTML = '';
      res.sessions.forEach(session => {
        const card = document.createElement('div');
        card.className = 'session-card';

        const sNum = parseInt(session.sesi, 10);
        let badgeHtml = '';
        let actionBtnHtml = '';
        let statusClass = '';

        if (session.sudahIsi) {
          statusClass = 'status-selesai';
          badgeHtml = '<span class="badge badge-success">Sudah Mengisi</span>';
          actionBtnHtml = `<button class="btn btn-outline btn-sm btn-block view-detail-btn" data-sesi="${session.sesi}" style="margin-top: auto;">Lihat Jawaban</button>`;
        } else if (session.statusSesi === 'aktif') {
          hasActiveUnfilled = true;
          statusClass = 'status-aktif';
          badgeHtml = '<span class="badge badge-primary">Sesi Dibuka</span>';
          actionBtnHtml = `<a href="form.html" class="btn btn-primary btn-sm btn-block" style="margin-top: auto;">Isi Form Sekarang</a>`;
        } else if (sNum < activeSessionNum) {
          // Sesi sebelumnya sudah selesai karena sesi selanjutnya sudah berjalan
          statusClass = 'status-terkunci';
          badgeHtml = '<span class="badge badge-gray">Sesi Selesai</span>';
          actionBtnHtml = `<button class="btn btn-outline btn-sm btn-block" disabled style="margin-top: auto;">Sudah Ditutup</button>`;
        } else {
          // Sesi mendatang
          statusClass = 'status-terkunci';
          badgeHtml = '<span class="badge badge-gray">Belum Dibuka</span>';
          actionBtnHtml = `<button class="btn btn-outline btn-sm btn-block" disabled style="margin-top: auto;">Terkunci</button>`;
        }

        card.classList.add(statusClass);

        card.innerHTML = `
          <div class="session-header">
            <span class="session-number">Sesi ${session.sesi}</span>
            ${badgeHtml}
          </div>
          <div class="session-date">
            Jadwal: <strong>${formatTanggalIndo(session.tanggal)}</strong>
          </div>
          <p style="font-size: 0.825rem; color: var(--gray-600); margin-bottom: 1.15rem;">
            ${session.nama || 'Evaluasi Pembiasaan 7 KAIH'}
          </p>
          ${actionBtnHtml}
        `;

        sessionsContainer.appendChild(card);
      });

      if (hasActiveUnfilled) {
        activeSessionCta.style.display = 'block';
      }

      document.querySelectorAll('.view-detail-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const sId = btn.getAttribute('data-sesi');
          const targetSession = res.sessions.find(s => String(s.sesi) === String(sId));
          if (targetSession && targetSession.detail) {
            renderSessionDetail(targetSession);
          }
        });
      });

      const lastFilled = [...res.sessions].reverse().find(s => s.sudahIsi);
      if (lastFilled && lastFilled.detail) {
        renderSessionDetail(lastFilled);
      }

    } else {
      sessionsLoader.innerHTML = `<p style="color: var(--danger); font-size: 0.85rem;">Gagal memuat sesi: ${res.message || 'Data tidak ditemukan'}</p>`;
    }
  } catch (err) {
    console.error(err);
    sessionsLoader.innerHTML = `<p style="color: var(--danger); font-size: 0.85rem;">Terjadi kendala saat memuat riwayat dashboard.</p>`;
  }

  function renderSessionDetail(session) {
    historyDetailSection.style.display = 'block';
    const d = session.detail;

    let ibadahStr = '';
    if (d.ibadahBerhalangan || (d.ibadah && d.ibadah.berhalangan)) {
      ibadahStr = 'Sedang Berhalangan (Uzur Syar\'i)';
    } else if (d.ibadah) {
      if (d.ibadah.lengkap) {
        ibadahStr = 'Lengkap (5 Waktu)';
      } else {
        const pArr = [];
        if (d.ibadah.shubuh) pArr.push('Shubuh');
        if (d.ibadah.dzuhur) pArr.push('Dzuhur');
        if (d.ibadah.ashar) pArr.push('Ashar');
        if (d.ibadah.maghrib) pArr.push('Maghrib');
        if (d.ibadah.isya) pArr.push('Isya');
        ibadahStr = pArr.join(', ') || 'Parsial';
      }
    } else {
      ibadahStr = d.ibadahLengkap === 'Ya' ? 'Lengkap (5 Waktu)' : 'Parsial';
    }

    historyCard.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--gray-200); padding-bottom: 0.65rem; margin-bottom: 0.85rem;">
        <div>
          <strong style="font-size: 0.95rem; color: var(--gray-900);">Ringkasan Jawaban &bull; Sesi ${session.sesi}</strong>
          <span style="display: block; font-size: 0.775rem; color: var(--gray-500);">Waktu Pengiriman: ${d.timestamp || '-'}</span>
        </div>
        <span class="badge badge-success">Terverifikasi</span>
      </div>

      <div class="recap-list">
        <div class="recap-item">
          <span class="recap-title">1. Bangun Pagi</span>
          <span class="recap-value">${d.bangunPagi || '-'}</span>
        </div>
        <div class="recap-item">
          <span class="recap-title">2. Beribadah</span>
          <span class="recap-value">${ibadahStr}</span>
        </div>
        <div class="recap-item">
          <span class="recap-title">3. Olahraga</span>
          <span class="recap-value">${d.olahraga === 'Ya' ? `Ya (${d.olahragaDurasi || '-'})` : 'Tidak'}</span>
        </div>
        <div class="recap-item">
          <span class="recap-title">4. Makan Sehat</span>
          <span class="recap-value">${d.makanSehat || '-'}</span>
        </div>
        <div class="recap-item">
          <span class="recap-title">5. Gemar Belajar</span>
          <span class="recap-value">${d.gemarBelajar || d.gemarBelajarDurasi || '-'} ${d.gemarBelajarCatatan ? `("${d.gemarBelajarCatatan}")` : ''}</span>
        </div>
        <div class="recap-item">
          <span class="recap-title">6. Bermasyarakat</span>
          <span class="recap-value">${d.bermasyarakat || '-'}</span>
        </div>
        <div class="recap-item">
          <span class="recap-title">7. Tidur Cepat</span>
          <span class="recap-value">${d.tidurCepat || '-'} ${d.tidurCatatan ? `("${d.tidurCatatan}")` : ''}</span>
        </div>
      </div>
    `;

    historyDetailSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
});
