const PDFDocument = require('pdfkit');
const fs          = require('fs');
const path        = require('path');

const DIR_LATAR    = path.join(__dirname, '..', 'uploads', 'latar');
const DIR_TANDATGN = path.join(__dirname, '..', 'uploads', 'tandatangan');
const LOGO_PATH    = path.join(__dirname, '..', 'public', 'logo-kks2.png');

/**
 * Jana PDF sijil untuk peserta
 * @param {object} peserta  - { ic, nama, emel }
 * @param {object} kursus   - { id, nama_kursus, tarikh_mula, tarikh_tamat, tempat, penganjur, jam_kredit, jenis, tempoh }
 * @param {object} tmpl     - { latar_fail, tandatangan_fail, nama_pengarah, jawatan_pengarah, nama_organisasi }
 * @param {object} res      - Express response
 */
function janaSijilPDF(peserta, kursus, tmpl, res) {
  const doc = new PDFDocument({
    size:    'A4',
    layout:  'landscape',
    margins: { top: 0, bottom: 0, left: 0, right: 0 }
  });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="eSijil_${kursus.id}.pdf"`);
  doc.pipe(res);

  const W = doc.page.width;   // 841.89
  const H = doc.page.height;  // 595.28

  // ── 1. Latar belakang ──────────────────────────────────────────────────────
  const latarPath = tmpl?.latar_fail
    ? path.join(DIR_LATAR, tmpl.latar_fail)
    : null;

  if (latarPath && fs.existsSync(latarPath)) {
    // Guna imej latar yang diupload admin
    doc.image(latarPath, 0, 0, { width: W, height: H });
  } else {
    // Latar lalai jika tiada imej diupload
    janaLatarLalai(doc, W, H);
  }

  // ── 2. Kandungan teks ──────────────────────────────────────────────────────
  const jenis = kursus.jenis || 'bersemuka';
  if (jenis === 'online') {
    janaTeksOnline(doc, W, H, peserta, kursus, tmpl);
  } else {
    janaTekasBersemuka(doc, W, H, peserta, kursus, tmpl);
  }

  // ── 3. Tandatangan ────────────────────────────────────────────────────────
  janaTandatangan(doc, W, H, tmpl);

  doc.end();
}

// ── Latar lalai (jika tiada imej diupload) ────────────────────────────────────
function janaLatarLalai(doc, W, H) {
  // Latar putih
  doc.rect(0, 0, W, H).fill('#ffffff');
  // Border luar biru
  doc.rect(18, 18, W-36, H-36).lineWidth(4).stroke('#1a3a6b');
  // Border dalam emas
  doc.rect(26, 26, W-52, H-52).lineWidth(1.5).stroke('#c8a84b');
  // Jalur header biru
  doc.rect(26, 26, W-52, 90).fill('#1a3a6b');
  // Logo
  if (fs.existsSync(LOGO_PATH)) {
    doc.image(LOGO_PATH, 38, 34, { height: 72, fit: [220, 72] });
  }
  // Corak hiasan sudut
  doc.rect(26, H-76, W-52, 50).fill('#1a3a6b');
}

// ── Teks kandungan: Kursus Online ─────────────────────────────────────────────
function janaTeksOnline(doc, W, H, peserta, kursus, tmpl) {
  const cx = W / 2;

  // Tajuk
  doc.fillColor('#1a3a6b').fontSize(11).font('Helvetica')
     .text('SIJIL PENYERTAAN', 0, 118, { align: 'center', width: W, characterSpacing: 3 });

  doc.moveTo(cx - 160, 135).lineTo(cx + 160, 135).lineWidth(0.8).stroke('#c8a84b');

  // "Dengan ini disahkan bahawa"
  doc.fillColor('#444444').fontSize(11).font('Helvetica')
     .text('Dengan ini disahkan bahawa', 0, 144, { align: 'center', width: W });

  // Nama peserta
  doc.fillColor('#1a1a1a').fontSize(26).font('Helvetica-Bold')
     .text(peserta.nama.toUpperCase(), 60, 164, { align: 'center', width: W - 120 });

  // Garis bawah nama
  const namaH = doc.heightOfString(peserta.nama.toUpperCase(), { width: W-120, fontSize: 26 });
  const gariY = 164 + namaH + 4;
  doc.moveTo(cx - 200, gariY).lineTo(cx + 200, gariY).lineWidth(1).stroke('#c8a84b');

  // No. IC
  doc.fillColor('#555555').fontSize(11).font('Helvetica')
     .text(formatIC(peserta.ic), 0, gariY + 6, { align: 'center', width: W });

  // "telah menyertai dengan jayanya"
  doc.fillColor('#444444').fontSize(11).font('Helvetica')
     .text('telah menyertai dengan jayanya', 0, gariY + 24, { align: 'center', width: W });

  // Nama kursus
  doc.fillColor('#1a3a6b').fontSize(16).font('Helvetica-Bold')
     .text(kursus.nama_kursus.toUpperCase(), 80, gariY + 42, { align: 'center', width: W - 160 });

  const kursusH = doc.heightOfString(kursus.nama_kursus.toUpperCase(), { width: W-160, fontSize: 16 });
  const y3 = gariY + 42 + kursusH + 6;

  // "yang dilaksanakan secara dalam talian"
  doc.fillColor('#444444').fontSize(11).font('Helvetica')
     .text('yang dilaksanakan secara dalam talian', 0, y3, { align: 'center', width: W });

  // "pada [TARIKH] [TEMPOH]"
  const tarikh = `pada  ${formatTarikh(kursus.tarikh_mula)}` +
    (kursus.tarikh_tamat && kursus.tarikh_tamat !== kursus.tarikh_mula
      ? `  –  ${formatTarikh(kursus.tarikh_tamat)}` : '') +
    (kursus.tempoh ? `   (${kursus.tempoh})` : '');

  doc.fillColor('#333333').fontSize(11).font('Helvetica-Bold')
     .text(tarikh, 0, y3 + 18, { align: 'center', width: W });

  // "anjuran"
  doc.fillColor('#444444').fontSize(10).font('Helvetica')
     .text('anjuran', 0, y3 + 36, { align: 'center', width: W });

  const org = tmpl?.nama_organisasi || 'KOLEJ KOMUNITI SEGAMAT 2';
  doc.fillColor('#1a3a6b').fontSize(12).font('Helvetica-Bold')
     .text(org, 0, y3 + 50, { align: 'center', width: W });
}

// ── Teks kandungan: Kursus Bersemuka ─────────────────────────────────────────
function janaTekasBersemuka(doc, W, H, peserta, kursus, tmpl) {
  const cx = W / 2;

  // Tajuk
  doc.fillColor('#1a3a6b').fontSize(11).font('Helvetica')
     .text('SIJIL PENYERTAAN', 0, 118, { align: 'center', width: W, characterSpacing: 3 });

  doc.moveTo(cx - 160, 135).lineTo(cx + 160, 135).lineWidth(0.8).stroke('#c8a84b');

  doc.fillColor('#444444').fontSize(11).font('Helvetica')
     .text('Dengan ini disahkan bahawa', 0, 144, { align: 'center', width: W });

  // Nama peserta
  doc.fillColor('#1a1a1a').fontSize(26).font('Helvetica-Bold')
     .text(peserta.nama.toUpperCase(), 60, 164, { align: 'center', width: W - 120 });

  const namaH = doc.heightOfString(peserta.nama.toUpperCase(), { width: W-120, fontSize: 26 });
  const gariY = 164 + namaH + 4;
  doc.moveTo(cx - 200, gariY).lineTo(cx + 200, gariY).lineWidth(1).stroke('#c8a84b');

  doc.fillColor('#555555').fontSize(11).font('Helvetica')
     .text(formatIC(peserta.ic), 0, gariY + 6, { align: 'center', width: W });

  doc.fillColor('#444444').fontSize(11).font('Helvetica')
     .text('telah menyertai dengan jayanya', 0, gariY + 24, { align: 'center', width: W });

  // Nama kursus
  doc.fillColor('#1a3a6b').fontSize(16).font('Helvetica-Bold')
     .text(kursus.nama_kursus.toUpperCase(), 80, gariY + 42, { align: 'center', width: W - 160 });

  const kursusH = doc.heightOfString(kursus.nama_kursus.toUpperCase(), { width: W-160, fontSize: 16 });
  const y3 = gariY + 42 + kursusH + 6;

  // "pada [TARIKH]"
  const tarikh = `pada  ${formatTarikh(kursus.tarikh_mula)}` +
    (kursus.tarikh_tamat && kursus.tarikh_tamat !== kursus.tarikh_mula
      ? `  –  ${formatTarikh(kursus.tarikh_tamat)}` : '');

  doc.fillColor('#333333').fontSize(11).font('Helvetica-Bold')
     .text(tarikh, 0, y3, { align: 'center', width: W });

  // "bertempat di"
  doc.fillColor('#444444').fontSize(10).font('Helvetica')
     .text('bertempat di', 0, y3 + 18, { align: 'center', width: W });

  const org = tmpl?.nama_organisasi || 'KOLEJ KOMUNITI SEGAMAT 2';
  doc.fillColor('#1a3a6b').fontSize(12).font('Helvetica-Bold')
     .text(org, 0, y3 + 32, { align: 'center', width: W });
}

// ── Tandatangan ────────────────────────────────────────────────────────────────
function janaTandatangan(doc, W, H, tmpl) {
  const signX = W - 250;
  const signY = H - 115;

  // Imej tandatangan
  const tandaPath = tmpl?.tandatangan_fail
    ? path.join(DIR_TANDATGN, tmpl.tandatangan_fail)
    : null;

  if (tandaPath && fs.existsSync(tandaPath)) {
    doc.image(tandaPath, signX, signY - 50, { width: 130, height: 48, fit: [130, 48] });
  }

  // Garis
  doc.moveTo(signX, signY + 2).lineTo(signX + 180, signY + 2).lineWidth(0.8).stroke('#1a3a6b');

  // Nama pengarah
  const nama    = tmpl?.nama_pengarah    || 'NOR DALILA BINTI ABD RAHMAN';
  const jawatan = tmpl?.jawatan_pengarah || 'PENGARAH';
  const org     = tmpl?.nama_organisasi  || 'KOLEJ KOMUNITI SEGAMAT 2';

  doc.fillColor('#1a1a1a').fontSize(10).font('Helvetica-Bold')
     .text(nama, signX, signY + 7, { width: 190 });
  doc.fillColor('#444444').fontSize(9).font('Helvetica')
     .text(jawatan, signX, signY + 20, { width: 190 });
  doc.fillColor('#444444').fontSize(9).font('Helvetica')
     .text(org, signX, signY + 32, { width: 190 });

  // No. sijil & tarikh jana (kiri bawah)
  doc.fillColor('#888888').fontSize(8).font('Helvetica')
     .text(`Dijana: ${formatTarikh(new Date().toISOString().split('T')[0])}`, 36, H - 68, { width: 200 });
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function formatTarikh(dateStr) {
  const bulan = ['','Januari','Februari','Mac','April','Mei','Jun',
                 'Julai','Ogos','September','Oktober','November','Disember'];
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getDate()} ${bulan[d.getMonth()+1]} ${d.getFullYear()}`;
}

function formatIC(ic) {
  if (!ic) return '';
  return ic.length === 12 ? `${ic.slice(0,6)}-${ic.slice(6,8)}-${ic.slice(8)}` : ic;
}

module.exports = { janaSijilPDF };
