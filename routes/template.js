const express = require('express');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const jwt     = require('jsonwebtoken');
const router  = express.Router();

const JWT_SECRET   = process.env.ADMIN_JWT_SECRET || 'kks2_rahsia';
const DIR_LATAR    = path.join(__dirname, '..', 'uploads', 'latar');
const DIR_TANDATGN = path.join(__dirname, '..', 'uploads', 'tandatangan');

// Pastikan folder wujud
[DIR_LATAR, DIR_TANDATGN].forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// ── Middleware JWT ───────────────────────────────────────────────────────────
function sahkanToken(req, res, next) {
  const auth  = req.headers['authorization'];
  const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ mesej: 'Token diperlukan.' });
  try { req.admin = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ mesej: 'Token tidak sah.' }); }
}

// ── Multer: upload imej ──────────────────────────────────────────────────────
function buatUploader(destinasi) {
  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, destinasi),
      filename:    (req, file, cb) => {
        const ext  = path.extname(file.originalname).toLowerCase();
        const nama = `${req.params.jenis}_${Date.now()}${ext}`;
        cb(null, nama);
      }
    }),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
      const ok = /\.(png|jpg|jpeg)$/i.test(file.originalname);
      ok ? cb(null, true) : cb(new Error('Hanya imej PNG atau JPG dibenarkan.'));
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/template/:jenis — Dapatkan tetapan template
// ═══════════════════════════════════════════════════════════════════════════
router.get('/:jenis', sahkanToken, async (req, res) => {
  const db = req.app.get('db');
  const { jenis } = req.params;
  if (!['online','bersemuka'].includes(jenis))
    return res.status(400).json({ mesej: 'Jenis tidak sah.' });
  try {
    const [[tmpl]] = await db.execute('SELECT * FROM template_sijil WHERE jenis=?', [jenis]);
    res.json(tmpl || {});
  } catch (err) { res.status(500).json({ mesej: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
// PUT /api/template/:jenis — Kemaskini maklumat teks template
// ═══════════════════════════════════════════════════════════════════════════
router.put('/:jenis', sahkanToken, async (req, res) => {
  const db = req.app.get('db');
  const { jenis } = req.params;
  const { nama_pengarah, jawatan_pengarah, nama_organisasi } = req.body;
  try {
    await db.execute(
      'UPDATE template_sijil SET nama_pengarah=?, jawatan_pengarah=?, nama_organisasi=? WHERE jenis=?',
      [nama_pengarah, jawatan_pengarah, nama_organisasi, jenis]
    );
    res.json({ berjaya: true, mesej: 'Tetapan template dikemaskini.' });
  } catch (err) { res.status(500).json({ mesej: err.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/template/:jenis/latar — Upload imej latar sijil
// ═══════════════════════════════════════════════════════════════════════════
router.post('/:jenis/latar', sahkanToken, (req, res) => {
  const { jenis } = req.params;
  if (!['online','bersemuka'].includes(jenis))
    return res.status(400).json({ mesej: 'Jenis tidak sah.' });

  buatUploader(DIR_LATAR).single('fail')(req, res, async (err) => {
    if (err) return res.status(400).json({ mesej: err.message });
    if (!req.file) return res.status(400).json({ mesej: 'Tiada fail dimuat naik.' });

    const db = req.app.get('db');
    try {
      // Padam fail lama jika ada
      const [[tmpl]] = await db.execute('SELECT latar_fail FROM template_sijil WHERE jenis=?', [jenis]);
      if (tmpl?.latar_fail) {
        const lama = path.join(DIR_LATAR, tmpl.latar_fail);
        if (fs.existsSync(lama)) fs.unlinkSync(lama);
      }
      await db.execute('UPDATE template_sijil SET latar_fail=? WHERE jenis=?', [req.file.filename, jenis]);
      res.json({ berjaya: true, fail: req.file.filename, mesej: 'Imej latar berjaya dimuat naik.' });
    } catch (e) { res.status(500).json({ mesej: e.message }); }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/template/:jenis/tandatangan — Upload imej tandatangan
// ═══════════════════════════════════════════════════════════════════════════
router.post('/:jenis/tandatangan', sahkanToken, (req, res) => {
  const { jenis } = req.params;
  if (!['online','bersemuka'].includes(jenis))
    return res.status(400).json({ mesej: 'Jenis tidak sah.' });

  buatUploader(DIR_TANDATGN).single('fail')(req, res, async (err) => {
    if (err) return res.status(400).json({ mesej: err.message });
    if (!req.file) return res.status(400).json({ mesej: 'Tiada fail dimuat naik.' });

    const db = req.app.get('db');
    try {
      const [[tmpl]] = await db.execute('SELECT tandatangan_fail FROM template_sijil WHERE jenis=?', [jenis]);
      if (tmpl?.tandatangan_fail) {
        const lama = path.join(DIR_TANDATGN, tmpl.tandatangan_fail);
        if (fs.existsSync(lama)) fs.unlinkSync(lama);
      }
      await db.execute('UPDATE template_sijil SET tandatangan_fail=? WHERE jenis=?', [req.file.filename, jenis]);
      res.json({ berjaya: true, fail: req.file.filename, mesej: 'Imej tandatangan berjaya dimuat naik.' });
    } catch (e) { res.status(500).json({ mesej: e.message }); }
  });
});

module.exports = router;
