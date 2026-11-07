# Sistem e-Sijil KKS2
**Kolej Komuniti Segamat 2**

Sistem muat turun sijil elektronik (e-Sijil) untuk peserta program dan kursus KKS2.

---

## 🗂️ Struktur Projek

```
e-sijil-kks2/
├── server.js               ← Pelayan API (Express.js)
├── package.json
├── .env.example            ← Contoh pemboleh ubah persekitaran
├── data/
│   └── peserta.json        ← Data peserta & kursus (gantikan dengan DB)
├── public/
│   ├── index.html          ← Halaman utama
│   ├── style.css           ← Gaya halaman
│   └── app.js              ← Logik frontend
└── templates/
    └── sijil.js            ← Jana PDF sijil
```

---

## ⚙️ Keperluan

- **Node.js** v14 atau ke atas — [https://nodejs.org](https://nodejs.org)
- **npm** (disertakan bersama Node.js)

---

## 🚀 Cara Jalankan

### 1. Pasang Node.js
Muat turun dan pasang dari [nodejs.org](https://nodejs.org/en/download) (pilih LTS).

### 2. Pasang pakej
```bash
cd e-sijil-kks2
npm install
```

### 3. Konfigurasi emel (pilihan untuk ujian)
Salin fail `.env.example` → `.env` dan isi maklumat SMTP:
```bash
copy .env.example .env
```
Kemaskini `.env` dengan kelayakan SMTP anda.

> **Mod Ujian (tanpa SMTP):** Jika tiada konfigurasi SMTP, sistem akan memaparkan kod OTP terus dalam mesej tindak balas API (hanya untuk pembangunan).

### 4. Jalankan pelayan
```bash
npm start
```
Buka pelayar web: **http://localhost:3000**

---

## 🔑 Aliran Penggunaan

```
1. Buka  →  http://localhost:3000
2. Masukkan No. K/P + Emel → Klik "Dapatkan Kod Pengesahan"
3. Semak emel → Masukkan kod OTP (sah 10 minit)
4. Klik "Cari e-Sijil" → Senarai program/kursus dipaparkan
5. Klik "Muat Turun e-Sijil (PDF)" → Fail PDF dimuat turun
```

---

## 📋 Data Ujian

| No. K/P       | Emel                         | Jumlah Kursus |
|---------------|------------------------------|---------------|
| 900101015555  | ahmad.fadzillah@email.com    | 2             |
| 880215086677  | siti.nurhaliza@email.com     | 1             |
| 951130121234  | haziq.rosli@email.com        | 3             |

---

## 🔧 API Endpoints

| Method | URL                            | Huraian                       |
|--------|--------------------------------|-------------------------------|
| POST   | `/api/minta-otp`               | Hantar OTP ke emel peserta    |
| POST   | `/api/cari-sijil`              | Sahkan OTP + dapatkan kursus  |
| GET    | `/api/muat-turun/:kursusId`    | Muat turun sijil PDF          |

---

## 🏭 Untuk Persekitaran Produksi

1. Gantikan `data/peserta.json` dengan pangkalan data (MySQL/PostgreSQL/MongoDB).
2. Gunakan `dotenv` untuk `.env` → `npm install dotenv` dan tambah `require('dotenv').config()` di atas `server.js`.
3. Gunakan SMTP sebenar (Gmail App Password, Mailtrap, Mailgun, AWS SES).
4. Tambah kadar had (rate limiting) menggunakan `express-rate-limit`.
5. Tambah HTTPS melalui nginx reverse proxy atau Let's Encrypt.
