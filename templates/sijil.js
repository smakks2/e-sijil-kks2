const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Jana PDF sijil untuk peserta
 * @param {object} peserta - Maklumat peserta
 * @param {object} kursus  - Maklumat kursus/program
 * @param {object} res     - Express response stream
 */
function janaSijilPDF(peserta, kursus, res) {
  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    margins: { top: 40, bottom: 40, left: 50, right: 50 }
  });

  // Pipe terus ke response HTTP
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="eSijil_${kursus.id}_${peserta.ic}.pdf"`
  );
  doc.pipe(res);

  const W = doc.page.width;
  const H = doc.page.height;

  // ── Latar belakang ──────────────────────────────────────────────
  doc.rect(0, 0, W, H).fill('#f0f4ff');

  // Border luar — biru tua
  doc.rect(20, 20, W - 40, H - 40).lineWidth(4).stroke('#1a3a6b');
  // Border dalam — emas
  doc.rect(30, 30, W - 60, H - 60).lineWidth(1.5).stroke('#c8a84b');

  // ── Header jalur biru ────────────────────────────────────────────
  doc.rect(30, 30, W - 60, 90).fill('#1a3a6b');

  // Logo KKS2 kiri
  const logoPath = path.join(__dirname, '..', 'public', 'logo-kks2.png');
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, 42, 38, { height: 72, fit: [200, 72] });
  } else {
    // Fallback teks jika logo tiada
    doc
      .fillColor('#ffffff')
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('KOLEJ KOMUNITI SEGAMAT 2', 55, 50, { align: 'left', width: 260 });
  }

  // Tajuk tengah
  doc
    .fillColor('#f5a623')
    .fontSize(24)
    .font('Helvetica-Bold')
    .text('e-SIJIL', 0, 46, { align: 'center', width: W });

  // Nombor sijil kanan
  doc
    .fillColor('#a0c4ff')
    .fontSize(9)
    .font('Helvetica')
    .text(`No. Sijil: ${kursus.id}`, W - 250, 60, { align: 'right', width: 200 });

  // ── Badan ────────────────────────────────────────────────────────
  let y = 140;

  doc
    .fillColor('#1a3a6b')
    .fontSize(13)
    .font('Helvetica')
    .text('Ini adalah untuk mengesahkan bahawa', 0, y, { align: 'center', width: W });

  y += 35;
  // Nama peserta — besar & tebal
  doc
    .fillColor('#1a1a1a')
    .fontSize(28)
    .font('Helvetica-Bold')
    .text(peserta.nama.toUpperCase(), 0, y, { align: 'center', width: W });

  // Garis bawah nama
  const namaW = 420;
  const namaX = (W - namaW) / 2;
  y += 38;
  doc.moveTo(namaX, y).lineTo(namaX + namaW, y).lineWidth(1).stroke('#c8a84b');

  y += 8;
  doc
    .fillColor('#444444')
    .fontSize(11)
    .font('Helvetica')
    .text(`No. K/P: ${peserta.ic}`, 0, y, { align: 'center', width: W });

  y += 28;
  doc
    .fillColor('#1a3a6b')
    .fontSize(13)
    .font('Helvetica')
    .text('telah berjaya menghadiri dan menamatkan', 0, y, { align: 'center', width: W });

  y += 30;
  doc
    .fillColor('#1a1a1a')
    .fontSize(17)
    .font('Helvetica-Bold')
    .text(kursus.nama_kursus, 80, y, { align: 'center', width: W - 160 });

  y += doc.heightOfString(kursus.nama_kursus, { width: W - 160, align: 'center' }) + 14;

  // Kotak maklumat kursus
  const boxX = (W - 480) / 2;
  doc.rect(boxX, y, 480, 52).fill('#1a3a6b').stroke('#c8a84b');
  doc
    .fillColor('#ffffff')
    .fontSize(11)
    .font('Helvetica')
    .text(
      `Tarikh: ${formatTarikh(kursus.tarikh_mula)} – ${formatTarikh(kursus.tarikh_tamat)}     |     Tempat: ${kursus.tempat}`,
      boxX + 10, y + 10,
      { align: 'center', width: 460 }
    );
  doc
    .fillColor('#f5d97a')
    .fontSize(11)
    .font('Helvetica-Bold')
    .text(`Bersamaan: ${kursus.jam_kredit}`, boxX + 10, y + 30, { align: 'center', width: 460 });

  y += 70;

  // ── Bahagian tandatangan ─────────────────────────────────────────
  const col1X = 100;
  const col2X = W - 280;
  const signY = y + 40;

  // Garis tandatangan kiri
  doc.moveTo(col1X, signY).lineTo(col1X + 180, signY).lineWidth(1).stroke('#1a3a6b');
  doc
    .fillColor('#1a1a1a')
    .fontSize(10)
    .font('Helvetica-Bold')
    .text('PENGANJUR', col1X, signY + 5, { width: 180, align: 'center' });
  doc
    .fillColor('#444444')
    .fontSize(9)
    .font('Helvetica')
    .text(kursus.penganjur, col1X, signY + 18, { width: 180, align: 'center' });

  // Garis tandatangan kanan — tarikh cetak
  doc.moveTo(col2X, signY).lineTo(col2X + 180, signY).lineWidth(1).stroke('#1a3a6b');
  doc
    .fillColor('#1a1a1a')
    .fontSize(10)
    .font('Helvetica-Bold')
    .text('TARIKH DIJANA', col2X, signY + 5, { width: 180, align: 'center' });
  doc
    .fillColor('#444444')
    .fontSize(9)
    .font('Helvetica')
    .text(formatTarikh(new Date().toISOString().split('T')[0]), col2X, signY + 18, {
      width: 180,
      align: 'center'
    });

  // ── Footer ───────────────────────────────────────────────────────
  doc.rect(30, H - 60, W - 60, 30).fill('#1a3a6b');
  doc
    .fillColor('#a0c4ff')
    .fontSize(9)
    .font('Helvetica')
    .text(
      'Sijil ini dijana secara elektronik oleh Sistem e-Sijil KKS2 • Kolej Komuniti Segamat 2 • kks2.edu.my',
      0, H - 52,
      { align: 'center', width: W }
    );

  doc.end();
}

function formatTarikh(dateStr) {
  const bulan = [
    '', 'Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun',
    'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'
  ];
  const [y, m, d] = dateStr.split('-');
  return `${parseInt(d)} ${bulan[parseInt(m)]} ${y}`;
}

module.exports = { janaSijilPDF };
