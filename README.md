# Nomina Academy — LMS People Development

Portal LMS untuk pengembangan skill karyawan & talenta **PT Nomina Akselerasi Indonesia** (lini bisnis *Nomina Academy*:
upskilling → training → sertifikat). Dibangun dengan **FastAPI + SQLite** (backend) dan **React + Vite + Tailwind** (frontend).

## Menjalankan

```bash
# 1) Backend (Python 3.11+)
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000      # database + data sampel dibuat otomatis

# 2) Frontend (Node 20+), terminal lain
cd frontend
npm install
npm run dev                                     # http://localhost:5173  (proxy /api → :8000)
```

Mode produksi satu port: `npm run build` di `frontend/`, lalu jalankan uvicorn — FastAPI menyajikan
`frontend/dist` di http://localhost:8000.

Reset data sampel: `python -m app.seed --reset` (di folder `backend/`). Test: `pytest` (di folder `backend/`).

## Mode mockup (tanpa backend)

Build statis yang membaca snapshot data sampel, cocok untuk demo/presentasi:

```bash
cd backend && python -m scripts.export_demo ../frontend/public/demo-data.json
cd ../frontend && npm run build:demo        # hasil di frontend/dist-demo, bisa di-host di hosting statis mana pun
```

Di mode ini semua halaman bisa dijelajahi untuk 3 akun demo; aksi yang mengubah data tidak disimpan.

## Akun demo (kata sandi `nomina123`)

| Role | Email | Nama |
|---|---|---|
| Admin L&D | `admin@nomina.id` | Rina Pratama — Manager Training & Development |
| Admin | `ops@nomina.id` | Hadi Santoso — Direktur Operasional |
| Counselor | `counselor@nomina.id` | Andi Wijaya (counselee: Siti, Budi, Citra, Dimas) |
| Counselor | `dewi@nomina.id`, `bayu@nomina.id` | Dewi Lestari (Sales Retail), Bayu Saputra (EO, Digital) |
| Member / Counselee | `member@nomina.id` | Siti Rahmawati — Customer Service Officer |
| Member lain | `budi@`, `citra@`, `dimas@`, `eka@`, `fajar@`, `gita@`, `hendra@`, `intan@`, `joko@`, `kartika@`, `lukman@` + `nomina.id` | |

## Fitur per role

**Admin** — kelola & upload course (online / offline / blended) beserta materi (artikel, PDF, slide, video, link; upload file ≤ 50 MB),
badge & sertifikat, course wajib tahunan, draft/publish; kelola pengguna (role, pasangan counselor–counselee, target jam);
assign course ke siapa pun (termasuk counselor); buat kelas; dashboard organisasi (jam per bulan, status target 40 jam,
rata-rata per departemen, overdue se-organisasi, course terpopuler).

**Counselor** — semua fitur member untuk dirinya sendiri (**counselor juga wajib 40 jam/tahun**), ditambah:
monitoring counselee (progres jam, overdue, ≤ 90 hari, aktivitas terakhir, track record lengkap), **assign** course wajib
(dengan tenggat) atau **sarankan** course (rekomendasi yang bisa diterima/ditolak counselee), buat room kelas & isi absensi.

**Member / Counselee** — ikuti course (materi online ditandai selesai, kelas offline via absensi), daftar kelas,
track hour terhadap target tahunan, track record + timeline aktivitas, badge & sertifikat yang bisa dicetak/PDF.

## Aturan bisnis

- **Target tahunan**: default 40 jam per orang (bisa diubah per pengguna). Jam dihitung dari course yang **selesai** di tahun tersebut
  (durasi course). Status: *Target tercapai*, *Sesuai jalur* (≥ jalur ideal hari ini), *Tertinggal*, *Berisiko* (< 60% jalur ideal).
- **Penyelesaian course**: online → semua materi selesai; offline → hadir (diabsen fasilitator); blended → keduanya.
  Saat selesai, jam masuk ke target, badge diberikan, dan sertifikat bernomor `NMA/<tahun>/<urut>` diterbitkan.
