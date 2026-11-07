-- ═══════════════════════════════════════════════════════════════════════════
-- Sistem e-Sijil KKS2 — Data Awal (Seed)
-- Jalankan SELEPAS schema.sql
-- ═══════════════════════════════════════════════════════════════════════════

USE esijil_kks2;

-- ── Data Peserta ─────────────────────────────────────────────────────────────
INSERT INTO peserta (ic, nama, emel) VALUES
  ('900101015555', 'Ahmad Fadzillah bin Mohd Yusof',  'ahmad.fadzillah@email.com'),
  ('880215086677', 'Siti Nurhaliza binti Zakaria',     'siti.nurhaliza@email.com'),
  ('951130121234', 'Muhammad Haziq bin Rosli',         'haziq.rosli@email.com');

-- ── Data Kursus ──────────────────────────────────────────────────────────────
INSERT INTO kursus (kod, nama_kursus, tarikh_mula, tarikh_tamat, tempat, penganjur, jam_kredit) VALUES
  ('KKS2-2024-001', 'Kursus Kepimpinan dan Pengurusan Strategik',    '2024-03-10', '2024-03-12', 'Putrajaya',    'Kolej Komuniti Segamat 2', '21 Jam CPD'),
  ('KKS2-2024-002', 'Bengkel Peningkatan Kompetensi Pegawai Tadbir', '2024-04-15', '2024-04-17', 'Shah Alam',    'Kolej Komuniti Segamat 2', '21 Jam CPD'),
  ('KKS2-2024-003', 'Kursus Integriti dan Tadbir Urus',              '2024-05-06', '2024-05-07', 'Cyberjaya',    'Kolej Komuniti Segamat 2', '14 Jam CPD'),
  ('KKS2-2024-015', 'Program Transformasi Digital Sektor Awam',      '2024-07-22', '2024-07-23', 'Kuala Lumpur', 'Kolej Komuniti Segamat 2', '14 Jam CPD'),
  ('KKS2-2024-020', 'Program Kesejahteraan dan Produktiviti Pekerja','2024-09-03', '2024-09-04', 'Putrajaya',    'Kolej Komuniti Segamat 2', '14 Jam CPD'),
  ('KKS2-2025-005', 'Latihan Kemahiran Komunikasi Berkesan',          '2025-01-20', '2025-01-21', 'Kuala Lumpur', 'Kolej Komuniti Segamat 2', '14 Jam CPD');

-- ── Data Pendaftaran ─────────────────────────────────────────────────────────
-- Ahmad Fadzillah → 2 kursus
INSERT INTO pendaftaran (peserta_id, kursus_id) VALUES
  (1, 1),   -- Ahmad → Kursus Kepimpinan
  (1, 4);   -- Ahmad → Program Transformasi Digital

-- Siti Nurhaliza → 1 kursus
INSERT INTO pendaftaran (peserta_id, kursus_id) VALUES
  (2, 2);   -- Siti → Bengkel Kompetensi

-- Muhammad Haziq → 3 kursus
INSERT INTO pendaftaran (peserta_id, kursus_id) VALUES
  (3, 3),   -- Haziq → Kursus Integriti
  (3, 5),   -- Haziq → Program Kesejahteraan
  (3, 6);   -- Haziq → Latihan Komunikasi
