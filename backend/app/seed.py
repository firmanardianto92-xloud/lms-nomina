"""Data sampel Nomina Academy LMS.

Semua tanggal dibuat RELATIF terhadap hari ini, sehingga dashboard selalu menampilkan
kombinasi: riwayat tahun lalu, jam tahun berjalan, course overdue, course yang mendekati
tenggat (≤ 90 hari), kelas online/offline yang akan datang, dan kelas yang sedang berlangsung.

Jalankan ulang dari nol:  python -m app.seed --reset
"""

import random
import sys
from datetime import date, datetime, time, timedelta

from .auth import hash_password
from .db import Base, SessionLocal, engine, now, today
from .meetings import demo_link
from .models import (
    ADMIN, BLENDED, COUNSELEE, COUNSELOR, IN_PROGRESS, NOT_STARTED, OFFLINE, ONLINE, SRC_ASSIGNED, SRC_SELF,
    SRC_SUGGESTED, SUGGESTED, Course, CourseMaterial, Enrollment, MaterialProgress, Room, RoomParticipant, User,
)
from .services import complete_enrollment, log

DEMO_PASSWORD = "nomina123"
HQ = "Nomina Training Center — Jl. H.R. Rasuna Said Kav. 10, Jakarta Selatan"

# --------------------------------------------------------------------------- pengguna
ADMINS = [
    ("admin@nomina.id", "Rina Pratama", "Manager Training & Development", "Human Capital"),
    ("ops@nomina.id", "Hadi Santoso", "Direktur Operasional", "Direksi"),
]
COUNSELORS = [
    ("counselor@nomina.id", "Andi Wijaya", "Senior Talent Counselor", "Talent Development", 22),
    ("dewi@nomina.id", "Dewi Lestari", "Talent Counselor", "Talent Pool & Rekrutmen", 38),
    ("bayu@nomina.id", "Bayu Saputra", "Learning Counselor", "Training & Development", 27),
]
# email, nama, jabatan, departemen, counselor, target jam tahun berjalan (untuk variasi progres)
COUNSELEES = [
    ("member@nomina.id", "Siti Rahmawati", "Customer Service Officer", "Call Center", "counselor@nomina.id", None),
    ("budi@nomina.id", "Budi Hartono", "Team Leader Call Center", "Call Center", "counselor@nomina.id", 44),
    ("citra@nomina.id", "Citra Ayu Lestari", "Call Center Agent", "Call Center", "counselor@nomina.id", 12),
    ("dimas@nomina.id", "Dimas Prakoso", "Quality Assurance Officer", "Call Center", "counselor@nomina.id", 30),
    ("eka@nomina.id", "Eka Putri Ananda", "Sales Retail Associate", "Sales Retail", "dewi@nomina.id", 42),
    ("fajar@nomina.id", "Fajar Ramadhan", "Store Supervisor", "Sales Retail", "dewi@nomina.id", 20),
    ("gita@nomina.id", "Gita Maharani", "Sales Retail Associate", "Sales Retail", "dewi@nomina.id", 8),
    ("hendra@nomina.id", "Hendra Gunawan", "Area Sales Executive", "Sales Retail", "dewi@nomina.id", 36),
    ("intan@nomina.id", "Intan Permata", "Event Coordinator", "Event Organizer", "bayu@nomina.id", 28),
    ("joko@nomina.id", "Joko Susilo", "Project Officer Event", "Event Organizer", "bayu@nomina.id", 16),
    ("kartika@nomina.id", "Kartika Sari", "Data Analyst", "Digital & IT", "bayu@nomina.id", 46),
    ("lukman@nomina.id", "Lukman Hakim", "Junior Software Developer", "Digital & IT", "bayu@nomina.id", 33),
]


def _art(title, body, minutes=20):
    return {"title": title, "kind": "article", "content": body, "duration_minutes": minutes}


def _link(title, url, minutes=30, kind="link"):
    return {"title": title, "kind": kind, "url": url, "duration_minutes": minutes}