- **Jadwal & deadline** di dashboard counselee & counselor: course **overdue** selalu tampil; course dengan tenggat
  **≤ 90 hari** mulai muncul (kritis ≤ 14 hari, segera ≤ 30, mendekati ≤ 90); sesi kelas dalam 90 hari ke depan; plus kalender bulanan.
- **Room kelas**: online (Zoom / Microsoft Teams / Google Meet) atau offline (lokasi wajib). Peserta yang diundang otomatis
  mendapat penugasan course. File `.ics` tersedia untuk ditambahkan ke kalender Outlook/Google.

## Integrasi Udemy Business & Coursera for Business

Course di katalog punya **sumber**: dibuat sendiri (Nomina), **Udemy**, atau **Coursera**. Course eksternal bisa
diimpor otomatis (Kelola Course → *Sinkron katalog*) atau didaftarkan manual oleh admin (pilih sumber + link course).

**Aturan jam (sama untuk semua sumber):** jam dihitung **penuh sesuai durasi resmi course** hanya saat course
selesai — course online selesai & badge terbit, kelas offline selesai, atau Udemy/Coursera menyatakan selesai.
Lama akses tidak dihitung. Contoh: course Coursera 10 jam yang berhenti di 40% = 0 jam; setelah selesai = 10 jam.

- Progres dari platform ditarik lewat *Sinkron progres peserta* (Udemy Reporting API, Coursera enrollment report)
  dan, untuk Udemy, real-time lewat webhook xAPI `POST /api/integrations/udemy/xapi`.
- Peserta yang memulai course langsung di platform (tanpa ditugaskan) otomatis tercatat sebagai course mandiri.
- **Mode contoh** (belum ada kredensial): katalog contoh 6 course Udemy + 6 Coursera, dan peserta bisa
  mensimulasikan progres/penyelesaian dari halaman belajar. Kode di `backend/app/learning_providers.py`.
- Isi kredensial di `backend/.env` untuk mode API. Endpoint & nama field API perlu dicocokkan dengan developer portal
  akun Udemy Business / Coursera for Business Anda — belum diuji terhadap akun sungguhan.

> Skema database bertambah kolom; database lama perlu dibuat ulang: `python -m app.seed --reset`.

## Integrasi Zoom / Teams / Google Meet

`backend/app/meetings.py` memanggil API resmi masing-masing platform bila kredensial diisi di `backend/.env`
(lihat `backend/.env.example`):

- **Zoom** — Server-to-Server OAuth app → `POST /v2/users/{user}/meetings`.
- **Microsoft Teams** — Azure AD app (client credentials, `OnlineMeetings.ReadWrite.All` + Application Access Policy) → Graph `onlineMeetings`.
- **Google Meet** — service account dengan domain-wide delegation → Calendar API event + `conferenceData`.

Tanpa kredensial, sistem membuat **link demo** berformat platform tersebut (ditandai "Link demo" di UI) agar alur tetap bisa dicoba.
Penyelenggara selalu bisa menempel link meeting manual.
> Catatan: pemanggilan API asli belum diuji terhadap akun Zoom/Microsoft/Google sungguhan — perlu diverifikasi saat kredensial tersedia.

## Data sampel

Seed (`backend/app/seed.py`) membuat 17 pengguna, 18 course (1 draft), ±190 riwayat pelatihan 2025–2026, sertifikat,
timeline aktivitas, kelas lampau dengan absensi (termasuk peserta absen), dan kelas mendatang (Zoom, Teams, Meet, offline,
satu sedang berlangsung). Semua tanggal **relatif terhadap hari ini**, sehingga dashboard selalu menampilkan campuran
overdue, ≤ 90 hari, dan terjadwal.

## Struktur

```
lms-nomina/
  backend/app/   main.py, models.py, services.py (aturan jam/deadline/sertifikat), meetings.py, seed.py, routers/
  backend/tests/ test_api.py
  frontend/src/  pages/, components/ (ui, learning, dialogs, profile), lib/
```
