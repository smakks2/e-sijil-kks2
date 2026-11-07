const express   = require('express');
const jwt       = require('jsonwebtoken');
const bcrypt    = require('bcryptjs');
const multer    = require('multer');
const XLSX      = require('xlsx');
const router    = express.Router();

const JWT_SECRET = process.env.ADMIN_JWT_SECRET || 'kks2_rahsia';

// ── Multer (simpan fail upload dalam memori) ─────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 }, // max 5MB
  fileFilter: (req, file, cb) => {
    const ok = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ].includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/i);
    ok ? cb(null, true) : cb(new Error('Hanya fail Excel (.xlsx/.xls) atau CSV dibenarkan.'));
  }
});

// ── Middleware: Sahkan JWT ───────────────────────────────────────────────────
function sahkanToken(req, res, next) {
  const auth = req.headers['authorization'];
  const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ mesej: 'Token diperlukan.' });
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ mesej: 'Token tidak sah atau tamat tempoh.' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/admin/login
// ═══════════════════════════════════════════════════════════════════════════
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ mesej: 'Username dan kata laluan diperlukan.' });

  const db = req.app.get('db');
  try {
    const [rows] = await db.execute(
      'SELECT * FROM admin WHERE username = ? AND aktif = 1', [username]
    );
    if (!rows.length)
      return res.status(401).json({ mesej: 'Username atau kata laluan tidak sah.' });

    const admin = rows[0];
    const sah   = await bcrypt.compare(password, admin.password);
    if (!sah)
      return res.status(401).json({ mesej: 'Username atau kata laluan tidak sah.' });

    const token = jwt.sign(
      { id: admin.id, username: admin.username, nama: admin.nama },
      JWT_SECRET,
      { expiresIn: '8h' }
    );
    res.json({ berjaya: true, token, nama: admin.nama });
  } catch (err) {
    res.status(500).json({ mesej: 'Ralat pelayan: ' + err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/admin/dashboard  — Statistik ringkas
// ═══════════════════════════════════════════════════════════════════════════
router.get('/dashboard', sahkanToken, async (req, res) => {
  const db = req.app.get('db');
  try {
    const [[{ jumlah_peserta }]] = await db.execute('SELECT COUNT(*) AS jumlah_peserta FROM peserta WHERE aktif=1');
    const [[{ jumlah_kursus  }]] = await db.execute('SELECT COUNT(*) AS jumlah_kursus  FROM kursus  WHERE aktif=1');
    const [[{ jumlah_daftar  }]] = await db.execute('SELECT COUNT(*) AS jumlah_daftar  FROM pendaftaran');
    const [[{ jumlah_otp     }]] = await db.execute('SELECT COUNT(*) AS jumlah_otp     FROM otp_log WHERE DATE(created_at)=CURDATE()');
    res.json({ jumlah_peserta, jumlah_kursus, jumlah_daftar, jumlah_otp });
  } catch (err) {
    res.status(500).json({ mesej: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// PESERTA — CRUD
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/admin/peserta
router.get('/peserta', sahkanToken, async (req, res) => {
  const db = req.app.get('db');
  try {
    const [rows] = await db.execute(
      `SELECT p.*, COUNT(pd.id) AS jumlah_kursus
       FROM peserta p
       LEFT JOIN pendaftaran pd ON pd.peserta_id = p.id
       WHERE p.aktif = 1
       GROUP BY p.id
       ORDER BY p.nama`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ mesej: err.message }); }
});

// POST /api/admin/peserta — Tambah peserta baru
router.post('/peserta', sahkanToken, async (req, res) => {
  const { ic, nama, emel, telefon } = req.body;
  if (!ic || !nama || !emel)
    return res.status(400).json({ mesej: 'IC, nama dan emel diperlukan.' });

  const db = req.app.get('db');
  try {
    const [result] = await db.execute(
      'INSERT INTO peserta (ic, nama, emel, telefon) VALUES (?, ?, ?, ?)',
      [ic.replace(/-/g,''), nama.trim(), emel.trim().toLowerCase(), telefon || null]
    );
    res.json({ berjaya: true, id: result.insertId, mesej: 'Peserta berjaya ditambah.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ mesej: 'IC atau emel sudah wujud dalam sistem.' });
    res.status(500).json({ mesej: err.message });
  }
});

// PUT /api/admin/peserta/:id — Kemaskini peserta
router.put('/peserta/:id', sahkanToken, async (req, res) => {
  const { ic, nama, emel, telefon } = req.body;
  const db = req.app.get('db');
  try {
    await db.execute(
      'UPDATE peserta SET ic=?, nama=?, emel=?, telefon=? WHERE id=?',
      [ic.replace(/-/g,''), nama.trim(), emel.trim().toLowerCase(), telefon || null, req.params.id]
    );
    res.json({ berjaya: true, mesej: 'Peserta berjaya dikemaskini.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ mesej: 'IC atau emel sudah digunakan oleh peserta lain.' });
    res.status(500).json({ mesej: err.message });
  }
});

// DELETE /api/admin/peserta/:id — Nyahaktifkan peserta
router.delete('/peserta/:id', sahkanToken, async (req, res) => {
  const db = req.app.get('db');
  try {
    await db.execute('UPDATE peserta SET aktif=0 WHERE id=?', [req.params.id]);
    res.json({ berjaya: true, mesej: 'Peserta berjaya dipadam.' });
  } catch (err) { res.status(500).json({ mesej: err.message }); }
});

// POST /api/admin/peserta/import — Import dari Excel/CSV
router.post('/peserta/import', sahkanToken, upload.single('fail'), async (req, res) => {
  if (!req.file) return res.status(400).json({ mesej: 'Tiada fail dimuat naik.' });

  const db = req.app.get('db');
  try {
    const wb    = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws    = wb.Sheets[wb.SheetNames[0]];
    const data  = XLSX.utils.sheet_to_json(ws, { defval: '' });

    let berjaya = 0, gagal = 0, ralat = [];

    for (const baris of data) {
      const ic      = String(baris['IC'] || baris['ic'] || baris['No IC'] || '').replace(/-/g,'').trim();
      const nama    = String(baris['Nama'] || baris['nama'] || baris['NAMA'] || '').trim();
      const emel    = String(baris['Emel'] || baris['emel'] || baris['Email'] || '').trim().toLowerCase();
      const telefon = String(baris['Telefon'] || baris['telefon'] || '').trim() || null;

      if (!ic || !nama || !emel) { gagal++; ralat.push(`Baris tidak lengkap: ${nama||ic||emel}`); continue; }

      try {
        await db.execute(
          'INSERT INTO peserta (ic, nama, emel, telefon) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE nama=VALUES(nama), telefon=VALUES(telefon)',
          [ic, nama, emel, telefon]
        );
        berjaya++;
      } catch (e) {
        gagal++;
        ralat.push(`${nama} (${emel}): ${e.message}`);
      }
    }
    res.json({ berjaya: true, berjaya_import: berjaya, gagal, ralat: ralat.slice(0, 10) });
  } catch (err) {
    res.status(500).json({ mesej: 'Gagal baca fail: ' + err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// KURSUS — CRUD
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/admin/kursus
router.get('/kursus', sahkanToken, async (req, res) => {
  const db = req.app.get('db');
  try {
    const [rows] = await db.execute(
      `SELECT k.*, COUNT(pd.id) AS jumlah_peserta
       FROM kursus k
       LEFT JOIN pendaftaran pd ON pd.kursus_id = k.id
       WHERE k.aktif = 1
       GROUP BY k.id
       ORDER BY k.tarikh_mula DESC`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ mesej: err.message }); }
});

// POST /api/admin/kursus — Tambah kursus
router.post('/kursus', sahkanToken, async (req, res) => {
  const { kod, nama_kursus, tarikh_mula, tarikh_tamat, tempat, penganjur, jam_kredit, jenis, tempoh } = req.body;
  if (!kod || !nama_kursus || !tarikh_mula || !tarikh_tamat)
    return res.status(400).json({ mesej: 'Kod, nama, tarikh mula dan tarikh tamat diperlukan.' });

  const db = req.app.get('db');
  try {
    const [result] = await db.execute(
      'INSERT INTO kursus (kod, nama_kursus, tarikh_mula, tarikh_tamat, tempat, penganjur, jam_kredit, jenis, tempoh) VALUES (?,?,?,?,?,?,?,?,?)',
      [kod.trim(), nama_kursus.trim(), tarikh_mula, tarikh_tamat,
       tempat || '', penganjur || 'Kolej Komuniti Segamat 2', jam_kredit || '',
       jenis || 'bersemuka', tempoh || null]
    );
    res.json({ berjaya: true, id: result.insertId, mesej: 'Kursus berjaya ditambah.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY')
      return res.status(409).json({ mesej: 'Kod kursus sudah wujud.' });
    res.status(500).json({ mesej: err.message });
  }
});

// PUT /api/admin/kursus/:id — Kemaskini kursus
router.put('/kursus/:id', sahkanToken, async (req, res) => {
  const { kod, nama_kursus, tarikh_mula, tarikh_tamat, tempat, penganjur, jam_kredit, jenis, tempoh } = req.body;
  const db = req.app.get('db');
  try {
    await db.execute(
      'UPDATE kursus SET kod=?, nama_kursus=?, tarikh_mula=?, tarikh_tamat=?, tempat=?, penganjur=?, jam_kredit=?, jenis=?, tempoh=? WHERE id=?',
      [kod, nama_kursus, tarikh_mula, tarikh_tamat, tempat, penganjur, jam_kredit,
       jenis || 'bersemuka', tempoh || null, req.params.id]
    );
    res.json({ berjaya: true, mesej: 'Kursus berjaya dikemaskini.' });
  } catch (err) { res.status(500).json({ mesej: err.message }); }
});

// DELETE /api/admin/kursus/:id
router.delete('/kursus/:id', sahkanToken, async (req, res) => {
  const db = req.app.get('db');
  try {
    await db.execute('UPDATE kursus SET aktif=0 WHERE id=?', [req.params.id]);
    res.json({ berjaya: true, mesej: 'Kursus berjaya dipadam.' });
  } catch (err) { res.status(500).json({ mesej: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
// PENDAFTARAN — Daftarkan peserta ke kursus
// ═══════════════════════════════════════════════════════════════════════════

// GET /api/admin/pendaftaran/:kursusId
router.get('/pendaftaran/:kursusId', sahkanToken, async (req, res) => {
  const db = req.app.get('db');
  try {
    const [rows] = await db.execute(
      `SELECT p.id, p.ic, p.nama, p.emel FROM peserta p
       JOIN pendaftaran pd ON pd.peserta_id = p.id
       WHERE pd.kursus_id = ? AND p.aktif = 1 ORDER BY p.nama`,
      [req.params.kursusId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ mesej: err.message }); }
});

// POST /api/admin/pendaftaran — Daftar peserta ke kursus
router.post('/pendaftaran', sahkanToken, async (req, res) => {
  const { peserta_id, kursus_id } = req.body;
  const db = req.app.get('db');
  try {
    await db.execute(
      'INSERT IGNORE INTO pendaftaran (peserta_id, kursus_id) VALUES (?,?)',
      [peserta_id, kursus_id]
    );
    res.json({ berjaya: true, mesej: 'Peserta berjaya didaftarkan ke kursus.' });
  } catch (err) { res.status(500).json({ mesej: err.message }); }
});

// DELETE /api/admin/pendaftaran — Buang pendaftaran
router.delete('/pendaftaran', sahkanToken, async (req, res) => {
  const { peserta_id, kursus_id } = req.body;
  const db = req.app.get('db');
  try {
    await db.execute(
      'DELETE FROM pendaftaran WHERE peserta_id=? AND kursus_id=?',
      [peserta_id, kursus_id]
    );
    res.json({ berjaya: true, mesej: 'Pendaftaran berjaya dibuang.' });
  } catch (err) { res.status(500).json({ mesej: err.message }); }
});

module.exports = router;
