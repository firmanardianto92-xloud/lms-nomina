import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight, Award, BellRing, Building2, CalendarDays, ChevronDown, Clock, GraduationCap, Laptop, Layers, LogIn,
  Menu, ShieldCheck, Target, Users, X,
} from "lucide-react";
import { api } from "@/lib/api";
import { useMe } from "@/lib/session";
import { LogoMark } from "@/components/Logo";
import { MODE, ModeBadge, PROVIDER, ProviderBadge, cx, modeColor } from "@/components/ui";
import { fmtHours, initials } from "@/lib/format";

const NAV = [
  { label: "Program", items: [["Course online", "#program"], ["Kelas offline", "#program"], ["Blended", "#program"], ["Udemy & Coursera", "#program"]] },
  { label: "Untuk Perusahaan", items: [["Fitur LMS", "#fitur"], ["Cara kerja", "#cara-kerja"], ["Pertanyaan umum", "#faq"]] },
  { label: "Course Populer", href: "#populer" },
  { label: "FAQ", href: "#faq" },
];

export default function Landing() {
  const { data: me } = useMe();
  const { data } = useQuery({ queryKey: ["landing"], queryFn: () => api.get("/public/landing") });
  const cta = me ? { to: "/", label: "Buka dashboard" } : { to: "/login", label: "Masuk ke LMS" };
  return (
    <div className="min-h-full bg-white text-slate-800">
      <NavBar cta={cta} />
      <Hero data={data} cta={cta} />
      <Stats stats={data?.stats} />
      <Programs data={data} />
      <Popular featured={data?.featured} cta={cta} />
      <HowItWorks />
      <Features />
      <CtaBand cta={cta} />
      <Faq />
      <Footer />
    </div>
  );
}

// ------------------------------------------------------------------ navbar
function NavBar({ cta }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3.5 sm:px-6 lg:px-8">
        <a href="#top" className="flex items-center gap-2.5">
          <LogoMark className="h-8" />
          <span className="leading-none">
            <span className="block text-xl font-extrabold tracking-tight text-hero">Nomina</span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.25em] text-brand-500">Academy</span>
          </span>
        </a>
        <nav className="ml-6 hidden flex-1 items-center gap-1 lg:flex" aria-label="Menu utama">
          {NAV.map((n) =>
            n.items ? (
              <div key={n.label} className="group relative">
                <button className="flex items-center gap-1 rounded-lg px-3 py-2 text-[15px] text-slate-600 hover:text-slate-900 cursor-pointer">
                  {n.label} <ChevronDown className="size-4 transition group-hover:rotate-180" />
                </button>
                <div className="invisible absolute left-0 top-full z-50 min-w-52 rounded-xl border border-slate-100 bg-white p-2 opacity-0 shadow-xl transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                  {n.items.map(([l, h]) => (
                    <a key={l} href={h} className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">{l}</a>
                  ))}
                </div>
              </div>
            ) : (
              <a key={n.label} href={n.href} className="rounded-lg px-3 py-2 text-[15px] text-slate-600 hover:text-slate-900">{n.label}</a>
            ),
          )}
        </nav>
        <Link to={cta.to} className="ml-auto hidden rounded-xl border-2 border-brand-500 px-5 py-2 text-[15px] font-semibold text-brand-600 transition hover:bg-brand-50 sm:block">
          {cta.label}
        </Link>
        <button className="ml-auto sm:ml-0 lg:hidden cursor-pointer" onClick={() => setOpen(!open)} aria-label="Menu">
          {open ? <X className="size-6" /> : <Menu className="size-6" />}
        </button>
      </div>
      {open && (
        <div className="border-t border-slate-100 bg-white px-4 py-3 lg:hidden">
          {NAV.flatMap((n) => (n.items ? n.items : [[n.label, n.href]])).map(([l, h]) => (
            <a key={l} href={h} onClick={() => setOpen(false)} className="block rounded-lg px-2 py-2 text-sm text-slate-700">{l}</a>
          ))}
          <Link to={cta.to} className="mt-2 block rounded-xl border-2 border-brand-500 px-4 py-2 text-center font-semibold text-brand-600">{cta.label}</Link>
        </div>
      )}
    </header>
  );
}

