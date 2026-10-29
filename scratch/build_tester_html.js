const fs = require('fs');

const students = JSON.parse(fs.readFileSync('scratch/students_full.json', 'utf8'));

const htmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Simulasi & Pengujian Otomatis Database 7 KAIH</title>
  <link rel="stylesheet" href="css/style.css">
  <style>
    .tester-container {
      max-width: 960px;
      margin: 2rem auto;
      padding: 0 1rem;
    }
    .status-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.25rem 1.5rem;
      border-radius: var(--radius-lg);
      margin-bottom: 1.5rem;
      border: 1px solid var(--gray-200);
      background: var(--white);
      box-shadow: var(--shadow-sm);
    }
    .switch-wrap {
      display: flex;
      align-items: center;
      gap: 0.85rem;
    }
    .toggle-switch {
      position: relative;
      display: inline-block;
      width: 52px;
      height: 28px;
    }
    .toggle-switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    .toggle-slider {
      position: absolute;
      cursor: pointer;
      top: 0; left: 0; right: 0; bottom: 0;
      background-color: var(--gray-300);
      transition: .3s;
      border-radius: 34px;
    }
    .toggle-slider:before {
      position: absolute;
      content: "";
      height: 20px;
      width: 20px;
      left: 4px;
      bottom: 4px;
      background-color: white;
      transition: .3s;
      border-radius: 50%;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }
    input:checked + .toggle-slider {
      background-color: var(--success);
    }
    input:checked + .toggle-slider:before {
      transform: translateX(24px);
    }
    .status-text {
      font-weight: 700;
      font-size: 0.95rem;
      letter-spacing: 0.02em;
    }
    .status-active-badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: var(--radius-full);
      font-size: 0.8rem;
      font-weight: 600;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.25rem;
      margin-bottom: 1.5rem;
    }
    @media (max-width: 768px) {
      .grid-2 { grid-template-columns: 1fr; }
    }
    .stat-box {
      background: var(--white);
      padding: 1rem 1.25rem;
      border-radius: var(--radius-md);
      border: 1px solid var(--gray-200);
      text-align: center;
    }
    .stat-number {
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--gray-900);
      line-height: 1.2;
    }
    .stat-label {
      font-size: 0.775rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--gray-500);
      margin-top: 0.25rem;
    }
    .console-log {
      background: #0f172a;
      color: #e2e8f0;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 0.8rem;
      line-height: 1.5;
      padding: 1rem;
      border-radius: var(--radius-md);
      height: 320px;
      overflow-y: auto;
      border: 1px solid #1e293b;
    }
    .log-line {
      margin-bottom: 0.25rem;
      word-break: break-all;
    }
    .log-ok { color: #34d399; }
    .log-skip { color: #fbbf24; }
    .log-fail { color: #f87171; }
    .log-info { color: #60a5fa; }
    .progress-bar-bg {
      width: 100%;
      height: 8px;
      background: var(--gray-200);
      border-radius: var(--radius-full);
      overflow: hidden;
      margin-top: 0.75rem;
    }
    .progress-bar-fill {
      height: 100%;
      width: 0%;
      background: var(--primary);
      transition: width 0.2s ease;
    }
  </style>
</head>
<body>
  <header class="app-header">
    <div class="header-inner">
      <div class="brand">
        <div class="brand-badge">PENGUJIAN & SIMULASI</div>
        <div class="brand-text">
          <h1>Tester Otomatis Database 7 KAIH</h1>
          <p>VERTIKAL SMA 2026 &bull; Pengujian Pengisian Acak 357 Siswa</p>
        </div>
      </div>
      <div style="display: flex; gap: 0.5rem;">
        <a href="admin.html" class="btn btn-outline" style="padding: 0.4rem 0.85rem; font-size: 0.85rem;">Panel Admin</a>
        <a href="dashboard.html" class="btn btn-outline" style="padding: 0.4rem 0.85rem; font-size: 0.85rem;">Dashboard Siswa</a>
      </div>
    </div>
  </header>

  <main class="tester-container">
    <!-- Status Switch Card -->
    <div class="status-banner">
      <div>
        <div style="font-size: 0.775rem; color: var(--gray-500); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Saklar Keamanan Database</div>
        <div style="display: flex; align-items: center; gap: 0.75rem; margin-top: 0.35rem;">
          <span class="status-text" id="statusLabel">STATUS: AKTIF</span>
          <span class="status-active-badge" id="statusBadge" style="background: var(--success-light); color: var(--success-dark);">Siap Mengirim</span>
        </div>
        <p style="font-size: 0.8rem; color: var(--gray-500); margin-top: 0.25rem;">
          Gunakan saklar di samping untuk mengaktifkan atau mematikan fitur pengisian otomatis kapan saja.
        </p>
      </div>
      <div class="switch-wrap">
        <label class="toggle-switch">
          <input type="checkbox" id="mainToggle" checked>
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>

    <!-- Configuration & Control Card -->
    <div class="card" style="margin-bottom: 1.5rem;">
      <h3 style="font-size: 1.05rem; font-weight: 600; margin-bottom: 1rem; color: var(--gray-900);">Pengaturan Simulasi Pengujian</h3>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.25rem;">
        <div class="form-group">
          <label class="form-label" for="sesiSelect">Target Sesi Pengisian</label>
          <select id="sesiSelect" class="form-control">
            <option value="1" selected>Sesi 1 (Minggu ke-1)</option>
            <option value="2">Sesi 2 (Minggu ke-1)</option>
            <option value="3">Sesi 3 (Minggu ke-2)</option>
            <option value="4">Sesi 4 (Minggu ke-2)</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label" for="countSelect">Jumlah Akun yang Diuji</label>
          <select id="countSelect" class="form-control">
            <option value="10" selected>10 Siswa (Uji Coba Cepat)</option>
            <option value="30">30 Siswa (1 Kelas)</option>
            <option value="100">100 Siswa</option>
            <option value="357">Seluruh 357 Siswa</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label" for="delayRange">Jeda Antar Pengiriman: <span id="delayLabel" style="font-weight: 700; color: var(--primary);">350 ms</span></label>
          <input type="range" id="delayRange" min="200" max="1500" step="50" value="350" style="width: 100%; margin-top: 0.5rem;">
        </div>
      </div>

      <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
        <button id="startBtn" class="btn btn-primary" style="padding: 0.65rem 1.5rem;">
          Mulai Pengisian Otomatis
        </button>
        <button id="stopBtn" class="btn btn-outline" style="padding: 0.65rem 1.5rem; color: var(--danger); border-color: var(--danger);" disabled>
          Hentikan / Nonaktifkan
        </button>
        <button id="clearLogBtn" class="btn btn-outline" style="padding: 0.65rem 1rem;">
          Bersihkan Log
        </button>
      </div>

      <div style="margin-top: 1rem;">
        <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: var(--gray-600); font-weight: 500;">
          <span id="progressText">Progress: 0 / 0 Siswa (0%)</span>
          <span id="speedText">Status: Standby</span>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" id="progressBar"></div>
        </div>
      </div>
    </div>

    <!-- Real-time Stats Grid -->
    <div class="grid-2">
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem;">
        <div class="stat-box">
          <div class="stat-number" id="statSuccess" style="color: var(--success);">0</div>
          <div class="stat-label">Berhasil</div>
        </div>
        <div class="stat-box">
          <div class="stat-number" id="statSkip" style="color: var(--accent);">0</div>
          <div class="stat-label">Sudah Ada (Skip)</div>
        </div>
        <div class="stat-box">
          <div class="stat-number" id="statFail" style="color: var(--danger);">0</div>
          <div class="stat-label">Gagal</div>
        </div>
      </div>

      <div class="stat-box" style="display: flex; flex-direction: column; justify-content: center; text-align: left; padding: 1rem 1.5rem;">
        <div style="font-size: 0.8rem; color: var(--gray-500); margin-bottom: 0.35rem;">Koneksi Google Apps Script</div>
        <div style="font-size: 0.85rem; font-weight: 600; color: var(--gray-800); word-break: break-all;" id="endpointInfo">Memeriksa...</div>
      </div>
    </div>

    <!-- Live Log Console -->
    <div class="card" style="padding: 1rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
        <span style="font-size: 0.85rem; font-weight: 600; color: var(--gray-700);">Live Console Log (Aktivitas Pengiriman)</span>
        <span style="font-size: 0.75rem; color: var(--gray-500);">Auto-scroll aktif</span>
      </div>
      <div class="console-log" id="consoleLog">
        <div class="log-line log-info">[INFO] Simulator siap digunakan. Pastikan status dalam posisi AKTIF lalu klik "Mulai Pengisian Otomatis".</div>
      </div>
    </div>
  </main>

  <script src="js/config.js"></script>
  <script>
    // DATA 357 SISWA LENGKAP
    const ALL_STUDENTS = ` + JSON.stringify(students) + `;

    // Opsi Jawaban Realistis 7 KAIH
    const CHOICES = {
      bangunPagi: ['Sebelum 04.00', '04.00–04.30', '04.30–05.00', '05.00–05.30', '05.30–06.00', 'Setelah 06.00'],
      olahragaDurasi: ['<20 mnt', '20–30 mnt', '>30 mnt'],
      makanSehat: ['Selalu', 'Kadang', 'Tidak'],
      gemarBelajarDurasi: ['0', '<30 mnt', '30–60 mnt', '>60 mnt'],
      gemarBelajarCatatan: [
        'Latihan soal Matematika dan persiapan ujian',
        'Membaca materi Biologi Bab 3',
        'Merangkum materi Sejarah Kebangsaan',
        'Mengerjakan tugas Fisika materi Dinamika Gerak',
        'Latihan soal UTBK / SNBT penalaran matematika',
        'Membaca modul Kimia ikatan kimia',
        'Belajar mandiri Bahasa Inggris grammar dan reading',
        'Mengulang materi pelajaran tadi pagi'
      ],
      bermasyarakat: ['Ya', 'Tidak'],
      tidurCepat: ['Sebelum 21.00', '21–22.00', '22–23.00', 'Setelah 23.00'],
      tidurCatatan: [
        'Alhamdulillah seluruh target kegiatan hari ini tercapai',
        'Hari ini cukup padat, perlu istirahat lebih cukup',
        'Besok bangun lebih awal untuk persiapan piket kelas',
        'Evaluasi diri: perlu kurangi screen time sebelum tidur',
        'Hari yang produktif dan menyenangkan'
      ]
    };

    function getRandomItem(arr) {
      return arr[Math.floor(Math.random() * arr.length)];
    }

    function generateRandomAnswers(student) {
      const bangunPagi = getRandomItem(CHOICES.bangunPagi);
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

      const isOlahraga = Math.random() < 0.75;
      const olahraga = isOlahraga ? 'Ya' : 'Tidak';
      const olahragaDurasi = isOlahraga ? getRandomItem(CHOICES.olahragaDurasi) : '-';
      const makanSehat = Math.random() < 0.65 ? 'Selalu' : (Math.random() < 0.75 ? 'Kadang' : 'Tidak');
      const gemarBelajarDurasi = getRandomItem(CHOICES.gemarBelajarDurasi);
      const gemarBelajarCatatan = (gemarBelajarDurasi !== '0' && Math.random() < 0.7) ? getRandomItem(CHOICES.gemarBelajarCatatan) : '';
      const bermasyarakat = Math.random() < 0.80 ? 'Ya' : 'Tidak';
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

    // STATE VARIABLES
    let isRunning = false;
    let shouldStop = false;
    let isEnabled = true;

    // DOM ELEMENTS
    const mainToggle = document.getElementById('mainToggle');
    const statusLabel = document.getElementById('statusLabel');
    const statusBadge = document.getElementById('statusBadge');
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const clearLogBtn = document.getElementById('clearLogBtn');
    const sesiSelect = document.getElementById('sesiSelect');
    const countSelect = document.getElementById('countSelect');
    const delayRange = document.getElementById('delayRange');
    const delayLabel = document.getElementById('delayLabel');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const speedText = document.getElementById('speedText');
    const statSuccess = document.getElementById('statSuccess');
    const statSkip = document.getElementById('statSkip');
    const statFail = document.getElementById('statFail');
    const consoleLog = document.getElementById('consoleLog');
    const endpointInfo = document.getElementById('endpointInfo');

    endpointInfo.textContent = CONFIG.SCRIPT_URL ? CONFIG.SCRIPT_URL.substring(0, 55) + '...' : 'Belum diisi';

    // TOGGLE EVENT
    mainToggle.addEventListener('change', () => {
      isEnabled = mainToggle.checked;
      if (isEnabled) {
        statusLabel.textContent = 'STATUS: AKTIF';
        statusLabel.style.color = 'var(--gray-900)';
        statusBadge.textContent = 'Siap Mengirim';
        statusBadge.style.background = 'var(--success-light)';
        statusBadge.style.color = 'var(--success-dark)';
        startBtn.disabled = isRunning;
        addLog('[INFO] Fitur pengisian otomatis DIAKTIFKAN.', 'log-info');
      } else {
        statusLabel.textContent = 'STATUS: NONAKTIF';
        statusLabel.style.color = 'var(--danger)';
        statusBadge.textContent = 'Terkunci (Off)';
        statusBadge.style.background = 'var(--danger-light)';
        statusBadge.style.color = 'var(--danger)';
        startBtn.disabled = true;
        if (isRunning) {
          shouldStop = true;
          addLog('[PERINGATAN] Saklar dimatikan! Menghentikan pengisian otomatis yang sedang berjalan...', 'log-fail');
        } else {
          addLog('[INFO] Fitur pengisian otomatis DINONAKTIFKAN. Tombol Mulai terkunci.', 'log-fail');
        }
      }
    });

    delayRange.addEventListener('input', () => {
      delayLabel.textContent = delayRange.value + ' ms';
    });

    clearLogBtn.addEventListener('click', () => {
      consoleLog.innerHTML = '';
    });

    function addLog(text, className = '') {
      const line = document.createElement('div');
      line.className = 'log-line ' + className;
      const time = new Date().toLocaleTimeString('id-ID');
      line.textContent = '[' + time + '] ' + text;
      consoleLog.appendChild(line);
      consoleLog.scrollTop = consoleLog.scrollHeight;
    }

    const sleep = ms => new Promise(r => setTimeout(r, ms));

    // START TEST RUNNER
    startBtn.addEventListener('click', async () => {
      if (!isEnabled) {
        alert('Fitur pengisian otomatis sedang nonaktif. Silakan aktifkan saklar terlebih dahulu!');
        return;
      }
      if (!CONFIG.SCRIPT_URL) {
        alert('SCRIPT_URL belum dikonfigurasi di js/config.js');
        return;
      }

      const targetSesi = sesiSelect.value;
      const count = parseInt(countSelect.value, 10);
      const delay = parseInt(delayRange.value, 10);
      const targetList = ALL_STUDENTS.slice(0, count);

      isRunning = true;
      shouldStop = false;
      startBtn.disabled = true;
      stopBtn.disabled = false;
      sesiSelect.disabled = true;
      countSelect.disabled = true;

      statSuccess.textContent = '0';
      statSkip.textContent = '0';
      statFail.textContent = '0';
      progressBar.style.width = '0%';
      speedText.textContent = 'Status: Berjalan...';

      addLog('====================================================', 'log-info');
      addLog('MEMULAI PENGISIAN: Sesi ' + targetSesi + ' | ' + targetList.length + ' Siswa | Jeda ' + delay + 'ms', 'log-info');
      addLog('====================================================', 'log-info');

      let successCount = 0;
      let skipCount = 0;
      let failCount = 0;
      const startTime = Date.now();

      for (let i = 0; i < targetList.length; i++) {
        if (shouldStop || !isEnabled) {
          addLog('[BERHENTI] Proses pengujian dihentikan oleh pengguna.', 'log-fail');
          break;
        }

        const student = targetList[i];
        const seq = String(i + 1).padStart(3, '0');
        const answers = generateRandomAnswers(student);

        const payload = {
          action: 'submit',
          uid: student.uid,
          sesi: targetSesi,
          answers: answers
        };

        const studentInfo = '[' + seq + '/' + targetList.length + '] ' + student.uid + ' - ' + student.nama.substring(0, 22) + ' (' + student.kelas + ')';

        try {
          const res = await fetch(CONFIG.SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
          });
          const data = await res.json();

          if (data.success) {
            successCount++;
            statSuccess.textContent = successCount;
            addLog(studentInfo + ' -> BERHASIL (' + (data.submissionId || 'OK') + ')', 'log-ok');
          } else {
            if (data.message && data.message.includes('sudah pernah mengisi')) {
              skipCount++;
              statSkip.textContent = skipCount;
              addLog(studentInfo + ' -> SKIP (Sudah isi Sesi ' + targetSesi + ')', 'log-skip');
            } else {
              failCount++;
              statFail.textContent = failCount;
              addLog(studentInfo + ' -> GAGAL (' + data.message + ')', 'log-fail');
            }
          }
        } catch (err) {
          failCount++;
          statFail.textContent = failCount;
          addLog(studentInfo + ' -> ERROR KONEKSI (' + err.message + ')', 'log-fail');
        }

        const percent = Math.round(((i + 1) / targetList.length) * 100);
        progressBar.style.width = percent + '%';
        progressText.textContent = 'Progress: ' + (i + 1) + ' / ' + targetList.length + ' Siswa (' + percent + '%)';

        if (i < targetList.length - 1 && delay > 0) {
          await sleep(delay);
        }
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      isRunning = false;
      startBtn.disabled = !isEnabled;
      stopBtn.disabled = true;
      sesiSelect.disabled = false;
      countSelect.disabled = false;
      speedText.textContent = 'Status: Selesai (' + elapsed + ' detik)';

      addLog('====================================================', 'log-info');
      addLog('RINGKASAN: Selesai ' + targetList.length + ' siswa | ' + successCount + ' Berhasil | ' + skipCount + ' Skip | ' + failCount + ' Gagal (' + elapsed + 's)', 'log-info');
      addLog('====================================================', 'log-info');
    });

    // STOP BUTTON
    stopBtn.addEventListener('click', () => {
      shouldStop = true;
      addLog('[AKSI] Meminta penghentian simulasi...', 'log-fail');
      stopBtn.disabled = true;
    });
  </script>
</body>
</html>
`;

fs.writeFileSync('auto_test.html', htmlContent, 'utf8');
console.log('auto_test.html created! Size:', (htmlContent.length / 1024).toFixed(2), 'KB');
