/* ═══════════════════════════════════════════════════════════════════════════
   app.js — Logik Frontend e-Sijil KKS2
   ═══════════════════════════════════════════════════════════════════════════ */

// ── State ────────────────────────────────────────────────────────────────────
const state = {
  fasa: 'minta-otp',   // 'minta-otp' | 'sahkan-otp' | 'hasil'
  emel: '',
  nama: '',
  kursus: []
};

// ── DOM References ────────────────────────────────────────────────────────────
const formMintaOTP      = document.getElementById('form-minta-otp');
const inputEmel         = document.getElementById('emel');
const inputKodOTP       = document.getElementById('kod-otp');
const blokOTP           = document.getElementById('blok-otp');
const btnSubmit         = document.getElementById('btn-submit');
const btnLabelSubmit    = document.getElementById('btn-label-submit');
const btnSpinner        = document.getElementById('btn-spinner');
const btnHantarSemula   = document.getElementById('btn-hantar-semula');
const mesejMaklumbalas  = document.getElementById('mesej-maklumbalas');
const seksyenCarian     = document.getElementById('seksyen-carian');
const seksyenHasil      = document.getElementById('seksyen-hasil');
const paparNama         = document.getElementById('papar-nama');
const paparIC           = document.getElementById('papar-ic');
const pesertaAvatar     = document.getElementById('peserta-avatar-initial');
const senaraiKursus     = document.getElementById('senarai-kursus');
const btnCariLagi       = document.getElementById('btn-cari-lagi');
const modalOverlay      = document.getElementById('modal-overlay');
const modalTajuk        = document.getElementById('modal-tajuk');
const modalMesej        = document.getElementById('modal-mesej');
const modalSpinner      = document.getElementById('modal-spinner');
const modalTutup        = document.getElementById('modal-tutup');
const tahunFooter       = document.getElementById('tahun-footer');

// ── Init ──────────────────────────────────────────────────────────────────────
tahunFooter.textContent = new Date().getFullYear();

// ── Form Submit ───────────────────────────────────────────────────────────────
formMintaOTP.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (state.fasa === 'minta-otp') {
    await tindakanMintaOTP();
  } else if (state.fasa === 'sahkan-otp') {
    await tindakanSahkanOTP();
  }
});

// ── Tindakan: Minta OTP ───────────────────────────────────────────────────────
async function tindakanMintaOTP() {
  const emel = inputEmel.value.trim();

  // Validasi asas
  if (!emel || !emel.includes('@')) {
    tunjukMesej('Sila masukkan alamat emel yang sah.', 'ralat');
    inputEmel.classList.add('invalid');
    return;
  }

  inputEmel.classList.remove('invalid');
  tetapkanMuatTurun(true, 'Menghantar kod…');

  try {
    const res  = await fetch('/api/minta-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emel })
    });
    const data = await res.json();

    if (data.berjaya) {
      state.emel = emel;
      state.fasa = 'sahkan-otp';

      // Tunjuk blok OTP
      blokOTP.classList.remove('hidden');
      inputEmel.disabled = true;
      btnLabelSubmit.textContent = 'Cari e-Sijil';

      let mesejTunjuk = data.mesej;
      // Mod pembangunan: tunjuk kod terus
      if (data._kod_dev) {
        mesejTunjuk += ` (Ujian: <strong>${data._kod_dev}</strong>)`;
      }
      tunjukMesej(mesejTunjuk, 'berjaya');
      inputKodOTP.focus();
    } else {
      tunjukMesej(data.mesej, 'ralat');
    }
  } catch {
    tunjukMesej('Ralat rangkaian. Sila cuba semula.', 'ralat');
  } finally {
    tetapkanMuatTurun(false);
  }
}

// ── Tindakan: Sahkan OTP + Cari Sijil ────────────────────────────────────────
async function tindakanSahkanOTP() {
  const kod = inputKodOTP.value.trim();

  if (!kod || kod.length !== 6) {
    tunjukMesej('Sila masukkan kod pengesahan 6 digit.', 'ralat');
    inputKodOTP.classList.add('invalid');
    return;
  }

  inputKodOTP.classList.remove('invalid');
  tetapkanMuatTurun(true, 'Mengesahkan…');

  try {
    const res  = await fetch('/api/cari-sijil', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emel: state.emel, kod })
    });
    const data = await res.json();

    if (data.berjaya) {
      state.nama  = data.nama;
      state.kursus = data.kursus;
      state.fasa  = 'hasil';
      paparkanHasil();
    } else {
      tunjukMesej(data.mesej, 'ralat');
    }
  } catch {
    tunjukMesej('Ralat rangkaian. Sila cuba semula.', 'ralat');
  } finally {
    tetapkanMuatTurun(false);
  }
}