// ------------------------------------------------------------------ hero
function Hero({ data, cta }) {
  const h = data?.highlights || [];
  const cols = [h.filter((_, i) => i % 3 === 0), h.filter((_, i) => i % 3 === 1), h.filter((_, i) => i % 3 === 2)];
  return (
    <section id="top" className="relative overflow-hidden bg-hero text-white">
      <HeroPattern />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1.2fr_1fr] lg:px-8">
        <div className="py-16 lg:py-28">
          <h1 className="text-[38px] font-extrabold leading-[1.15] tracking-tight sm:text-5xl xl:text-[54px]">
            Upskilling <Mark>terarah</Mark>,<br />
            didampingi <em className="font-extrabold">counselor</em><br />
            sampai <Mark>target tercapai</Mark>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-white/85 sm:text-[22px]">
            Portal pengembangan skill karyawan dengan course online dan offline, target 40 jam per tahun, pengingat tenggat, serta sertifikat dan badge di setiap course.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link to={cta.to} className="inline-flex items-center gap-2.5 rounded-xl bg-cta px-7 py-4 text-lg font-semibold text-white shadow-lg shadow-black/20 transition hover:brightness-110">
              <LogIn className="size-5" /> {cta.label}
            </Link>
            <a href="#program" className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-6 py-4 text-lg font-semibold text-white transition hover:bg-white/10">
              Lihat program <ArrowRight className="size-5" />
            </a>
          </div>
          <p className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-white/80">
            <ShieldCheck className="size-5 text-brand-200" />
            Mitra pilot: PNM · Kemnaker · Kemenkes · BPJS · Perumda Pasar Jaya
          </p>
        </div>
        {/* Dinding kartu peserta yang baru menyelesaikan course */}
        <div className="relative hidden h-[680px] grid-cols-3 gap-5 lg:grid" aria-label="Peserta yang baru menyelesaikan course">
          {cols.map((c, i) => (
            <div key={i} className="wall-mask overflow-hidden">
              <div className={cx("wall-col flex flex-col gap-5", i === 1 ? "wall-slow" : i === 2 ? "wall-fast" : "")}>
                {[...c, ...c].map((x, j) => <PersonCard key={j} p={x} hidden={j >= c.length} />)}
              </div>
            </div>
          ))}
        </div>
      </div>
      {h.length > 0 && (
        <div className="relative flex gap-4 overflow-x-auto px-4 pb-10 lg:hidden">
          {h.slice(0, 6).map((p, i) => <div key={i} className="w-56 shrink-0"><PersonCard p={p} /></div>)}
        </div>
      )}
    </section>
  );
}

const Mark = ({ children }) => (
  <span className="box-decoration-clone bg-mark px-1.5 text-white">{children}</span>
);

function PersonCard({ p, hidden }) {
  const color = modeColor(p.mode);
  return (
    <article className="overflow-hidden rounded-2xl bg-white text-center text-slate-800 shadow-lg shadow-black/20" aria-hidden={hidden || undefined}>
      <div className="relative flex h-36 items-center justify-center" style={{ background: `linear-gradient(160deg, ${color}, ${color}bb)` }}>
        <span className="text-5xl font-extrabold text-white/95">{initials(p.name)}</span>
        <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold" style={{ color }}>
          <Award className="size-3" /> {p.badge}
        </span>
      </div>
      <div className="px-4 pb-5 pt-4">
        <p className="text-[17px] font-bold text-slate-900">{p.name}</p>
        <p className="mt-1.5 text-[14px] leading-snug text-slate-600">{p.job_title} · {p.department}</p>
        <p className="mt-1.5 text-[12.5px] leading-snug text-slate-500">({p.course_title})</p>
      </div>
    </article>
  );
}

