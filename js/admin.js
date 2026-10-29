/**
 * Admin Dashboard Controller
 * Mengelola pemantauan rekapitulasi siswa, filter dinamis, modal detail, dan ekspor CSV
 */

document.addEventListener('DOMContentLoaded', async () => {
  const currentAdmin = Auth.requireAuth('admin');
  if (!currentAdmin) return;
  Auth.renderHeaderUser();

  // State
  let allPesertaData = [];
  let currentSesi = '1';

  // DOM Elements
  const sesiSelect = document.getElementById('sesiSelect');
  const refreshBtn = document.getElementById('refreshBtn');
  const searchInput = document.getElementById('searchInput');
  const filterTingkat = document.getElementById('filterTingkat');
  const filterKelas = document.getElementById('filterKelas');
  const filterStatus = document.getElementById('filterStatus');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const pesertaTableBody = document.getElementById('pesertaTableBody');

  const statTotalPeserta = document.getElementById('statTotalPeserta');
  const statSudahIsi = document.getElementById('statSudahIsi');
  const statBelumIsi = document.getElementById('statBelumIsi');
  const statPersentase = document.getElementById('statPersentase');

  // Modal Elements
  const detailModal = document.getElementById('detailModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalStudentName = document.getElementById('modalStudentName');
  const modalStudentMeta = document.getElementById('modalStudentMeta');
  const modalLoading = document.getElementById('modalLoading');
  const modalContent = document.getElementById('modalContent');
  const modalRecapList = document.getElementById('modalRecapList');
  const setActiveSessionBtn = document.getElementById('setActiveSessionBtn');

  let currentActiveSesi = '1';

  function updateActiveBtnUI() {
    if (currentSesi === currentActiveSesi) {
      setActiveSessionBtn.textContent = 'Sedang Berjalan';
      setActiveSessionBtn.disabled = true;
      setActiveSessionBtn.className = 'btn btn-success btn-sm';
    } else {
      setActiveSessionBtn.textContent = `Buka Sesi ${currentSesi}`;
      setActiveSessionBtn.disabled = false;
      setActiveSessionBtn.className = 'btn btn-outline btn-sm';
    }
  }

  // Auto detect sesi aktif
  try {
    const sesiRes = await Api.cekSesi();
    if (sesiRes.success && sesiRes.sesiAktif) {
      currentActiveSesi = String(sesiRes.sesiAktif.sesi);
      currentSesi = currentActiveSesi;
      sesiSelect.value = currentSesi;
    }
  } catch (e) {
    console.warn('Gagal cek sesi aktif:', e);
  }
  updateActiveBtnUI();

  setActiveSessionBtn.addEventListener('click', async () => {
    if (confirm(`Buka Sesi ${currentSesi} sekarang? Sesi sebelumnya otomatis akan selesai/ditutup bagi siswa.`)) {
      setActiveSessionBtn.disabled = true;
      setActiveSessionBtn.textContent = 'Memproses...';
      const res = await Api.setSesiAktif(currentSesi, currentAdmin.uid);
      if (res.success) {
        currentActiveSesi = currentSesi;
        updateActiveBtnUI();
        loadData();
      } else {
        alert(res.message || 'Gagal mengubah sesi aktif.');
        updateActiveBtnUI();
      }
    }
  });

  async function loadData() {
    pesertaTableBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2.5rem;">
          <div class="spinner spinner-primary" style="margin-bottom: 0.5rem;"></div>
          <p style="color: var(--gray-500); font-size: 0.85rem;">Memuat data rekapitulasi Sesi ${currentSesi}...</p>
        </td>
      </tr>
    `;

    try {
      const res = await Api.getSubmissions(currentSesi, currentAdmin.uid);

      if (res.success) {
        allPesertaData = res.pesertaList || [];

        const summary = res.summary || {
          totalPeserta: allPesertaData.length,
          totalSudah: allPesertaData.filter(p => p.sudahIsi).length,
          totalBelum: allPesertaData.filter(p => !p.sudahIsi).length,
          persentase: 0
        };

        statTotalPeserta.textContent = summary.totalPeserta;
        statSudahIsi.textContent = summary.totalSudah;
        statBelumIsi.textContent = summary.totalBelum;
        statPersentase.textContent = `${summary.persentase}%`;

        populateKelasOptions();
        applyFilterAndRender();
      } else {
        pesertaTableBody.innerHTML = `
          <tr>
            <td colspan="8" style="text-align: center; padding: 2rem; color: var(--danger); font-size: 0.85rem;">
              Gagal memuat data: ${res.message || 'Terjadi kesalahan sistem'}
            </td>
          </tr>
        `;
      }
    } catch (err) {
      console.error(err);
      pesertaTableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 2rem; color: var(--danger); font-size: 0.85rem;">
            Gagal terhubung ke server Google Sheets.
          </td>
        </tr>
      `;
    }
  }

  function populateKelasOptions() {
    const kelasSet = new Set();
    allPesertaData.forEach(p => {
      if (p.kelas) kelasSet.add(p.kelas);
    });

    const currentVal = filterKelas.value;
    filterKelas.innerHTML = '<option value="ALL">Semua Rombel</option>';
    Array.from(kelasSet).sort().forEach(k => {
      const opt = document.createElement('option');
      opt.value = k;
      opt.textContent = k;
      filterKelas.appendChild(opt);
    });

    if (kelasSet.has(currentVal)) {
      filterKelas.value = currentVal;
    }
  }

  function formatWaktu(dateStr) {
    if (!dateStr || dateStr === '-') return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      return d.toLocaleString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).replace('.', ':') + ' WIB';
    } catch (e) {
      return String(dateStr);
    }
  }

  function applyFilterAndRender() {
    const searchVal = searchInput.value.toLowerCase().trim();
    const tingkatVal = filterTingkat.value;
    const kelasVal = filterKelas.value;
    const statusVal = filterStatus.value;

    const filtered = allPesertaData.filter(item => {
      const matchSearch = !searchVal || 
        item.nama.toLowerCase().includes(searchVal) || 
        item.uid.toLowerCase().includes(searchVal);

      const itemTingkatStr = String(item.tingkat || '').trim();
      const matchTingkat = (tingkatVal === 'ALL') || 
        (itemTingkatStr === tingkatVal) ||
        (tingkatVal === '10' && (itemTingkatStr === '10' || itemTingkatStr === 'X')) ||
        (tingkatVal === '11' && (itemTingkatStr === '11' || itemTingkatStr === 'XI')) ||
        (tingkatVal === '12' && (itemTingkatStr === '12' || itemTingkatStr === 'XII'));

      const matchKelas = kelasVal === 'ALL' || item.kelas === kelasVal;

      let matchStatus = true;
      if (statusVal === 'SUDAH') matchStatus = item.sudahIsi === true;
      if (statusVal === 'BELUM') matchStatus = item.sudahIsi === false;

      return matchSearch && matchTingkat && matchKelas && matchStatus;
    });

    if (filtered.length === 0) {
      pesertaTableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 2rem; color: var(--gray-500); font-size: 0.85rem;">
            Tidak ditemukan siswa yang sesuai dengan kriteria filter.
          </td>
        </tr>
      `;
      return;
    }

    pesertaTableBody.innerHTML = filtered.map((p, idx) => {
      const statusBadge = p.sudahIsi
        ? '<span class="badge badge-success">Sudah Mengisi</span>'
        : '<span class="badge badge-danger">Belum Mengisi</span>';

      const actionBtn = p.sudahIsi
        ? `<button class="btn btn-outline btn-sm btn-detail" data-uid="${p.uid}" data-nama="${p.nama}" data-kelas="${p.kelas}">Rincian</button>`
        : '<span style="color: var(--gray-400); font-size: 0.8rem;">-</span>';

      return `
        <tr>
          <td>${idx + 1}</td>
          <td><strong style="font-family: monospace; color: var(--primary);">${p.uid}</strong></td>
          <td><strong>${p.nama}</strong></td>
          <td>${p.kelas}</td>
          <td><span class="badge badge-gray">${p.tingkat}</span></td>
          <td>${statusBadge}</td>
          <td style="font-size: 0.8rem; color: var(--gray-500);">${formatWaktu(p.waktuPengisian)}</td>
          <td style="text-align: center;">${actionBtn}</td>
        </tr>
      `;
    }).join('');

    document.querySelectorAll('.btn-detail').forEach(btn => {
      btn.addEventListener('click', () => {
        const uid = btn.getAttribute('data-uid');
        const nama = btn.getAttribute('data-nama');
        const kelas = btn.getAttribute('data-kelas');
        openDetailModal(uid, nama, kelas);
      });
    });
  }

  sesiSelect.addEventListener('change', () => {
    currentSesi = sesiSelect.value;
    updateActiveBtnUI();
    loadData();
  });

  refreshBtn.addEventListener('click', () => {
    loadData();
  });

  searchInput.addEventListener('input', applyFilterAndRender);
  filterTingkat.addEventListener('change', applyFilterAndRender);
  filterKelas.addEventListener('change', applyFilterAndRender);
  filterStatus.addEventListener('change', applyFilterAndRender);

  // ==========================================
  // DETAIL MODAL HANDLER
  // ==========================================
  async function openDetailModal(uid, nama, kelas) {
    modalStudentName.textContent = nama;
    modalStudentMeta.textContent = `UID / NISN: ${uid} &bull; Kelas: ${kelas} &bull; Sesi ${currentSesi}`;
    modalLoading.style.display = 'block';
    modalContent.style.display = 'none';
    detailModal.classList.add('active');

    try {
      const res = await Api.getDetail(uid, currentSesi);
      modalLoading.style.display = 'none';

      if (res.success && res.detail) {
        modalContent.style.display = 'block';
        const d = res.detail;

        let ibadahStr = '';
        if (d.ibadah) {
          if (d.ibadah.berhalangan) {
            ibadahStr = 'Sedang Berhalangan (Uzur Syar\'i)';
          } else if (d.ibadah.lengkap) {
            ibadahStr = 'Lengkap (5 Waktu)';
          } else {
            const arr = [];
            if (d.ibadah.shubuh) arr.push('Shubuh');
            if (d.ibadah.dzuhur) arr.push('Dzuhur');
            if (d.ibadah.ashar) arr.push('Ashar');
            if (d.ibadah.maghrib) arr.push('Maghrib');
            if (d.ibadah.isya) arr.push('Isya');
            ibadahStr = arr.join(', ') || 'Parsial';
          }
        } else {
          ibadahStr = d.ibadahLengkap === 'Ya' ? 'Lengkap (5 Waktu)' : '-';
        }

        modalRecapList.innerHTML = `
          <div class="recap-item">
            <span class="recap-title">Waktu Submit</span>
            <span class="recap-value" style="font-family: monospace;">${d.timestamp || '-'}</span>
          </div>
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
            <span class="recap-value">${d.gemarBelajarDurasi || d.gemarBelajar || '-'} ${d.gemarBelajarCatatan ? `<br><em>"${d.gemarBelajarCatatan}"</em>` : ''}</span>
          </div>
          <div class="recap-item">
            <span class="recap-title">6. Bermasyarakat</span>
            <span class="recap-value">${d.bermasyarakat || '-'}</span>
          </div>
          <div class="recap-item">
            <span class="recap-title">7. Tidur Cepat</span>
            <span class="recap-value">${d.tidurCepat || '-'} ${d.tidurCatatan ? `<br><em>"${d.tidurCatatan}"</em>` : ''}</span>
          </div>
        `;
      } else {
        modalRecapList.innerHTML = `<p style="color: var(--danger); font-size: 0.85rem;">${res.message || 'Detail tidak ditemukan.'}</p>`;
        modalContent.style.display = 'block';
      }
    } catch (e) {
      modalLoading.style.display = 'none';
      modalRecapList.innerHTML = `<p style="color: var(--danger); font-size: 0.85rem;">Gagal memuat detail jawaban.</p>`;
      modalContent.style.display = 'block';
    }
  }

  modalCloseBtn.addEventListener('click', () => {
    detailModal.classList.remove('active');
  });

  detailModal.addEventListener('click', (e) => {
    if (e.target === detailModal) {
      detailModal.classList.remove('active');
    }
  });

  // ==========================================
  // EXPORT CSV UTILITY
  // ==========================================
  exportCsvBtn.addEventListener('click', () => {
    if (allPesertaData.length === 0) {
      alert('Tidak ada data untuk diekspor.');
      return;
    }

    const headers = ['No', 'UID/NISN', 'Nama Siswa', 'Kelas', 'Tingkat', 'Status Sesi ' + currentSesi, 'Waktu Pengisian'];
    const rows = allPesertaData.map((p, idx) => [
      idx + 1,
      `"${p.uid}"`,
      `"${p.nama}"`,
      `"${p.kelas}"`,
      `"${p.tingkat}"`,
      p.sudahIsi ? 'Sudah Mengisi' : 'Belum Mengisi',
      `"${p.waktuPengisian ? formatWaktu(p.waktuPengisian) : '-'}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Rekap_7KAIH_Sesi_${currentSesi}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });

  loadData();
});