# --------------------------------------------------------------------------- katalog course
COURSES = [
    dict(code="NMA-LDR-101", title="Dasar Kepemimpinan untuk Team Leader", category="Leadership", delivery_mode=BLENDED,
         duration_hours=12, level="Menengah", instructor="Rina Pratama, CHRP", cover_color="#0A84FF",
         badge_name="Emerging Leader", skills=["Delegasi", "Feedback", "Situational Leadership"],
         summary="Transisi dari individual contributor menjadi pemimpin tim yang efektif.",
         description="Program blended: 4 modul online mandiri lalu 1 sesi kelas live untuk role-play situasi kepemimpinan.",
         materials=[
             _art("Peran Team Leader di Organisasi", "Team leader adalah jembatan antara strategi manajemen dan eksekusi harian tim. Modul ini membahas ekspektasi peran, perbedaan manajer vs pemimpin, dan jebakan umum pemimpin baru.", 25),
             _art("Situational Leadership", "Gaya kepemimpinan perlu menyesuaikan tingkat kompetensi dan komitmen anggota tim: directing, coaching, supporting, dan delegating.", 30),
             _art("Memberi Feedback dengan Model SBI", "Situation – Behavior – Impact: cara memberi umpan balik yang spesifik, objektif, dan tidak menyerang pribadi.", 25),
             _art("Delegasi & Monitoring", "Delegasi bukan melepas tanggung jawab. Pelajari matriks delegasi dan cara memonitor tanpa micro-managing.", 30),
         ]),
    dict(code="NMA-COM-110", title="Komunikasi Efektif & Public Speaking", category="Soft Skill", delivery_mode=OFFLINE,
         duration_hours=8, level="Dasar", instructor="Tim Fasilitator Nomina Academy", cover_color="#7C3AED",
         badge_name="Confident Communicator", skills=["Public Speaking", "Storytelling", "Active Listening"],
         summary="Workshop tatap muka satu hari: struktur pesan, bahasa tubuh, dan praktik presentasi.",
         description="Kelas offline dengan praktik presentasi 5 menit per peserta, direkam dan dievaluasi fasilitator.",
         materials=[_art("Pre-reading: Struktur Pesan PREP", "Point – Reason – Example – Point. Siapkan satu topik 5 menit dengan struktur ini sebelum kelas.", 15)]),
    dict(code="NMA-CS-120", title="Service Excellence untuk Call Center", category="Customer Service", delivery_mode=ONLINE,
         duration_hours=6, level="Dasar", instructor="Maya Anggraini (Fanindo Partner)", cover_color="#0EA5E9",
         badge_name="Service Star", skills=["Service Mindset", "Telephone Etiquette", "Empati"],
         summary="Standar layanan prima untuk agen call center: salam, empati, dan penyelesaian di kontak pertama.",
         description="Course online mandiri berbasis studi kasus percakapan call center.",
         materials=[
             _art("Mindset Melayani", "Pelanggan menilai pengalaman, bukan hanya solusi. Kenali moment of truth dalam satu panggilan.", 20),
             _art("Telephone Etiquette & Script", "Pembukaan, verifikasi, probing, solusi, dan penutupan. Contoh script dan variasinya.", 30),
             _art("Empati dalam Percakapan", "Teknik acknowledge – align – assure untuk menenangkan pelanggan.", 25),
             _art("First Call Resolution", "Cara mengurangi panggilan berulang dengan probing yang tepat dan dokumentasi yang rapi.", 25),
         ]),
    dict(code="NMA-CS-121", title="Handling Complaint & Customer Recovery", category="Customer Service", delivery_mode=OFFLINE,
         duration_hours=6, level="Menengah", instructor="Andi Wijaya", cover_color="#0284C7",
         badge_name="Complaint Resolver", skills=["De-eskalasi", "Problem Solving", "Recovery"],
         summary="Simulasi menangani pelanggan marah dan memulihkan kepercayaan.",
         description="Kelas offline berbasis role-play dengan skenario komplain nyata dari klien call center & retail.",
         materials=[_art("Pre-reading: Model LEARN", "Listen, Empathize, Apologize, Resolve, Notify — kerangka penanganan komplain.", 15)]),
    dict(code="NMA-SLS-130", title="Teknik Penjualan Retail & Negosiasi", category="Sales", delivery_mode=OFFLINE,
         duration_hours=8, level="Dasar", instructor="Dewi Lestari", cover_color="#F97316",
         badge_name="Retail Closer", skills=["Consultative Selling", "Negosiasi", "Upselling"],
         summary="Dari menyapa hingga closing: teknik penjualan konsultatif untuk tim retail.",
         description="Workshop offline di toko simulasi Nomina; peserta praktik langsung dengan skenario pelanggan.",
         materials=[_art("Pre-reading: Siklus Penjualan Retail", "Greeting – probing – presenting – handling objection – closing – follow up.", 15)]),
    dict(code="NMA-DIG-140", title="Microsoft Excel untuk Analisis Data", category="Digital & Data", delivery_mode=ONLINE,
         duration_hours=10, level="Dasar", instructor="Kartika Sari", cover_color="#16A34A",
         badge_name="Excel Analyst", skills=["Pivot Table", "XLOOKUP", "Dashboard"],
         summary="Olah data operasional jadi laporan: rumus inti, PivotTable, dan dashboard sederhana.",
         description="Course online mandiri dengan file latihan. Dilengkapi sesi klinik live opsional.",
         materials=[
             _art("Rumus Inti: SUMIFS, COUNTIFS, XLOOKUP", "Tiga rumus yang menyelesaikan 80% kebutuhan laporan harian.", 40),
             _art("Membersihkan Data", "Text to columns, TRIM, remove duplicates, dan Power Query dasar.", 40),
             _art("PivotTable & PivotChart", "Meringkas ribuan baris data menjadi insight dalam hitungan menit.", 45),
             _link("Referensi Fungsi Excel (Microsoft Support)", "https://support.microsoft.com/excel", 20),
             _art("Membangun Dashboard Sederhana", "Gabungkan PivotChart, slicer, dan conditional formatting menjadi satu halaman ringkas.", 45),
         ]),
    dict(code="NMA-DIG-141", title="Dasar Data Analytics dengan SQL", category="Digital & Data", delivery_mode=ONLINE,
         duration_hours=12, level="Menengah", instructor="Kartika Sari", cover_color="#15803D",
         badge_name="SQL Explorer", skills=["SELECT & JOIN", "Agregasi", "Data Storytelling"],
         summary="Menulis query SQL untuk menjawab pertanyaan bisnis.",
         description="Course online dengan latihan query bertahap dari SELECT sampai window function sederhana.",
         materials=[
             _art("Konsep Database Relasional", "Tabel, baris, kolom, primary key dan foreign key.", 30),
             _art("SELECT, WHERE, ORDER BY", "Mengambil dan menyaring data.", 40),
             _art("JOIN Antar Tabel", "INNER, LEFT, dan kapan menggunakannya.", 45),
             _art("GROUP BY & Agregasi", "SUM, COUNT, AVG untuk ringkasan bisnis.", 45),
             _link("Latihan Interaktif SQL (W3Schools)", "https://www.w3schools.com/sql/", 45),
             _art("Dari Query ke Insight", "Menyusun temuan menjadi rekomendasi yang dapat ditindaklanjuti.", 30),
         ]),
    dict(code="NMA-DIG-142", title="Digital Marketing & Social Media", category="Digital & Data", delivery_mode=ONLINE,
         duration_hours=8, level="Dasar", instructor="Tim Nomina Academy", cover_color="#DB2777",
         badge_name="Digital Marketer", skills=["Content Planning", "Meta Ads", "Analytics"],
         summary="Strategi konten, iklan berbayar, dan membaca metrik media sosial.",
         description="Course online mandiri untuk tim sales, marketing, dan event.",
         materials=[
             _art("Customer Journey Digital", "Awareness – consideration – conversion – loyalty.", 30),
             _art("Content Pillar & Kalender Konten", "Menyusun rencana konten bulanan yang konsisten.", 30),
             _art("Dasar Iklan Berbayar", "Targeting, budget, dan A/B testing materi iklan.", 35),
             _art("Membaca Insight & KPI", "Reach, engagement rate, CTR, CPA — apa artinya dan kapan bertindak.", 30),
         ]),
    dict(code="NMA-CMP-150", title="K3 (Keselamatan & Kesehatan Kerja) Dasar", category="Compliance", delivery_mode=OFFLINE,
         duration_hours=4, level="Dasar", instructor="Ahli K3 Umum (mitra BNSP)", cover_color="#DC2626",
         badge_name="Safety First", is_mandatory=True, skills=["Identifikasi Bahaya", "APD", "Tanggap Darurat"],
         summary="Pelatihan wajib tahunan: identifikasi bahaya, APD, dan prosedur tanggap darurat.",
         description="Kelas offline wajib setiap tahun untuk seluruh karyawan, termasuk simulasi evakuasi.",
         materials=[_art("Pre-reading: Prosedur Evakuasi Gedung", "Kenali jalur evakuasi, titik kumpul, dan peran floor warden.", 10)]),
    dict(code="NMA-CMP-151", title="Anti-Fraud, Anti-Gratifikasi & Kode Etik", category="Compliance", delivery_mode=ONLINE,
         duration_hours=2, level="Dasar", instructor="Tim Legal & Kepatuhan", cover_color="#B91C1C",
         badge_name="Integrity Keeper", is_mandatory=True, skills=["Kode Etik", "Gratifikasi", "Whistleblowing"],
         summary="Wajib tahunan: memahami kode etik, gratifikasi, dan saluran pelaporan.",
         description="Course online singkat wajib tahunan sesuai nilai Integrity N.O.M.I.N.A.",
         materials=[
             _art("Nilai Integrity di Nomina", "Integrity adalah salah satu nilai inti N.O.M.I.N.A. Apa artinya dalam pekerjaan sehari-hari.", 20),
             _art("Mengenali Gratifikasi", "Contoh kasus pemberian hadiah dari klien/vendor dan cara melaporkannya.", 25),
             _art("Saluran Whistleblowing", "Cara melapor secara aman dan perlindungan bagi pelapor.", 15),
         ]),
    dict(code="NMA-CMP-152", title="Perlindungan Data Pribadi (UU PDP)", category="Compliance", delivery_mode=ONLINE,
         duration_hours=3, level="Dasar", instructor="Tim Legal & Kepatuhan", cover_color="#991B1B",
         badge_name="Data Guardian", is_mandatory=True, skills=["UU 27/2022", "Klasifikasi Data", "Insiden Data"],
         summary="Kewajiban menjaga data pribadi kandidat, talenta, dan pelanggan klien.",
         description="Wajib untuk semua yang mengakses data talent pool & pelanggan.",
         materials=[
             _art("Pokok-pokok UU No. 27 Tahun 2022", "Subjek data, pengendali, prosesor, dan dasar pemrosesan yang sah.", 30),
             _art("Klasifikasi & Penanganan Data", "Data umum vs spesifik; aturan berbagi data di call center & rekrutmen.", 30),
             _art("Prosedur Insiden Kebocoran Data", "Langkah 3×24 jam: identifikasi, laporkan, mitigasi.", 25),
         ]),
    dict(code="NMA-EO-160", title="Manajemen Event & Project Dasar", category="Event & Project", delivery_mode=BLENDED,
         duration_hours=10, level="Dasar", instructor="Bayu Saputra", cover_color="#CA8A04",
         badge_name="Event Ready", skills=["Rundown", "Vendor Management", "Risk Plan"],
         summary="Perencanaan event dari brief klien hingga evaluasi pasca-acara.",
         description="Modul online + workshop menyusun rundown dan rencana risiko untuk event nyata.",
         materials=[
             _art("Dari Brief ke Konsep", "Menerjemahkan objektif klien menjadi konsep acara.", 30),
             _art("Rundown, Timeline & PIC", "Menyusun rundown menit-per-menit dan matriks tanggung jawab.", 35),
             _art("Manajemen Vendor & Anggaran", "Membandingkan penawaran dan mengontrol biaya.", 30),
         ]),
    dict(code="NMA-HR-170", title="Coaching & Counseling Skills untuk Atasan", category="Leadership", delivery_mode=BLENDED,
         duration_hours=16, level="Lanjutan", instructor="Rina Pratama, CHRP", cover_color="#1D4ED8",
         badge_name="Certified Talent Coach", skills=["GROW Model", "Powerful Questions", "Career Conversation"],
         summary="Wajib untuk counselor: membimbing pengembangan talenta dengan pendekatan coaching.",
         description="Program sertifikasi internal counselor: modul online, praktik coaching berpasangan, dan observasi kelas.",
         materials=[
             _art("Coaching vs Mentoring vs Counseling", "Kapan memakai masing-masing pendekatan.", 30),
             _art("GROW Model", "Goal – Reality – Options – Will dalam sesi 30 menit.", 40),
             _art("Powerful Questions & Active Listening", "Bertanya untuk memancing refleksi, bukan memberi jawaban.", 35),
             _art("Individual Development Plan (IDP)", "Menyusun IDP dan target 40 jam pelatihan bersama counselee.", 35),
         ]),
    dict(code="NMA-PRD-180", title="Time Management & Produktivitas", category="Soft Skill", delivery_mode=ONLINE,
         duration_hours=4, level="Dasar", instructor="Tim Nomina Academy", cover_color="#0891B2",
         badge_name="Productivity Pro", skills=["Prioritas", "Time Blocking", "Fokus"],
         summary="Mengelola prioritas dan energi agar target kerja tercapai tanpa lembur berlebihan.",
         description="Course online singkat dengan template perencanaan mingguan.",
         materials=[
             _art("Matriks Eisenhower", "Membedakan mendesak vs penting.", 20),
             _art("Time Blocking", "Menjadwalkan kerja fokus dan mengurangi multitasking.", 25),
             _art("Review Mingguan", "Ritual 30 menit untuk merencanakan minggu berikutnya.", 20),
         ]),
    dict(code="NMA-LDR-102", title="Design Thinking & Problem Solving", category="Leadership", delivery_mode=OFFLINE,
         duration_hours=8, level="Menengah", instructor="Bayu Saputra", cover_color="#4F46E5",
         badge_name="Problem Solver", skills=["Empathize", "Ideation", "Prototyping"],
         summary="Workshop memecahkan masalah pelanggan dengan pendekatan design thinking.",
         description="Workshop offline sehari penuh berbasis tantangan nyata dari klien Nomina.",
         materials=[_art("Pre-reading: 5 Tahap Design Thinking", "Empathize, Define, Ideate, Prototype, Test.", 15)]),
    dict(code="NMA-AI-190", title="Produktivitas Kerja dengan Generative AI", category="Digital & Data", delivery_mode=ONLINE,
         duration_hours=6, level="Dasar", instructor="Lukman Hakim", cover_color="#9333EA",
         badge_name="AI-Ready Worker", skills=["Prompting", "Verifikasi Output", "Etika AI"],
         summary="Memakai asisten AI untuk menulis, merangkum, dan menganalisis — secara aman.",
         description="Course online dengan latihan prompt untuk tugas call center, sales, event, dan admin.",
         materials=[
             _art("Cara Kerja Generative AI", "Kemampuan dan keterbatasan model bahasa.", 20),
             _art("Menulis Prompt yang Efektif", "Konteks, peran, format, dan contoh.", 30),
             _art("Use Case per Fungsi", "Rangkuman tiket, draf email klien, analisis survei.", 35),
             _art("Keamanan Data & Etika", "Data apa yang tidak boleh dimasukkan ke tools AI publik.", 20),
             _art("Verifikasi Output", "Cek fakta, angka, dan bias sebelum dipakai.", 20),
         ]),
    dict(code="NMA-HR-171", title="Teknik Interview & Assessment Talenta", category="Talent Management", delivery_mode=ONLINE,
         duration_hours=6, level="Menengah", instructor="Dewi Lestari", cover_color="#0F766E",
         badge_name="Talent Assessor", skills=["Behavioral Interview", "STAR", "Scoring Rubric"],
         summary="Melakukan assessment talenta yang objektif sebelum masuk talent pool.",
         description="Course online untuk counselor & tim rekrutmen: interview berbasis kompetensi dan rubrik penilaian.",
         materials=[
             _art("Competency-Based Interview", "Menggali bukti perilaku masa lalu dengan metode STAR.", 30),
             _art("Rubrik Penilaian", "Skala 1–5 dan contoh jawaban per level.", 30),
             _art("Bias dalam Assessment", "Halo effect, similarity bias, dan cara menguranginya.", 25),
         ]),
    dict(code="NMA-FIN-195", title="Literasi Keuangan untuk Non-Finance", category="Soft Skill", delivery_mode=ONLINE,
         duration_hours=4, level="Dasar", instructor="Tim Adm. & Keuangan", cover_color="#65A30D",
         badge_name="Finance Savvy", is_published=False, skills=["Anggaran", "Laporan Laba Rugi"],
         summary="(Draft) Membaca laporan keuangan sederhana dan mengelola anggaran tim.",
         description="Draft course — belum dipublikasikan.",
         materials=[_art("Anggaran Tim", "Menyusun dan memonitor anggaran.", 25)]),
]

BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober",
         "November", "Desember"]
MEMBER_CODES = {"NMA-CMP-151", "NMA-CS-120", "NMA-CMP-150", "NMA-COM-110", "NMA-DIG-140", "NMA-PRD-180",
                "NMA-CMP-152", "NMA-CS-121", "NMA-AI-190", "NMA-LDR-101", "NMA-DIG-141", "NMA-DIG-142", "NMA-LDR-102"}

# Jadwal sesi kelas offline/blended historis: (bulan, tanggal) per tahun.
SESSION_SLOTS = [(2, 12), (4, 16), (6, 11), (8, 13), (9, 17), (11, 12)]


def _dt(d: date, h: int = 9, m: int = 0) -> datetime:
    return datetime.combine(d, time(h, m))


class Seeder:
    def __init__(self, db):
        self.db = db
        self.rng = random.Random(2026)
        self.ref = today()
        self.year = self.ref.year
        self.users: dict[str, User] = {}
        self.courses: dict[str, Course] = {}
        self.past_rooms: dict[tuple, Room] = {}
        self.admin: User | None = None

    # ------------------------------------------------------------------ base data
    def make_users(self):
        pw = hash_password(DEMO_PASSWORD, rounds=10)
        for email, name, title, dept in ADMINS:
            self.users[email] = User(email=email, name=name, role=ADMIN, job_title=title, department=dept,
                                     password_hash=pw, joined_at=date(self.year - 3, 1, 9))
        for email, name, title, dept, _ in COUNSELORS:
            self.users[email] = User(email=email, name=name, role=COUNSELOR, job_title=title, department=dept,
                                     password_hash=pw, joined_at=date(self.year - 3, 3, 1))
        for i, (email, name, title, dept, counselor, _) in enumerate(COUNSELEES):
            self.users[email] = User(email=email, name=name, role=COUNSELEE, job_title=title, department=dept,
                                     password_hash=pw, joined_at=date(self.year - 2, 1 + i % 12, 2))
        self.db.add_all(self.users.values())
        self.db.flush()
        for email, *_rest in COUNSELEES:
            self.users[email].counselor_id = self.users[_rest[3]].id
        self.admin = self.users["admin@nomina.id"]

    def make_courses(self):
        for spec in COURSES:
            spec = dict(spec)
            mats = spec.pop("materials", [])
            c = Course(**spec, created_by_id=self.admin.id, created_at=_dt(date(self.year - 2, 1, 5)))
            for i, m in enumerate(mats):
                c.materials.append(CourseMaterial(position=i, **m))
            self.db.add(c)
            self.courses[spec["code"]] = c
        self.db.flush()

    # ------------------------------------------------------------------ helpers
    def u(self, key: str) -> User:
        return self.users[key if "@" in key else f"{key}@nomina.id"]

    def counselor_of(self, u: User) -> User:
        return next((x for x in self.users.values() if x.id == u.counselor_id), self.admin)

    def past_room(self, c: Course, on: date) -> Room:
        key = (c.id, on)
        if key not in self.past_rooms:
            online_live = c.delivery_mode == BLENDED and self.rng.random() < 0.5
            fac = {"NMA-SLS-130": "dewi", "NMA-CS-121": "counselor", "NMA-EO-160": "bayu",
                   "NMA-LDR-102": "bayu"}.get(c.code)
            r = Room(course_id=c.id, title=f"{c.title} — Batch {BULAN[on.month - 1]} {on.year}",
                     mode=ONLINE if online_live else OFFLINE,
                     platform=self.rng.choice(["zoom", "teams", "gmeet"]) if online_live else "offline",
                     location="" if online_live else HQ + f", Ruang {self.rng.choice(['Akselerasi 1', 'Akselerasi 2', 'Mastery', 'Nimble'])}",
                     start_at=_dt(on, 9), end_at=_dt(on, 9) + timedelta(hours=min(c.duration_hours, 8)),
                     capacity=25, facilitator_id=(self.u(fac) if fac else self.admin).id, created_by_id=self.admin.id,
                     created_at=_dt(on - timedelta(days=30)))
            if online_live:
                link = demo_link(r.platform, self.rng)
                r.meeting_url, r.meeting_code, r.link_source = link["meeting_url"], link["meeting_code"], "demo"
            self.db.add(r)
            self.past_rooms[key] = r
        return self.past_rooms[key]

    def session_date_before(self, year: int, limit: date) -> date | None:
        options = [date(year, m, d) for m, d in SESSION_SLOTS if date(year, m, d) <= limit]
        return self.rng.choice(options) if options else None

    def completed(self, u: User, c: Course, done_on: date, source: str | None = None):
        """Course selesai lengkap dengan riwayat: assign → mulai → materi → hadir → selesai → sertifikat."""
        rng = self.rng
        source = source or rng.choice([SRC_ASSIGNED, SRC_ASSIGNED, SRC_SELF, SRC_SUGGESTED])
        assigner = None
        if source != SRC_SELF:
            assigner = self.admin if (u.role == COUNSELOR or c.is_mandatory) else self.counselor_of(u)
        created = _dt(done_on - timedelta(days=rng.randint(20, 60)), rng.randint(8, 11))
        started = created + timedelta(days=rng.randint(1, 10), hours=rng.randint(0, 6))
        if started.date() > done_on:
            started = _dt(done_on, 8)
        due = done_on + timedelta(days=rng.randint(3, 30)) if source == SRC_ASSIGNED else None
        e = Enrollment(user_id=u.id, course_id=c.id, source=source, assigned_by_id=assigner.id if assigner else None,
                       status=IN_PROGRESS, due_date=due, created_at=created, started_at=started)
        self.db.add(e)
        self._log_created(e, u, c, assigner, created)
        log(self.db, u.id, "started", f"Mulai mengikuti \"{c.title}\"", u.id, c.id, started)
        if c.delivery_mode in (ONLINE, BLENDED):
            span = max((_dt(done_on, 15) - started).total_seconds(), 3600)
            for i, m in enumerate(c.materials):
                at = started + timedelta(seconds=span * (i + 1) / (len(c.materials) + 1))
                e.progress.append(MaterialProgress(material_id=m.id, completed_at=at))
        if c.delivery_mode in (OFFLINE, BLENDED):
            r = self.past_room(c, done_on)
            r.participants.append(RoomParticipant(user_id=u.id, status="attended", marked_at=r.end_at))
            e.attended = True
            log(self.db, u.id, "attended", f"Hadir di kelas \"{r.title}\"", r.facilitator_id, c.id, r.end_at)
        self.db.flush()
        complete_enrollment(self.db, e, at=_dt(done_on, rng.randint(13, 17), rng.choice([0, 15, 30, 45])),
                            actor_id=u.id)
        return e

    def _log_created(self, e, u, c, assigner, at):
        if e.source == SRC_SELF:
            log(self.db, u.id, "enrolled", f"Mendaftar course \"{c.title}\" secara mandiri", u.id, c.id, at)
        else:
            verb = "menyarankan" if e.source == SRC_SUGGESTED else "menugaskan"
            due = f" (tenggat {e.due_date.strftime('%d/%m/%Y')})" if e.due_date else ""
            log(self.db, u.id, e.source, f"{assigner.name} {verb} course \"{c.title}\"{due}", assigner.id, c.id, at)

    def active(self, u: User, c: Course, due_in: int | None, source: str = SRC_ASSIGNED, done_materials: int = 0,
               note: str = "", assigner: User | None = None):
        if source != SRC_SELF:
            assigner = assigner or (self.admin if (u.role == COUNSELOR or c.is_mandatory) else self.counselor_of(u))
        created = _dt(self.ref - timedelta(days=self.rng.randint(15, 70)), self.rng.randint(8, 16))
        due = self.ref + timedelta(days=due_in) if due_in is not None else None
        e = Enrollment(user_id=u.id, course_id=c.id, source=source, note=note,
                       assigned_by_id=assigner.id if assigner else None, due_date=due, created_at=created,
                       status=SUGGESTED if source == SRC_SUGGESTED else NOT_STARTED)
        self.db.add(e)
        self._log_created(e, u, c, assigner, created)
        done_materials = min(done_materials, len(c.materials)) if c.delivery_mode != OFFLINE else 0
        if done_materials:
            e.status = IN_PROGRESS
            e.started_at = created + timedelta(days=2)
            log(self.db, u.id, "started", f"Mulai mengikuti \"{c.title}\"", u.id, c.id, e.started_at)
            for i, m in enumerate(c.materials[:done_materials]):
                e.progress.append(MaterialProgress(material_id=m.id, completed_at=e.started_at + timedelta(days=i + 1)))
        return e

    def fill_year(self, u: User, year: int, goal: float, exclude: set[str]):
        """Lengkapi course selesai dalam satu tahun hingga mendekati target jam `goal`."""
        limit = date(year, 12, 20) if year < self.year else self.ref - timedelta(days=4)
        pool = [c for c in self.courses.values() if c.is_published and c.code not in exclude]
        self.rng.shuffle(pool)
        # Course wajib (compliance) diutamakan.
        pool.sort(key=lambda c: not c.is_mandatory)
        total, taken = 0.0, set()
        for c in pool:
            if total >= goal:
                break
            if total + c.duration_hours > goal + 4:
                continue
            if c.delivery_mode in (OFFLINE, BLENDED):
                on = self.session_date_before(year, limit)
                if not on:
                    continue
            else:
                start = date(year, 1, 8)
                on = start + timedelta(days=self.rng.randint(0, max((limit - start).days, 1)))
            self.completed(u, c, on)
            total += c.duration_hours
            exclude.add(c.code)
            taken.add(c.code)
        return taken

    # ------------------------------------------------------------------ scenarios
    def history(self):
        """Riwayat tahun lalu + jam tahun berjalan semua peserta (selain skenario khusus)."""
        prev = self.year - 1
        goals = {e: g for e, *_m, g in COUNSELORS}
        goals.update({e: g for e, *_m, g in COUNSELEES})
        mandatory = {code for code, c in self.courses.items() if c.is_mandatory}
        for email, u in self.users.items():
            if u.role == ADMIN:
                continue
            reserved = set(self.reserved.get(email, ()))
            if email == "member@nomina.id":
                reserved |= MEMBER_CODES
            # Tahun lalu: mayoritas tercapai, beberapa tidak — terlihat di riwayat per tahun.
            # Course wajib (compliance) diulang tiap tahun; course lain tidak diambil dua kali.
            prev_goal = self.rng.choice([30, 36, 40, 42, 44, 46]) if email != "gita@nomina.id" else 24
            taken = self.fill_year(u, prev, prev_goal, reserved - mandatory)
            if email == "member@nomina.id":
                continue
            self.fill_year(u, self.year, goals[email], reserved | (taken - mandatory))

    def member_story(self):
        """Siti Rahmawati — akun demo counselee dengan semua status yang mungkin."""
        s = self.u("member")
        c = self.courses
        on = lambda m, d: date(self.year, m, d) if date(self.year, m, d) < self.ref else self.ref - timedelta(days=5)  # noqa: E731
        self.completed(s, c["NMA-CMP-151"], on(1, 20), SRC_ASSIGNED)          # 2 jam
        self.completed(s, c["NMA-CS-120"], on(2, 26), SRC_ASSIGNED)           # 6 jam
        self.completed(s, c["NMA-CMP-150"], self.session_date_before(self.year, self.ref) or on(4, 16), SRC_ASSIGNED)  # 4
        self.completed(s, c["NMA-COM-110"], date(self.year, 6, 11) if date(self.year, 6, 11) < self.ref else on(6, 11), SRC_SUGGESTED)  # 8
        self.completed(s, c["NMA-DIG-140"], on(7, 30), SRC_SELF)              # 10
        self.completed(s, c["NMA-PRD-180"], on(9, 8), SRC_SELF)               # 4  → total 34 jam

        andi = self.u("counselor")
        self.active(s, c["NMA-CMP-152"], -12, done_materials=1, assigner=self.admin,
                    note="Wajib bagi semua yang mengakses data pelanggan klien.")
        self.active(s, c["NMA-CS-121"], 9, assigner=andi,
                    note="Persiapan menangani eskalasi pelanggan klien Fanindo.")
        self.active(s, c["NMA-AI-190"], 24, done_materials=2, assigner=self.admin,
                    note="Program digital upskilling 2026 untuk seluruh karyawan.")
        self.active(s, c["NMA-LDR-101"], 70, done_materials=1, assigner=andi,
                    note="Disiapkan untuk jalur promosi Team Leader tahun depan.")
        self.active(s, c["NMA-DIG-141"], 125, source=SRC_SELF)
        self.active(s, c["NMA-DIG-142"], None, source=SRC_SUGGESTED, assigner=andi,
                    note="Membantu kampanye media sosial klien call center.")
        self.active(s, c["NMA-LDR-102"], 60, source=SRC_SUGGESTED, assigner=andi,
                    note="Opsional — bagus untuk proyek perbaikan proses layanan.")

    reserved = {
        "member@nomina.id": [],
        "counselor@nomina.id": ["NMA-CMP-151", "NMA-HR-170", "NMA-CMP-150", "NMA-AI-190", "NMA-HR-171"],
        "dewi@nomina.id": ["NMA-HR-170", "NMA-CMP-152"],
        "bayu@nomina.id": ["NMA-HR-170", "NMA-AI-190"],
        "budi@nomina.id": ["NMA-CS-121", "NMA-LDR-101"],
        "citra@nomina.id": ["NMA-CS-121", "NMA-CMP-152", "NMA-CS-120"],
        "dimas@nomina.id": ["NMA-DIG-141", "NMA-CMP-150"],
        "eka@nomina.id": ["NMA-SLS-130", "NMA-DIG-142"],
        "fajar@nomina.id": ["NMA-SLS-130", "NMA-LDR-101", "NMA-CMP-151"],
        "gita@nomina.id": ["NMA-SLS-130", "NMA-COM-110", "NMA-CMP-150"],
        "hendra@nomina.id": ["NMA-AI-190", "NMA-SLS-130"],
        "intan@nomina.id": ["NMA-EO-160", "NMA-LDR-102"],
        "joko@nomina.id": ["NMA-EO-160", "NMA-CMP-152", "NMA-PRD-180"],
        "kartika@nomina.id": ["NMA-AI-190"],
        "lukman@nomina.id": ["NMA-DIG-141", "NMA-LDR-102"],
    }

    def team_stories(self):
        c = self.courses
        a = self.active
        # Counselor Andi juga wajib 40 jam: overdue, mendekati tenggat, dan terjadwal.
        andi = self.u("counselor")
        a(andi, c["NMA-CMP-151"], -5, note="Wajib tahunan seluruh karyawan.")
        a(andi, c["NMA-HR-170"], 40, done_materials=3, note="Sertifikasi internal wajib untuk counselor.")
        a(andi, c["NMA-CMP-150"], 80, note="Wajib tahunan seluruh karyawan.")
        a(andi, c["NMA-AI-190"], 150, note="Program digital upskilling 2026.")
        a(andi, c["NMA-HR-171"], None, source=SRC_SELF, done_materials=1)
        dewi, bayu = self.u("dewi"), self.u("bayu")
        a(dewi, c["NMA-HR-170"], 40, done_materials=4)
        a(dewi, c["NMA-CMP-152"], 18, done_materials=2)
        a(bayu, c["NMA-HR-170"], 40, done_materials=2)
        a(bayu, c["NMA-AI-190"], -20, done_materials=3)

        a(self.u("budi"), c["NMA-CS-121"], 9)
        a(self.u("budi"), c["NMA-LDR-101"], 70, done_materials=4)
        a(self.u("citra"), c["NMA-CS-121"], 9)
        a(self.u("citra"), c["NMA-CMP-152"], -30)
        a(self.u("citra"), c["NMA-CS-120"], -8, done_materials=2)
        a(self.u("dimas"), c["NMA-DIG-141"], 55, done_materials=3)
        a(self.u("dimas"), c["NMA-CMP-150"], 80)
        a(self.u("eka"), c["NMA-SLS-130"], 12)
        a(self.u("eka"), c["NMA-DIG-142"], None, source=SRC_SUGGESTED)
        a(self.u("fajar"), c["NMA-SLS-130"], 12)
        a(self.u("fajar"), c["NMA-LDR-101"], 70, done_materials=2)
        a(self.u("fajar"), c["NMA-CMP-151"], -3)
        a(self.u("gita"), c["NMA-SLS-130"], 12)
        a(self.u("gita"), c["NMA-COM-110"], -25)  # absen di kelas sebelumnya → overdue
        a(self.u("gita"), c["NMA-CMP-150"], -40)
        a(self.u("hendra"), c["NMA-AI-190"], 24, done_materials=4)
        a(self.u("hendra"), c["NMA-SLS-130"], None, source=SRC_SUGGESTED)
        a(self.u("intan"), c["NMA-EO-160"], 15, done_materials=3)
        a(self.u("intan"), c["NMA-LDR-102"], 33)
        a(self.u("joko"), c["NMA-EO-160"], 15, done_materials=1)
        a(self.u("joko"), c["NMA-CMP-152"], -15, done_materials=1)
        a(self.u("joko"), c["NMA-PRD-180"], 110, source=SRC_SELF)
        a(self.u("kartika"), c["NMA-AI-190"], 140, source=SRC_SELF, done_materials=1)
        a(self.u("lukman"), c["NMA-DIG-141"], 160, source=SRC_SELF, done_materials=2)
        a(self.u("lukman"), c["NMA-LDR-102"], 33, source=SRC_SUGGESTED)
        self.db.flush()

    def upcoming_rooms(self):
        t = now().replace(second=0)
        ref = self.ref
        c = self.courses

        def room(code, title, days, hour, hours, mode, platform, fac, people, cap=25, notes="", start=None):
            course = c[code]
            st = start or _dt(ref + timedelta(days=days), hour)
            r = Room(course_id=course.id, title=title, mode=mode, platform=platform if mode == ONLINE else "offline",
                     location="" if mode == ONLINE else HQ + ", Ruang Akselerasi 2", start_at=st,
                     end_at=st + timedelta(hours=hours), capacity=cap, facilitator_id=self.u(fac).id,
                     created_by_id=self.u(fac).id, notes=notes, created_at=_dt(ref - timedelta(days=10)))
            if mode == ONLINE:
                link = demo_link(platform, self.rng)
                r.meeting_url, r.meeting_code, r.link_source = link["meeting_url"], link["meeting_code"], "demo"
            for p in people:
                usr = self.u(p)
                r.participants.append(RoomParticipant(user_id=usr.id))
                log(self.db, usr.id, "room_invited",
                    f"Diundang ke kelas \"{title}\" ({st.strftime('%d/%m/%Y %H:%M')})", r.created_by_id, course.id,
                    r.created_at)
            self.db.add(r)
            return r

        # Sedang berlangsung sekarang (demo tombol "Gabung sekarang")
        room("NMA-DIG-141", "Klinik SQL: Tanya Jawab Live", 0, 0, 1.5, ONLINE, "zoom", "bayu",
             ["dimas", "lukman", "member"], notes="Sesi tanya jawab live opsional untuk peserta course SQL.",
             start=t - timedelta(minutes=30))
        room("NMA-AI-190", "Webinar: Prompting untuk Tugas Harian", 3, 14, 2, ONLINE, "teams", "bayu",
             ["member", "hendra", "kartika", "bayu", "counselor"], cap=100,
             notes="Sesi live pendamping course online Generative AI.")
        room("NMA-CS-121", "Handling Complaint — Batch Call Center Fanindo", 6, 9, 6, OFFLINE, None, "counselor",
             ["member", "budi", "citra"], cap=20, notes="Bawa contoh rekaman komplain (tanpa data pribadi pelanggan).")
        room("NMA-SLS-130", "Teknik Penjualan Retail — Batch Hubcoop", 12, 9, 8, OFFLINE, None, "dewi",
             ["eka", "fajar", "gita"], cap=20)
        room("NMA-EO-160", "Workshop Rundown & Risk Plan Event", 15, 13, 3, ONLINE, "gmeet", "bayu",
             ["intan", "joko"], notes="Siapkan draf rundown event Imagiive bulan depan.")
        room("NMA-HR-170", "Coaching Lab untuk Counselor", 20, 9, 7, OFFLINE, None, "admin",
             ["counselor", "dewi", "bayu"], cap=12, notes="Praktik coaching berpasangan + observasi.")
        room("NMA-LDR-102", "Design Thinking Sprint", 33, 9, 8, OFFLINE, None, "bayu", ["intan"], cap=20)
        room("NMA-LDR-101", "Leadership Live Class — Role Play", 45, 13, 3, ONLINE, "zoom", "admin",
             ["member", "budi", "fajar"], notes="Sesi live wajib bagi peserta blended Dasar Kepemimpinan.")
        room("NMA-CMP-150", "K3 Dasar — Batch Q4", 60, 8, 4, OFFLINE, None, "admin",
             ["counselor", "dimas"], cap=40, notes="Termasuk simulasi evakuasi gedung.")

        # Riwayat absen: Gita tidak hadir di kelas Komunikasi Efektif sebelumnya.
        prev = self.ref - timedelta(days=32)
        r = Room(course_id=c["NMA-COM-110"].id, title="Komunikasi Efektif — Batch Retail",
                 mode=OFFLINE, platform="offline", location=HQ + ", Ruang Mastery", start_at=_dt(prev, 9),
                 end_at=_dt(prev, 17), capacity=20, facilitator_id=self.admin.id, created_by_id=self.admin.id,
                 created_at=_dt(prev - timedelta(days=20)))
        r.participants.append(RoomParticipant(user_id=self.u("gita").id, status="absent", marked_at=_dt(prev, 17)))
        log(self.db, self.u("gita").id, "absent", f"Tidak hadir di kelas \"{r.title}\"", self.admin.id,
            c["NMA-COM-110"].id, _dt(prev, 17))
        self.db.add(r)

    def renumber_certificates(self):
        """Nomor sertifikat berurutan sesuai tanggal selesai (seed tidak membuat data secara kronologis)."""
        self.db.flush()
        rows = self.db.query(Enrollment).filter(Enrollment.certificate_no.isnot(None)) \
            .order_by(Enrollment.completed_at).all()
        for e in rows:
            e.certificate_no = f"TMP-{e.id}"
        self.db.flush()
        seq: dict[int, int] = {}
        for e in rows:
            y = e.completed_at.year
            seq[y] = seq.get(y, 0) + 1
            e.certificate_no = f"NMA/{y}/{seq[y]:05d}"

    def run(self):
        self.make_users()
        self.make_courses()
        self.member_story()
        self.history()
        self.team_stories()
        self.upcoming_rooms()
        self.renumber_certificates()
        self.db.commit()


def seed(reset: bool = False):
    if reset:
        Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if db.query(User).first():
            print("Database sudah berisi data. Gunakan --reset untuk mengisi ulang.")
            return
        Seeder(db).run()
        print(f"Data sampel dibuat. Login dengan kata sandi '{DEMO_PASSWORD}'.")


if __name__ == "__main__":
    seed(reset="--reset" in sys.argv)