// ── Papar Hasil ───────────────────────────────────────────────────────────────
function paparkanHasil() {
  // Isi maklumat peserta
  paparNama.textContent = state.nama;
  paparIC.textContent   = state.emel;
  pesertaAvatar.textContent = state.nama.charAt(0).toUpperCase();

  // Jana kad kursus
  senaraiKursus.innerHTML = '';
  state.kursus.forEach(k => {
    const kad = document.createElement('div');
    kad.className = 'kursus-kad';
    kad.innerHTML = `
      <p class="kursus-id">${escHtml(k.id)}</p>
      <p class="kursus-nama">${escHtml(k.nama_kursus)}</p>
      <div class="kursus-meta">
        <span class="meta-pill pill-tarikh">
          📅 ${formatTarikh(k.tarikh_mula)} – ${formatTarikh(k.tarikh_tamat)}
        </span>
        <span class="meta-pill pill-tempat">
          📍 ${escHtml(k.tempat)}
        </span>
        <span class="meta-pill pill-kredit">
          🏅 ${escHtml(k.jam_kredit)}
        </span>
      </div>
      <button
        class="btn btn-download"
        data-id="${escHtml(k.id)}"
        data-nama="${escHtml(k.nama_kursus)}"
      >
        ⬇ Muat Turun e-Sijil (PDF)
      </button>
    `;
    senaraiKursus.appendChild(kad);
  });

  // Event muat turun
  senaraiKursus.querySelectorAll('.btn-download').forEach(btn => {
    btn.addEventListener('click', () => {
      muatTurunSijil(btn.dataset.id, btn.dataset.nama);
    });
  });

  // Tunjuk seksyen hasil
  seksyenCarian.classList.add('hidden');
  seksyenHasil.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── Muat Turun Sijil ──────────────────────────────────────────────────────────
async function muatTurunSijil(kursusId, namaKursus) {
  tunjukModal('Sedang Menjana Sijil…', `Menyediakan e-Sijil untuk "${namaKursus}"…`);
  modalSpinner.classList.remove('hidden');
  modalTutup.classList.add('hidden');

  try {
    const url = `/api/muat-turun/${encodeURIComponent(kursusId)}?emel=${encodeURIComponent(state.emel)}`;
    const res = await fetch(url);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.mesej || 'Gagal memuat turun sijil.');
    }

    const blob   = await res.blob();
    const objURL = URL.createObjectURL(blob);
    const a      = document.createElement('a');
    a.href     = objURL;
    a.download = `eSijil_${kursusId}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objURL);

    tutupModal();
  } catch (err) {
    modalSpinner.classList.add('hidden');
    modalTutup.classList.remove('hidden');
    modalTajuk.textContent = '❌ Gagal Muat Turun';
    modalMesej.textContent = err.message || 'Sila cuba semula.';
  }
}

// ── Kembali / Reset ───────────────────────────────────────────────────────────
btnCariLagi.addEventListener('click', () => {
  resetForm();
  seksyenHasil.classList.add('hidden');
  seksyenCarian.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

function resetForm() {
  state.fasa  = 'minta-otp';
  state.emel  = '';
  state.nama  = '';
  state.kursus = [];

  formMintaOTP.reset();
  inputEmel.disabled = false;
  blokOTP.classList.add('hidden');
  mesejMaklumbalas.classList.add('hidden');
  mesejMaklumbalas.className = 'alert hidden';
  btnLabelSubmit.textContent = 'Dapatkan Kod Pengesahan';
  inputEmel.classList.remove('invalid');
  inputKodOTP.classList.remove('invalid');
}

// ── Hantar Semula OTP ─────────────────────────────────────────────────────────
btnHantarSemula.addEventListener('click', async () => {
  if (!state.emel) return;

  state.fasa = 'minta-otp';
  inputEmel.disabled = false;

  await tindakanMintaOTP();
});

// ── Modal ─────────────────────────────────────────────────────────────────────
function tunjukModal(tajuk, mesej) {
  modalTajuk.textContent = tajuk;
  modalMesej.textContent = mesej;
  modalOverlay.classList.remove('hidden');
}

function tutupModal() {
  modalOverlay.classList.add('hidden');
}

modalTutup.addEventListener('click', tutupModal);
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) tutupModal();
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function tunjukMesej(html, jenis) {
  mesejMaklumbalas.innerHTML = html;
  mesejMaklumbalas.className = `alert alert-${jenis}`;
  mesejMaklumbalas.classList.remove('hidden');
}

function tetapkanMuatTurun(aktif, label = '') {
  btnSubmit.disabled = aktif;
  btnSpinner.classList.toggle('hidden', !aktif);
  if (label) btnLabelSubmit.textContent = label;
  else if (!aktif) {
    btnLabelSubmit.textContent =
      state.fasa === 'sahkan-otp' ? 'Cari e-Sijil' : 'Dapatkan Kod Pengesahan';
  }
}

function formatTarikh(dateStr) {
  const bulan = [
    '', 'Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun',
    'Jul', 'Ogos', 'Sep', 'Okt', 'Nov', 'Dis'
  ];
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${parseInt(d)} ${bulan[parseInt(m)]} ${y}`;
}

function formatIC(ic) {
  if (ic.length === 12) {
    return `${ic.slice(0, 6)}-${ic.slice(6, 8)}-${ic.slice(8)}`;
  }
  return ic;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function maskEmel(emel) {
  const [user, domain] = emel.split('@');
  return `${user.charAt(0)}***@${domain}`;
}
