/**
 * Logic Form Wizard 7 KAIH
 * Menangani alur pengisian 7 kebiasaan, validasi bertahap, dan pengiriman langsung
 */

document.addEventListener('DOMContentLoaded', async () => {
  const currentUser = Auth.requireAuth('peserta');
  if (!currentUser) return;
  Auth.renderHeaderUser();

  // State Form (7 Pertanyaan, tanpa recap screen)
  let currentStep = 1;
  const totalSteps = 7;
  let activeSession = null;

  // State Jawaban
  const answers = {
    bangunPagi: '',
    ibadah: {
      lengkap: false,
      berhalangan: false,
      shubuh: false,
      dzuhur: false,
      ashar: false,
      maghrib: false,
      isya: false
    },
    olahraga: '',
    olahragaDurasi: '',
    makanSehat: '',
    gemarBelajarDurasi: '',
    gemarBelajarCatatan: '',
    bermasyarakat: '',
    tidurCepat: '',
    tidurCatatan: ''
  };

  // DOM Elements
  const initialLoader = document.getElementById('initialLoader');
  const sessionNoticeCard = document.getElementById('sessionNoticeCard');
  const noticeTitle = document.getElementById('noticeTitle');
  const noticeMessage = document.getElementById('noticeMessage');
  const formWizardCard = document.getElementById('formWizardCard');
  const doneScreenCard = document.getElementById('doneScreenCard');
  const activeSessionBadge = document.getElementById('activeSessionBadge');

  const progressBar = document.getElementById('progressBar');
  const stepTitleText = document.getElementById('stepTitleText');
  const stepCounterBadge = document.getElementById('stepCounterBadge');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const submitBtn = document.getElementById('submitBtn');
  const submitBtnText = document.getElementById('submitBtnText');
  const submitSpinner = document.getElementById('submitSpinner');
  const formAlert = document.getElementById('formAlert');

  // ==========================================
  // INITIAL VERIFICATION
  // ==========================================
  try {
    const sesiRes = await Api.cekSesi();
    if (!sesiRes.success || !sesiRes.sesiAktif) {
      initialLoader.style.display = 'none';
      noticeTitle.textContent = 'Sesi Pengisian Belum Dibuka';
      noticeMessage.textContent = 'Tidak ada sesi pengisian yang aktif hari ini. Silakan periksa kembali jadwal sesi di dashboard.';
      sessionNoticeCard.style.display = 'block';
      return;
    }

    activeSession = sesiRes.sesiAktif;
    if (activeSessionBadge) {
      activeSessionBadge.textContent = `${activeSession.nama_sesi || 'Sesi ' + activeSession.sesi} (Aktif)`;
    }

    const sudahRes = await Api.cekSudahIsi(currentUser.uid, activeSession.sesi);
    if (sudahRes.success && sudahRes.sudahIsi) {
      initialLoader.style.display = 'none';
      noticeTitle.textContent = 'Anda Sudah Mengisi Sesi Ini';
      noticeMessage.textContent = `Anda telah mengisi evaluasi pembiasaan 7 KAIH untuk ${activeSession.nama_sesi || 'Sesi ' + activeSession.sesi}. Setiap peserta hanya dapat mengirimkan form 1 kali per sesi.`;
      sessionNoticeCard.style.display = 'block';
      return;
    }

    initialLoader.style.display = 'none';
    formWizardCard.style.display = 'block';
    updateStepView();
  } catch (err) {
    initialLoader.style.display = 'none';
    noticeTitle.textContent = 'Kendala Koneksi';
    noticeMessage.textContent = 'Tidak dapat menghubungi server. Silakan muat ulang halaman.';
    sessionNoticeCard.style.display = 'block';
    return;
  }

  // ==========================================
  // STEP INTERACTION HANDLERS
  // ==========================================

  // Step 1: Bangun Pagi
  const q1Tiles = document.querySelectorAll('#q1Options .option-tile');
  q1Tiles.forEach(tile => {
    tile.addEventListener('click', () => {
      q1Tiles.forEach(t => t.classList.remove('selected'));
      tile.classList.add('selected');
      answers.bangunPagi = tile.getAttribute('data-val');
      validateCurrentStep();
    });
  });

  // Step 2: Beribadah
  const prayerMasterToggle = document.getElementById('prayerMasterToggle');
  const masterBadge = document.getElementById('masterBadge');
  const prayerTiles = document.querySelectorAll('.prayer-tile');
  const prayerBerhalanganToggle = document.getElementById('prayerBerhalanganToggle');

  // Deteksi Jenis Kelamin Siswa
  const isFemale = Auth.isFemale(currentUser);

  // Opsi Sedang Berhalangan: HANYA TAMPIL JIKA PEREMPUAN
  if (prayerBerhalanganToggle) {
    if (isFemale) {
      prayerBerhalanganToggle.style.display = 'flex';
      prayerBerhalanganToggle.addEventListener('click', () => {
        const isSelected = prayerBerhalanganToggle.classList.contains('selected');
        if (!isSelected) {
          prayerBerhalanganToggle.classList.add('selected');
          answers.ibadah.berhalangan = true;

          // Reset dan bersihkan pilihan shalat fardhu
          prayerTiles.forEach(t => t.classList.remove('selected'));
          prayerMasterToggle.classList.remove('selected');
          masterBadge.style.display = 'none';
          answers.ibadah.lengkap = false;
          answers.ibadah.shubuh = false;
          answers.ibadah.dzuhur = false;
          answers.ibadah.ashar = false;
          answers.ibadah.maghrib = false;
          answers.ibadah.isya = false;
        } else {
          prayerBerhalanganToggle.classList.remove('selected');
          answers.ibadah.berhalangan = false;
        }
        validateCurrentStep();
      });
    } else {
      // Siswa Laki-laki: Sembunyikan total dan kunci false
      prayerBerhalanganToggle.style.display = 'none';
      answers.ibadah.berhalangan = false;
    }
  }

  function updatePrayerStatus() {
    const allSelected = Array.from(prayerTiles).every(t => t.classList.contains('selected'));

    if (allSelected) {
      prayerMasterToggle.classList.add('selected');
      masterBadge.style.display = 'inline-block';
      answers.ibadah.lengkap = true;
    } else {
      prayerMasterToggle.classList.remove('selected');
      masterBadge.style.display = 'none';
      answers.ibadah.lengkap = false;
    }

    prayerTiles.forEach(tile => {
      const pName = tile.getAttribute('data-prayer');
      answers.ibadah[pName] = tile.classList.contains('selected');
    });

    // Jika memilih shalat, batalkan status berhalangan
    if (answers.ibadah.lengkap || Array.from(prayerTiles).some(t => t.classList.contains('selected'))) {
      if (prayerBerhalanganToggle) prayerBerhalanganToggle.classList.remove('selected');
      answers.ibadah.berhalangan = false;
    }

    validateCurrentStep();
  }

  prayerMasterToggle.addEventListener('click', () => {
    const isCurrentlyComplete = prayerMasterToggle.classList.contains('selected');
    if (!isCurrentlyComplete) {
      prayerTiles.forEach(t => t.classList.add('selected'));
    } else {
      prayerTiles.forEach(t => t.classList.remove('selected'));
    }
    updatePrayerStatus();
  });

  prayerTiles.forEach(tile => {
    tile.addEventListener('click', () => {
      tile.classList.toggle('selected');
      updatePrayerStatus();
    });
  });

  // Step 3: Olahraga
  const q3Tiles = document.querySelectorAll('#q3OlahragaToggle .option-tile');
  const q3SubPanel = document.getElementById('q3SubPanel');
  const q3DurasiTiles = document.querySelectorAll('#q3DurasiOptions .option-tile');

  q3Tiles.forEach(tile => {
    tile.addEventListener('click', () => {
      q3Tiles.forEach(t => t.classList.remove('selected'));
      tile.classList.add('selected');
      const val = tile.getAttribute('data-val');
      answers.olahraga = val;

      if (val === 'Ya') {
        q3SubPanel.classList.add('open');
        // Validasi apakah durasi sudah dipilih sebelumnya
        const selectedDurasi = document.querySelector('#q3DurasiOptions .option-tile.selected');
        answers.olahragaDurasi = selectedDurasi ? selectedDurasi.getAttribute('data-durasi') : '';
      } else {
        q3SubPanel.classList.remove('open');
        answers.olahragaDurasi = '-';
        q3DurasiTiles.forEach(t => t.classList.remove('selected'));
      }
      validateCurrentStep();
    });
  });

  q3DurasiTiles.forEach(tile => {
    tile.addEventListener('click', () => {
      q3DurasiTiles.forEach(t => t.classList.remove('selected'));
      tile.classList.add('selected');
      answers.olahragaDurasi = tile.getAttribute('data-durasi');
      validateCurrentStep();
    });
  });

  // Step 4: Makan Sehat Bergizi
  const q4Tiles = document.querySelectorAll('#q4Options .option-tile');
  q4Tiles.forEach(tile => {
    tile.addEventListener('click', () => {
      q4Tiles.forEach(t => t.classList.remove('selected'));
      tile.classList.add('selected');
      answers.makanSehat = tile.getAttribute('data-val');
      validateCurrentStep();
    });
  });

  // Step 5: Gemar Belajar
  const q5Tiles = document.querySelectorAll('#q5Options .option-tile');
  const q5Notes = document.getElementById('q5Notes');
  q5Tiles.forEach(tile => {
    tile.addEventListener('click', () => {
      q5Tiles.forEach(t => t.classList.remove('selected'));
      tile.classList.add('selected');
      answers.gemarBelajarDurasi = tile.getAttribute('data-val');
      validateCurrentStep();
    });
  });

  q5Notes.addEventListener('input', () => {
    answers.gemarBelajarCatatan = q5Notes.value.trim();
  });

  // Step 6: Bermasyarakat
  const q6Tiles = document.querySelectorAll('#q6Options .option-tile');
  q6Tiles.forEach(tile => {
    tile.addEventListener('click', () => {
      q6Tiles.forEach(t => t.classList.remove('selected'));
      tile.classList.add('selected');
      answers.bermasyarakat = tile.getAttribute('data-val');
      validateCurrentStep();
    });
  });

  // Step 7: Tidur Cepat
  const q7Tiles = document.querySelectorAll('#q7Options .option-tile');
  const q7Notes = document.getElementById('q7Notes');
  q7Tiles.forEach(tile => {
    tile.addEventListener('click', () => {
      q7Tiles.forEach(t => t.classList.remove('selected'));
      tile.classList.add('selected');
      answers.tidurCepat = tile.getAttribute('data-val');
      validateCurrentStep();
    });
  });

  q7Notes.addEventListener('input', () => {
    answers.tidurCatatan = q7Notes.value.trim();
  });

  // ==========================================
  // WIZARD NAVIGATION & VALIDATION
  // ==========================================

  function validateCurrentStep() {
    let isValid = false;

    switch (currentStep) {
      case 1:
        isValid = answers.bangunPagi !== '';
        break;
      case 2:
        if (isFemale) {
          isValid = answers.ibadah.berhalangan || answers.ibadah.shubuh || answers.ibadah.dzuhur || answers.ibadah.ashar || answers.ibadah.maghrib || answers.ibadah.isya || answers.ibadah.lengkap;
        } else {
          // Laki-laki: Tidak ada opsi berhalangan, wajib memilih ibadah shalat
          isValid = answers.ibadah.shubuh || answers.ibadah.dzuhur || answers.ibadah.ashar || answers.ibadah.maghrib || answers.ibadah.isya || answers.ibadah.lengkap;
        }
        break;
      case 3:
        if (answers.olahraga === 'Tidak') {
          isValid = true;
        } else if (answers.olahraga === 'Ya') {
          isValid = answers.olahragaDurasi !== '' && answers.olahragaDurasi !== '-';
        }
        break;
      case 4:
        isValid = answers.makanSehat !== '';
        break;
      case 5:
        isValid = answers.gemarBelajarDurasi !== '';
        break;
      case 6:
        isValid = answers.bermasyarakat !== '';
        break;
      case 7:
        isValid = answers.tidurCepat !== '';
        break;
    }

    if (currentStep < totalSteps) {
      nextBtn.disabled = !isValid;
    } else {
      submitBtn.disabled = !isValid;
    }
    return isValid;
  }

  function updateStepView() {
    document.querySelectorAll('.step-pane').forEach(p => p.classList.remove('active'));

    const activePane = document.querySelector(`.step-pane[data-step="${currentStep}"]`);
    if (activePane) {
      activePane.classList.add('active');
    }

    const progressPercent = (currentStep / totalSteps) * 100;
    progressBar.style.width = `${progressPercent}%`;

    stepTitleText.textContent = `Kebiasaan ${currentStep} dari ${totalSteps}`;
    stepCounterBadge.textContent = `${currentStep} / ${totalSteps}`;

    if (currentStep < totalSteps) {
      nextBtn.style.display = 'inline-flex';
      submitBtn.style.display = 'none';
    } else {
      nextBtn.style.display = 'none';
      submitBtn.style.display = 'inline-flex';
    }

    prevBtn.style.visibility = currentStep > 1 ? 'visible' : 'hidden';

    validateCurrentStep();
    formWizardCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  nextBtn.addEventListener('click', () => {
    if (validateCurrentStep()) {
      if (currentStep < totalSteps) {
        currentStep++;
        updateStepView();
      }
    }
  });

  prevBtn.addEventListener('click', () => {
    if (currentStep > 1) {
      currentStep--;
      updateStepView();
    }
  });

  // ==========================================
  // DIRECT SUBMIT HANDLER (STEP 7)
  // ==========================================
  submitBtn.addEventListener('click', async () => {
    if (!validateCurrentStep()) return;

    // Proteksi data: Jika siswa laki-laki, opsi berhalangan mutlak false
    if (!isFemale) {
      answers.ibadah.berhalangan = false;
    }

    // Proteksi data: Jika ibadah lengkap atau ada shalat dipilih, berhalangan PASTI false
    if (answers.ibadah.lengkap || answers.ibadah.shubuh || answers.ibadah.dzuhur || answers.ibadah.ashar || answers.ibadah.maghrib || answers.ibadah.isya) {
      answers.ibadah.berhalangan = false;
    }
    if (answers.ibadah.berhalangan) {
      answers.ibadah.lengkap = false;
      answers.ibadah.shubuh = false;
      answers.ibadah.dzuhur = false;
      answers.ibadah.ashar = false;
      answers.ibadah.maghrib = false;
      answers.ibadah.isya = false;
    }

    formAlert.style.display = 'none';
    formAlert.textContent = '';

    submitBtn.disabled = true;
    prevBtn.disabled = true;
    submitBtnText.textContent = 'Menyimpan...';
    submitSpinner.style.display = 'inline-block';

    try {
      const response = await Api.submit(currentUser.uid, activeSession.sesi, answers);

      if (response.success) {
        formWizardCard.style.display = 'none';
        doneScreenCard.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        formAlert.textContent = response.message || 'Gagal menyimpan jawaban. Silakan coba kembali.';
        formAlert.style.display = 'block';
        submitBtn.disabled = false;
        prevBtn.disabled = false;
        submitBtnText.textContent = 'Kirim Jawaban';
        submitSpinner.style.display = 'none';
      }
    } catch (err) {
      formAlert.textContent = 'Terjadi gangguan jaringan saat mengirim data.';
      formAlert.style.display = 'block';
      submitBtn.disabled = false;
      prevBtn.disabled = false;
      submitBtnText.textContent = 'Kirim Jawaban';
      submitSpinner.style.display = 'none';
    }
  });
});
