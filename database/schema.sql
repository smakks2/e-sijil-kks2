-- ═══════════════════════════════════════════════════════════════════════════
-- Sistem e-Sijil KKS2 — Struktur Database MySQL
-- Kolej Komuniti Segamat 2
-- ═══════════════════════════════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS esijil_kks2
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE esijil_kks2;

-- ── Jadual: peserta ──────────────────────────────────────────────────────────
-- Menyimpan maklumat peserta yang berdaftar
CREATE TABLE IF NOT EXISTS peserta (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ic         VARCHAR(12)  NOT NULL COMMENT 'No. Kad Pengenalan (tanpa sempang)',
  nama       VARCHAR(150) NOT NULL COMMENT 'Nama penuh peserta',
  emel       VARCHAR(150) NOT NULL COMMENT 'Alamat emel peserta',
  telefon    VARCHAR(20)  NULL     COMMENT 'No. telefon (pilihan)',
  aktif      TINYINT(1)   NOT NULL DEFAULT 1 COMMENT '1=aktif, 0=tidak aktif',
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ic    (ic),
  UNIQUE KEY uq_emel  (emel),
  INDEX      idx_emel (emel)
) ENGINE=InnoDB COMMENT='Maklumat peserta program/kursus';

-- ── Jadual: kursus ───────────────────────────────────────────────────────────
-- Menyimpan maklumat kursus/program yang dianjurkan
CREATE TABLE IF NOT EXISTS kursus (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  kod          VARCHAR(30)  NOT NULL COMMENT 'Kod unik kursus, cth: KKS2-2024-001',
  nama_kursus  VARCHAR(255) NOT NULL COMMENT 'Nama penuh kursus/program',
  tarikh_mula  DATE         NOT NULL COMMENT 'Tarikh mula kursus',
  tarikh_tamat DATE         NOT NULL COMMENT 'Tarikh tamat kursus',
  tempat       VARCHAR(150) NOT NULL DEFAULT '' COMMENT 'Lokasi kursus',
  penganjur    VARCHAR(200) NOT NULL DEFAULT 'Kolej Komuniti Segamat 2',
  jam_kredit   VARCHAR(50)  NOT NULL DEFAULT '' COMMENT 'cth: 21 Jam CPD',
  jenis        ENUM('online','bersemuka') NOT NULL DEFAULT 'bersemuka',
  tempoh       VARCHAR(50)  NULL COMMENT 'cth: 3 Jam / 2 Hari',
  aktif        TINYINT(1)   NOT NULL DEFAULT 1,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_kod    (kod),
  INDEX      idx_tarikh (tarikh_mula)
) ENGINE=InnoDB COMMENT='Senarai kursus/program yang dianjurkan';

-- ── Jadual: pendaftaran ──────────────────────────────────────────────────────
-- Hubungan antara peserta dan kursus (many-to-many)
CREATE TABLE IF NOT EXISTS pendaftaran (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  peserta_id INT UNSIGNED NOT NULL,
  kursus_id  INT UNSIGNED NOT NULL,
  created_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_peserta_kursus (peserta_id, kursus_id),
  FOREIGN KEY fk_peserta (peserta_id) REFERENCES peserta(id) ON DELETE CASCADE,
  FOREIGN KEY fk_kursus  (kursus_id)  REFERENCES kursus(id)  ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='Pendaftaran peserta ke kursus';

-- ── Jadual: template_sijil ───────────────────────────────────────────────────
-- Tetapan template sijil PDF (latar + tandatangan)
CREATE TABLE IF NOT EXISTS template_sijil (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  jenis            ENUM('online','bersemuka') NOT NULL,
  nama             VARCHAR(100)  NOT NULL DEFAULT 'Template Sijil',
  latar_fail       VARCHAR(255)  NULL COMMENT 'Nama fail imej latar (PNG/JPG)',
  tandatangan_fail VARCHAR(255)  NULL COMMENT 'Nama fail imej tandatangan',
  nama_pengarah    VARCHAR(150)  NOT NULL DEFAULT 'NOR DALILA BINTI ABD RAHMAN',
  jawatan_pengarah VARCHAR(150)  NOT NULL DEFAULT 'PENGARAH',
  nama_organisasi  VARCHAR(200)  NOT NULL DEFAULT 'KOLEJ KOMUNITI SEGAMAT 2',
  aktif            TINYINT(1)    NOT NULL DEFAULT 1,
  updated_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_jenis (jenis)
) ENGINE=InnoDB COMMENT='Tetapan template sijil PDF';

INSERT IGNORE INTO template_sijil (jenis, nama) VALUES
  ('online',    'Template Sijil Kursus Online'),
  ('bersemuka', 'Template Sijil Kursus Bersemuka');

-- ── Jadual: otp_log ──────────────────────────────────────────────────────────
-- Log OTP yang dihantar (untuk audit dan keselamatan)
CREATE TABLE IF NOT EXISTS otp_log (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  emel       VARCHAR(150) NOT NULL,
  kod        VARCHAR(6)   NOT NULL,
  expiry     DATETIME     NOT NULL COMMENT 'Masa tamat tempoh OTP',
  digunakan  TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '1=sudah digunakan',
  ip_address VARCHAR(45)  NULL     COMMENT 'IP pengguna',
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_emel_expiry (emel, expiry)
) ENGINE=InnoDB COMMENT='Log OTP untuk keselamatan';
