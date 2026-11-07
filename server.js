const express = require('express');
const nodemailer = require('nodemailer');
const path = require('path');
const { janaSijilPDF } = require('./templates/sijil');

const app = express();
const PORT = 3000;

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Data in-memory (gantikan dengan DB sebenar untuk produksi) ───────────────
const pesertaData = require('./data/peserta.json');

// Storan sementara untuk OTP: { "ic|emel": { kod, expiry } }
const otpStore = {};

// ── Konfigurasi emel (gantikan dengan SMTP sebenar) ──────────────────────────
// Untuk ujian, gunakan Ethereal (https://ethereal.email/) atau SMTP sebenar
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'your-ethereal-user@ethereal.email',
    pass: process.env.SMTP_PASS || 'your-ethereal-pass'
  }
});

// ── Fungsi pembantu ──────────────────────────────────────────────────────────
function cariPeserta(ic, emel) {
  return pesertaData.find(
    p => p.ic === ic.replace(/-/g, '') && p.emel.toLowerCase() === emel.toLowerCase()
  );
}

function janaKodOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function maskEmel(emel) {
  const parts = emel.split('@');
  const user  = parts[0];
  const domain = parts[1] || '';
  return `${user.charAt(0)}***@${domain}`;
}

// ── ROUTE 1: Minta OTP ───────────────────────────────────────────────────────
// POST /api/minta-otp
// Body: { ic, emel }
app.post('/api/minta-otp', async (req, res) => {
  const { ic, emel } = req.body;

  if (!ic || !emel) {
    return res.status(400).json({ berjaya: false, mesej: 'No. K/P dan emel diperlukan.' });
  }

  const peserta = cariPeserta(ic, emel);
  if (!peserta) {
    return res.status(404).json({
      berjaya: false,
      mesej: 'Rekod tidak dijumpai. Sila semak semula No. K/P dan emel anda.'
    });
  }

  const kod = janaKodOTP();
  const expiry = Date.now() + 10 * 60 * 1000; // sah 10 minit
  const kunci = `${ic}|${emel.toLowerCase()}`;
  otpStore[kunci] = { kod, expiry };

  // Hantar emel OTP
  try {
    await transporter.sendMail({
      from: '"Sistem e-Sijil KKS2" <esijil@kklw.gov.my>',
      to: peserta.emel,
      subject: 'Kod Pengesahan e-Sijil KKS2',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;border:1px solid #ddd;border-radius:8px;overflow:hidden;">
          <div style="background:#1a3a6b;padding:20px;text-align:center;">
            <h2 style="color:#fff;margin:0;">Sistem e-Sijil KKS2</h2>
            <p style="color:#a0c4ff;margin:4px 0 0;">Kementerian Kemajuan Luar Bandar dan Wilayah</p>
          </div>
          <div style="padding:28px;">
            <p>Salam <strong>${peserta.nama}</strong>,</p>
            <p>Kod pengesahan anda untuk mengakses e-Sijil adalah:</p>
            <div style="background:#f0f4ff;border:2px solid #1a3a6b;border-radius:8px;padding:18px;text-align:center;margin:20px 0;">
              <span style="font-size:36px;font-weight:bold;letter-spacing:10px;color:#1a3a6b;">${kod}</span>
            </div>
            <p style="color:#666;font-size:13px;">⏰ Kod ini <strong>sah selama 10 minit</strong> sahaja.</p>
            <p style="color:#666;font-size:13px;">Jika anda tidak membuat permintaan ini, abaikan emel ini.</p>
          </div>
          <div style="background:#f7f7f7;padding:14px;text-align:center;font-size:12px;color:#999;">
            © ${new Date().getFullYear()} Kementerian Kemajuan Luar Bandar dan Wilayah • kklw.gov.my
          </div>
        </div>
      `
    });

    console.log(`[OTP] Kod ${kod} dihantar ke ${peserta.emel}`);

    res.json({
      berjaya: true,
      mesej: `Kod pengesahan telah dihantar ke emel ${maskEmel(peserta.emel)}.`
    });
  } catch (err) {
    console.error('[OTP] Gagal hantar emel:', err.message);
    // Dalam mod pembangunan, kembalikan kod terus (BUANG dalam produksi!)
    res.json({
      berjaya: true,
      mesej: `[MOD PEMBANGUNAN] Kod OTP anda: ${kod}`,
      _kod_dev: kod
    });
  }
});

// ── ROUTE 2: Cari e-Sijil (sahkan OTP + pulangkan senarai kursus) ────────────
// POST /api/cari-sijil
// Body: { ic, emel, kod }
app.post('/api/cari-sijil', (req, res) => {
  const { ic, emel, kod } = req.body;

  if (!ic || !emel || !kod) {
    return res.status(400).json({ berjaya: false, mesej: 'Semua medan diperlukan.' });
  }

  const kunci = `${ic}|${emel.toLowerCase()}`;
  const rekodOTP = otpStore[kunci];

  if (!rekodOTP) {
    return res.status(400).json({ berjaya: false, mesej: 'Sila minta kod pengesahan terlebih dahulu.' });
  }
  if (Date.now() > rekodOTP.expiry) {
    delete otpStore[kunci];
    return res.status(400).json({ berjaya: false, mesej: 'Kod pengesahan telah tamat tempoh. Sila minta semula.' });
  }
  if (rekodOTP.kod !== kod.trim()) {
    return res.status(400).json({ berjaya: false, mesej: 'Kod pengesahan tidak sah.' });
  }

  // OTP sah — padamkan dari store
  delete otpStore[kunci];

  const peserta = cariPeserta(ic, emel);
  if (!peserta) {
    return res.status(404).json({ berjaya: false, mesej: 'Rekod peserta tidak dijumpai.' });
  }

  res.json({
    berjaya: true,
    nama: peserta.nama,
    ic: peserta.ic,
    kursus: peserta.kursus.map(k => ({
      id: k.id,
      nama_kursus: k.nama_kursus,
      tarikh_mula: k.tarikh_mula,
      tarikh_tamat: k.tarikh_tamat,
      tempat: k.tempat,
      jam_kredit: k.jam_kredit
    }))
  });
});

// ── ROUTE 3: Muat turun sijil PDF ────────────────────────────────────────────
// GET /api/muat-turun/:kursusId?ic=...&nama=...
app.get('/api/muat-turun/:kursusId', (req, res) => {
  const { kursusId } = req.params;
  const { ic } = req.query;

  if (!ic) {
    return res.status(400).json({ mesej: 'Parameter ic diperlukan.' });
  }

  // Cari peserta berdasarkan ic sahaja (OTP sudah disahkan di langkah sebelum)
  const peserta = pesertaData.find(p => p.ic === ic.replace(/-/g, ''));
  if (!peserta) {
    return res.status(404).json({ mesej: 'Peserta tidak dijumpai.' });
  }

  const kursus = peserta.kursus.find(k => k.id === kursusId);
  if (!kursus) {
    return res.status(404).json({ mesej: 'Kursus tidak dijumpai untuk peserta ini.' });
  }

  try {
    janaSijilPDF(peserta, kursus, res);
  } catch (err) {
    console.error('[PDF] Gagal jana sijil:', err.message);
    res.status(500).json({ mesej: 'Gagal menjana sijil PDF.' });
  }
});

// ── Mulakan pelayan ──────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✅ Pelayan e-Sijil KKS2 berjalan di http://localhost:${PORT}`);
  console.log(`   Tekan Ctrl+C untuk berhenti.\n`);
});
