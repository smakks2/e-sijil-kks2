require('dotenv').config();

const express    = require('express');
const nodemailer = require('nodemailer');
const path       = require('path');
const mysql      = require('mysql2/promise');
const bcrypt     = require('bcryptjs');
const adminRoute = require('./routes/admin');
const { janaSijilPDF } = require('./templates/sijil');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/admin', adminRoute);

// ── Sambungan Database MySQL ─────────────────────────────────────────────────
const db = mysql.createPool({
  host:            process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT)  || 3306,
  database:        process.env.DB_NAME     || 'esijil_kks2',
  user:            process.env.DB_USER     || 'root',
  password:        process.env.DB_PASS     || '',
  waitForConnections: true,
  connectionLimit:    10,
  charset:            'utf8mb4'
});

// Uji sambungan & setup awal semasa boot
(async () => {
  try {
    const conn = await db.getConnection();
    console.log('✅ Berjaya sambung ke database MySQL');
    conn.release();

    // Hash kata laluan admin jika masih PLACEHOLDER
    const [admins] = await db.execute("SELECT id, password FROM admin WHERE username='admin'");
    if (admins.length && admins[0].password === 'PLACEHOLDER') {
      const adminPass = process.env.ADMIN_PASS || 'Admin@KKS2';
      const hashed    = await bcrypt.hash(adminPass, 10);
      await db.execute('UPDATE admin SET password=? WHERE username=?', [hashed, 'admin']);
      console.log('✅ Kata laluan admin telah ditetapkan');
    }
  } catch (err) {
    console.warn('⚠️  Gagal sambung MySQL — sistem akan guna mod fail JSON sebagai sandaran.');
    console.warn('   Ralat:', err.message);
  }
})();

// Kongsi db pool dengan route lain
app.set('db', db);

// ── Storan OTP sementara (in-memory) ────────────────────────────────────────
// Kunci: emel, Nilai: { kod, expiry }
const otpStore = {};

// ── Konfigurasi SMTP ─────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST || 'smtp.ethereal.email',
  port:   parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'your-ethereal-user@ethereal.email',
    pass: process.env.SMTP_PASS || 'your-ethereal-pass'
  }
});

// ── Fungsi pembantu ──────────────────────────────────────────────────────────

// Cari peserta berdasarkan emel (dari MySQL)
async function cariPesertaByEmel(emel) {
  try {
    const [rows] = await db.execute(
      `SELECT p.id, p.ic, p.nama, p.emel,
              k.kod AS kursus_id, k.nama_kursus, k.tarikh_mula, k.tarikh_tamat,
              k.tempat, k.penganjur, k.jam_kredit
       FROM peserta p
       LEFT JOIN pendaftaran pd ON pd.peserta_id = p.id
       LEFT JOIN kursus k       ON k.id = pd.kursus_id AND k.aktif = 1
       WHERE p.emel = ? AND p.aktif = 1
       ORDER BY k.tarikh_mula DESC`,
      [emel.toLowerCase()]
    );

    if (!rows.length) return null;

    // Susun semula: satu peserta dengan array kursus
    const peserta = {
      id:    rows[0].id,
      ic:    rows[0].ic,
      nama:  rows[0].nama,
      emel:  rows[0].emel,
      kursus: rows
        .filter(r => r.kursus_id)
        .map(r => ({
          id:           r.kursus_id,
          nama_kursus:  r.nama_kursus,
          tarikh_mula:  r.tarikh_mula instanceof Date
                          ? r.tarikh_mula.toISOString().split('T')[0]
                          : r.tarikh_mula,
          tarikh_tamat: r.tarikh_tamat instanceof Date
                          ? r.tarikh_tamat.toISOString().split('T')[0]
                          : r.tarikh_tamat,
          tempat:       r.tempat,
          penganjur:    r.penganjur,
          jam_kredit:   r.jam_kredit
        }))
    };
    return peserta;
  } catch (err) {
    console.error('[DB] Ralat cariPesertaByEmel:', err.message);
    // Sandaran kepada JSON jika DB tidak tersambung
    const pesertaData = require('./data/peserta.json');
    return pesertaData.find(p => p.emel.toLowerCase() === emel.toLowerCase()) || null;
  }
}

function janaKodOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function maskEmel(emel) {
  const parts  = emel.split('@');
  const user   = parts[0];
  const domain = parts[1] || '';
  return `${user.charAt(0)}***@${domain}`;
}