function HeroPattern() {
  // Garis sirkuit tipis + grid titik, dekoratif.
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" preserveAspectRatio="xMidYMid slice" viewBox="0 0 1440 760">
      <g fill="none" stroke="currentColor" strokeWidth="2" className="text-white/[0.07]">
        <path d="M-20 180 H360 Q390 180 390 210 V520 Q390 550 420 550 H760" />
        <path d="M120 760 V640 Q120 610 150 610 H520 Q550 610 550 580 V90 Q550 60 580 60 H900" />
        <path d="M700 -10 V140 Q700 170 730 170 H1460" />
        <path d="M960 760 V420 Q960 390 990 390 H1460" />
      </g>
      <g className="fill-brand-500/25">
        {Array.from({ length: 30 }, (_, i) => <circle key={i} cx={95 + (i % 5) * 40} cy={150 + Math.floor(i / 5) * 40} r="5" />)}
      </g>
    </svg>
  );
}

// ------------------------------------------------------------------ stats
function Stats({ stats }) {
  const items = [
    [stats?.courses ?? "–", "course aktif", "online, offline, blended, Udemy & Coursera"],
    [stats ? stats.hours_year.toLocaleString("id-ID") : "–", `jam pelatihan ${stats?.year ?? ""}`, "jam dihitung saat course selesai"],
    [stats?.completions_year ?? "–", "course diselesaikan", `sepanjang ${stats?.year ?? "tahun ini"}`],
    ["40 jam", "target per orang", "per tahun, untuk karyawan dan counselor"],
  ];
  return (
    <section className="border-b border-slate-100 bg-white">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-10 sm:px-6 lg:grid-cols-4 lg:px-8">
        {items.map(([v, l, s]) => (
          <div key={l}>
            <p className="text-3xl font-extrabold text-hero sm:text-4xl">{v}</p>
            <p className="mt-1 font-semibold text-slate-800">{l}</p>
            <p className="text-sm text-slate-500">{s}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ programs
const SectionHead = ({ eyebrow, title, sub }) => (
  <div className="mb-10 max-w-2xl">
    <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand-600">{eyebrow}</p>
    <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-hero sm:text-4xl">{title}</h2>
    {sub && <p className="mt-3 text-lg text-slate-600">{sub}</p>}
  </div>
);

function Programs({ data }) {
  const modes = data?.modes || {};
  const prov = data?.providers || {};
  const cards = [
    { key: "online", icon: Laptop, title: "Course online", text: "Belajar mandiri lewat materi, video, dan link; selesai saat semua materi ditandai.", count: modes.online, color: MODE.online.color },
    { key: "offline", icon: Building2, title: "Kelas offline", text: "Workshop tatap muka di ruang training; selesai saat fasilitator mengisi absensi hadir.", count: modes.offline, color: MODE.offline.color },
    { key: "blended", icon: Layers, title: "Blended", text: "Gabungan materi online dan kelas live atau tatap muka untuk topik yang butuh praktik.", count: modes.blended, color: MODE.blended.color },
    { key: "ext", icon: GraduationCap, title: "Udemy & Coursera", text: "Course dari platform global, progresnya tersinkron dan jamnya masuk ke target yang sama.", count: (prov.udemy || 0) + (prov.coursera || 0), color: PROVIDER.udemy.color },
  ];
  return (
    <section id="program" className="scroll-mt-20 bg-slate-50 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHead eyebrow="Program" title="Empat cara belajar, satu catatan jam" sub="Apa pun jenisnya, jam dihitung penuh sesuai durasi resmi saat course selesai." />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <div key={c.key} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="flex size-12 items-center justify-center rounded-xl text-white" style={{ background: c.color }}><c.icon className="size-6" /></div>
              <h3 className="mt-5 text-xl font-bold text-slate-900">{c.title}</h3>
              <p className="mt-2 flex-1 text-[15px] leading-relaxed text-slate-600">{c.text}</p>
              <p className="mt-5 text-sm font-semibold" style={{ color: c.color }}>{c.count ?? "–"} course tersedia</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ popular courses
function Popular({ featured, cta }) {
  return (
    <section id="populer" className="scroll-mt-20 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHead eyebrow="Course populer" title="Paling banyak diselesaikan" sub="Dari katalog Nomina Academy dan mitra platform." />
          <Link to={cta.to} className="mb-10 inline-flex items-center gap-1.5 font-semibold text-brand-600 hover:underline">Lihat semua di LMS <ArrowRight className="size-4" /></Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {(featured || []).map((c) => (
            <Link key={c.id} to={cta.to} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="h-24 p-5" style={{ background: `linear-gradient(135deg, ${modeColor(c.delivery_mode)}, ${modeColor(c.delivery_mode)}cc)` }}>
                <p className="text-xs font-bold uppercase tracking-wider text-white/85">{c.category}</p>
              </div>
              <div className="p-5">
                <div className="flex flex-wrap gap-1.5"><ModeBadge mode={c.delivery_mode} /><ProviderBadge provider={c.provider} /></div>
                <h3 className="mt-3 text-lg font-bold leading-snug text-slate-900 group-hover:text-brand-600">{c.title}</h3>
                <p className="mt-1.5 line-clamp-2 text-[15px] text-slate-600">{c.summary}</p>
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                  <span className="flex items-center gap-1"><Clock className="size-4" /> {fmtHours(c.duration_hours)}</span>
                  <span className="flex items-center gap-1"><Users className="size-4" /> {c.completions} selesai</span>
                  {c.badge_name && <span className="flex items-center gap-1"><Award className="size-4" /> {c.badge_name}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ how it works
function HowItWorks() {
  const steps = [
    ["Admin L&D", "Menyusun katalog, mengunggah materi, mengimpor course Udemy/Coursera, dan memantau seluruh peserta."],
    ["Counselor", "Menugaskan course wajib dengan tenggat, menyarankan course, membuka kelas, dan memantau timnya."],
    ["Karyawan", "Mengikuti course, hadir di kelas, mengumpulkan jam menuju 40 jam, dan mendapat badge serta sertifikat."],
  ];
  return (
    <section id="cara-kerja" className="scroll-mt-20 bg-hero py-20 text-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand-200">Cara kerja</p>
        <h2 className="mt-2 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">Tiga peran, satu alur pengembangan</h2>
        <ol className="mt-10 grid gap-5 md:grid-cols-3">
          {steps.map(([t, d], i) => (
            <li key={t} className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <span className="flex size-10 items-center justify-center rounded-full bg-mark text-lg font-extrabold">{i + 1}</span>
              <h3 className="mt-4 text-xl font-bold">{t}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-white/80">{d}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ features
function Features() {
  const f = [
    [Target, "Target 40 jam otomatis", "Jam tiap karyawan dan counselor terhitung sendiri, lengkap dengan status sesuai jalur atau tertinggal."],
    [BellRing, "Pengingat 90 hari", "Course mulai muncul di jadwal 90 hari sebelum tenggat, dengan pengingat 30 dan 14 hari serta daftar overdue."],
    [CalendarDays, "Kelas online & offline", "Link Zoom, Microsoft Teams, atau Google Meet dibuat otomatis; kelas tatap muka dengan absensi."],
    [Award, "Sertifikat & badge", "Setiap course yang selesai menghasilkan badge dan sertifikat bernomor yang bisa dicetak."],
  ];
  return (
    <section id="fitur" className="scroll-mt-20 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHead eyebrow="Untuk perusahaan" title="Kenapa Nomina Academy" sub="Dibuat untuk tim HR dan L&D yang perlu memastikan setiap karyawan berkembang dan tercatat." />
        <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
          {f.map(([Icon, t, d]) => (
            <div key={t} className="flex gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Icon className="size-6" /></div>
              <div><h3 className="text-lg font-bold text-slate-900">{t}</h3><p className="mt-1 text-[15px] leading-relaxed text-slate-600">{d}</p></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaBand({ cta }) {
  return (
    <section className="px-4 pb-20 sm:px-6 lg:px-8">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-hero px-6 py-12 text-white sm:px-12">
        <HeroPattern />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-xl">
            <h2 className="text-3xl font-extrabold tracking-tight">Mulai kumpulkan jam pelatihan Anda</h2>
            <p className="mt-2 text-lg text-white/80">Masuk dengan akun perusahaan untuk melihat jadwal, course wajib, dan progres target tahun ini.</p>
          </div>
          <Link to={cta.to} className="inline-flex items-center gap-2.5 rounded-xl bg-cta px-7 py-4 text-lg font-semibold text-white transition hover:brightness-110">
            <LogIn className="size-5" /> {cta.label}
          </Link>
        </div>
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ faq & footer
function Faq() {
  const q = [
    ["Bagaimana jam pelatihan dihitung?", "Jam dihitung penuh sesuai durasi resmi course saat course selesai: semua materi online selesai, hadir di kelas offline, atau dinyatakan selesai oleh Udemy/Coursera. Progres yang berhenti di tengah belum dihitung."],
    ["Apa bedanya course wajib dan rekomendasi?", "Course wajib ditugaskan counselor atau admin dengan tenggat dan dipantau sampai selesai. Rekomendasi adalah saran yang bisa diterima atau ditolak karyawan."],
    ["Apakah counselor juga punya target?", "Ya. Counselor wajib mengikuti pelatihan dengan target yang sama, minimal 40 jam per tahun."],
    ["Bisakah memakai Zoom, Teams, atau Google Meet perusahaan?", "Bisa. LMS membuat link kelas dari akun yang perusahaan sudah punya, dan peserta mendapat jadwal di dashboard serta file kalender."],
    ["Bagaimana dengan course di Udemy atau Coursera?", "Jika perusahaan berlangganan Udemy Business atau Coursera for Business, katalog dan progresnya masuk otomatis ke LMS."],
  ];
  return (
    <section id="faq" className="scroll-mt-20 bg-slate-50 py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionHead eyebrow="FAQ" title="Pertanyaan umum" />
        <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
          {q.map(([t, a]) => (
            <details key={t} className="group px-6 py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold text-slate-900">
                {t}<ChevronDown className="size-5 shrink-0 text-slate-400 transition group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-[15px] leading-relaxed text-slate-600">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-hero text-white/75">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
        <div>
          <div className="flex items-center gap-2.5">
            <LogoMark className="h-8" />
            <span className="text-xl font-extrabold text-white">Nomina Academy</span>
          </div>
          <p className="mt-3 max-w-sm text-sm">PT Nomina Akselerasi Indonesia. Akselerasi Talenta, Akselerasi Bisnis.</p>
          <p className="mt-3 text-sm">Networking · Ownership · Mastery · Integrity · Nimble · Accelerate</p>
        </div>
        <div className="text-sm">
          <p className="font-semibold text-white">Program</p>
          <ul className="mt-3 space-y-2"><li><a href="#program" className="hover:text-white">Course online & offline</a></li><li><a href="#populer" className="hover:text-white">Course populer</a></li><li><a href="#program" className="hover:text-white">Udemy & Coursera</a></li></ul>
        </div>
        <div className="text-sm">
          <p className="font-semibold text-white">LMS</p>
          <ul className="mt-3 space-y-2"><li><Link to="/login" className="hover:text-white">Masuk</Link></li><li><a href="#fitur" className="hover:text-white">Fitur</a></li><li><a href="#faq" className="hover:text-white">FAQ</a></li></ul>
        </div>
      </div>
      <p className="border-t border-white/10 py-5 text-center text-xs text-white/50">© {new Date().getFullYear()} PT Nomina Akselerasi Indonesia</p>
    </footer>
  );
}