// ── ROUTE 1: Minta OTP ───────────────────────────────────────────────────────
// POST /api/minta-otp
// Body: { emel }
app.post('/api/minta-otp', async (req, res) => {
  const { emel } = req.body;

  if (!emel) {
    return res.status(400).json({ berjaya: false, mesej: 'Alamat emel diperlukan.' });
  }

  const peserta = await cariPesertaByEmel(emel);
  if (!peserta) {
    return res.status(404).json({
      berjaya: false,
      mesej: 'Emel tidak dijumpai dalam rekod. Sila hubungi penganjur program.'
    });
  }

  const kod    = janaKodOTP();
  const expiry = Date.now() + 10 * 60 * 1000; // sah 10 minit
  const kunci  = emel.toLowerCase();
  otpStore[kunci] = { kod, expiry };

  // Simpan ke otp_log (jika DB tersambung)
  try {
    const expiryDate = new Date(expiry);
    await db.execute(
      'INSERT INTO otp_log (emel, kod, expiry) VALUES (?, ?, ?)',
      [kunci, kod, expiryDate]
    );
  } catch (_) { /* Abaikan jika DB tidak tersambung */ }

  // Hantar emel OTP
  try {
    await transporter.sendMail({
      from:    '"Sistem e-Sijil KKS2" <contact_us@kksegamat2.edu.my>',
      to:      peserta.emel,
      subject: 'Kod Pengesahan e-Sijil KKS2',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;border:1px solid #ddd;border-radius:8px;overflow:hidden;">
          <div style="background:#1a3a6b;padding:20px;text-align:center;">
            <h2 style="color:#fff;margin:0;">Sistem e-Sijil KKS2</h2>
            <p style="color:#f5a623;margin:4px 0 0;font-weight:600;">Kolej Komuniti Segamat 2</p>
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
            © ${new Date().getFullYear()} Kolej Komuniti Segamat 2 • kksegamat2.mypolycc.edu.my
          </div>
        </div>
      `
    });

    console.log(`[OTP] Kod ${kod} dihantar ke ${peserta.emel}`);
    res.json({ berjaya: true, mesej: `Kod pengesahan telah dihantar ke emel ${maskEmel(peserta.emel)}.` });

  } catch (err) {
    console.error('[OTP] Gagal hantar emel:', err.message);
    // Mod pembangunan — papar kod terus
    res.json({
      berjaya:  true,
      mesej:    `[MOD PEMBANGUNAN] Kod OTP anda: ${kod}`,
      _kod_dev: kod
    });
  }
});

// ── ROUTE 2: Sahkan OTP + Cari Sijil ─────────────────────────────────────────
// POST /api/cari-sijil
// Body: { emel, kod }
app.post('/api/cari-sijil', async (req, res) => {
  const { emel, kod } = req.body;

  if (!emel || !kod) {
    return res.status(400).json({ berjaya: false, mesej: 'Emel dan kod pengesahan diperlukan.' });
  }

  const kunci    = emel.toLowerCase();
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

  // Tandakan OTP sebagai digunakan dalam DB
  try {
    await db.execute(
      'UPDATE otp_log SET digunakan = 1 WHERE emel = ? AND kod = ? AND digunakan = 0 ORDER BY created_at DESC LIMIT 1',
      [kunci, kod.trim()]
    );
  } catch (_) { /* Abaikan jika DB tidak tersambung */ }

  const peserta = await cariPesertaByEmel(emel);
  if (!peserta) {
    return res.status(404).json({ berjaya: false, mesej: 'Rekod peserta tidak dijumpai.' });
  }

  res.json({
    berjaya: true,
    nama:    peserta.nama,
    ic:      peserta.ic,
    kursus:  peserta.kursus.map(k => ({
      id:           k.id,
      nama_kursus:  k.nama_kursus,
      tarikh_mula:  k.tarikh_mula,
      tarikh_tamat: k.tarikh_tamat,
      tempat:       k.tempat,
      jam_kredit:   k.jam_kredit
    }))
  });
});

// ── ROUTE 3: Muat Turun Sijil PDF ────────────────────────────────────────────
// GET /api/muat-turun/:kursusId?emel=...
app.get('/api/muat-turun/:kursusId', async (req, res) => {
  const { kursusId } = req.params;
  const { emel }     = req.query;

  if (!emel) {
    return res.status(400).json({ mesej: 'Parameter emel diperlukan.' });
  }

  const peserta = await cariPesertaByEmel(emel);
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

// ── Mulakan Pelayan ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n✅ Pelayan e-Sijil KKS2 berjalan di http://localhost:${PORT}`);
  console.log(`   Tekan Ctrl+C untuk berhenti.\n`);
});
