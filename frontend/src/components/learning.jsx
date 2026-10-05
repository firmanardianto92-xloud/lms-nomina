import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, Award, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, Clock, MapPin, TrendingUp, Video } from "lucide-react";
import { BULAN_PANJANG, HARI, fmtDate, fmtHours, fmtTime, monthShort, parse, relDays, toInputDate } from "@/lib/format";
import { Avatar, Badge, Card, CardHeader, DeadlineBadge, ProviderBadge, Empty, ModeBadge, PACE, PaceBadge, PlatformBadge, Progress, SOURCE, StatusBadge, cx } from "./ui";

// ------------------------------------------------------------------ Jam & target tahunan
export function HoursRing({ earned, target, size = 148 }) {
  const pct = Math.min(1, target ? earned / target : 1);
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth="12" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="12" strokeLinecap="round"
          stroke={pct >= 1 ? "#10b981" : "#0a84ff"} strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          style={{ transition: "stroke-dashoffset .6s" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-extrabold text-slate-900">{Number(earned).toLocaleString("id-ID")}</span>
        <span className="text-xs font-semibold text-slate-500">dari {target} jam</span>
      </div>
    </div>
  );
}

export function HoursCard({ hours, title = "Target Jam Pelatihan" }) {
  const expectedPct = Math.min(100, (hours.expected_to_date / hours.target) * 100);
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{title} {hours.year}</p>
          <p className="mt-1 text-sm text-slate-600">Minimal <b>{hours.target} jam</b> online/offline per tahun</p>
        </div>
        <PaceBadge pace={hours.pace} />
      </div>
      <div className="flex flex-wrap items-center gap-6">
        <HoursRing earned={hours.earned} target={hours.target} />
        <div className="min-w-44 flex-1 space-y-3 text-sm">
          <Row label="Jam terkumpul (selesai)" value={fmtHours(hours.earned)} strong />
          <Row label="Sisa menuju target" value={hours.remaining > 0 ? fmtHours(hours.remaining) : "Tercapai 🎉"} />
          <Row label="Jam dari course aktif" value={fmtHours(hours.planned)} />
          <Row label="Course selesai tahun ini" value={hours.courses_completed} />
          <div>
            <div className="relative">
              <Progress value={hours.percent} tone={PACE[hours.pace]?.bar} />
              <div className="absolute -top-1 h-4 w-0.5 bg-slate-500" style={{ left: `${expectedPct}%` }} title="Seharusnya sampai hari ini" />
            </div>
            <p className="mt-1.5 text-[11px] text-slate-500">
              Jam dihitung penuh sesuai durasi resmi saat course selesai (badge terbit) atau kelas offline selesai; progres parsial tidak dihitung.
              Garis = jalur ideal hari ini ({fmtHours(hours.expected_to_date)}).
              {hours.planned > 0 && hours.remaining > 0 && hours.planned >= hours.remaining && " Course aktif cukup untuk menutup target."}
            </p>
          </div>
        </div>
      </div>
    </Card>
  );
}

const Row = ({ label, value, strong }) => (
  <div className="flex items-center justify-between gap-4">
    <span className="text-slate-500">{label}</span>
    <span className={cx("font-semibold", strong ? "text-brand-600" : "text-slate-800")}>{value}</span>
  </div>
);

export function MonthlyChart({ monthly, height = 200 }) {
  const data = monthly.map((h, i) => ({ bulan: monthShort(i), jam: h }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="bulan" tickLine={false} axisLine={false} fontSize={11} />
        <YAxis tickLine={false} axisLine={false} fontSize={11} allowDecimals={false} />
        <Tooltip cursor={{ fill: "#f1f5f9" }} formatter={(v) => [fmtHours(v), "Jam"]} />
        <Bar dataKey="jam" fill="#0a84ff" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function YearHistory({ byYear, target }) {
  if (!byYear.length) return <Empty title="Belum ada riwayat" />;
  return (
    <div className="space-y-3">
      {[...byYear].reverse().map((y) => (
        <div key={y.year}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-700">{y.year}</span>
            <span className="flex items-center gap-2">
              <span className="font-semibold">{fmtHours(y.hours)}</span>
              {y.achieved ? <Badge tone="green">Tercapai</Badge> : <Badge tone="slate">{Math.round((y.hours / target) * 100)}%</Badge>}
            </span>
          </div>
          <Progress value={(y.hours / target) * 100} tone={y.achieved ? "green" : "brand"} />
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ Jadwal & deadline
export function ScheduleList({ items, windowDays = 90 }) {
  if (!items.length)
    return <Empty icon={CalendarClock} title="Tidak ada jadwal mendesak">Tidak ada course overdue atau jatuh tempo dalam {windowDays} hari ke depan.</Empty>;
  const overdue = items.filter((i) => i.state === "overdue");
  const rest = items.filter((i) => i.state !== "overdue");
  return (
    <div className="divide-y divide-slate-100">
      {overdue.length > 0 && <GroupLabel tone="red">Overdue — segera selesaikan</GroupLabel>}
      {overdue.map((i) => <ScheduleItem key={i.enrollment.id} item={i} />)}
      {rest.length > 0 && <GroupLabel>Mendekati tenggat & sesi kelas ({windowDays} hari ke depan)</GroupLabel>}
      {rest.map((i) => <ScheduleItem key={(i.enrollment || i.room).id + i.type} item={i} />)}
    </div>
  );
}

const GroupLabel = ({ children, tone }) => (
  <p className={cx("bg-slate-50/70 px-5 py-1.5 text-[11px] font-bold uppercase tracking-wider", tone === "red" ? "text-red-600" : "text-slate-500")}>{children}</p>
);

function DateTile({ date, tone }) {
  const d = parse(date);
  const t = { red: "bg-red-50 text-red-700", orange: "bg-orange-50 text-orange-700", amber: "bg-amber-50 text-amber-700", blue: "bg-brand-50 text-brand-700" }[tone];
  return (
    <div className={cx("flex w-12 shrink-0 flex-col items-center rounded-lg py-1.5", t)}>
      <span className="text-lg font-extrabold leading-none">{d.getDate()}</span>
      <span className="text-[10px] font-bold uppercase">{monthShort(d.getMonth())}</span>
    </div>
  );
}

function ScheduleItem({ item }) {
  if (item.type === "session") {
    const r = item.room;
    return (
      <Link to={`/kelas/${r.id}`} className="flex items-center gap-4 px-5 py-3 transition hover:bg-slate-50">
        <DateTile date={r.start_at} tone="blue" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="blue" icon={Video}>Sesi kelas</Badge>
            <PlatformBadge platform={r.platform} />
            {r.state === "live" && <Badge tone="red">● Sedang berlangsung</Badge>}
          </div>
          <p className="mt-1 truncate font-semibold text-slate-900">{r.title}</p>
          <p className="flex items-center gap-1 text-xs text-slate-500">
            <Clock className="size-3" /> {fmtTime(r.start_at)}–{fmtTime(r.end_at)} WIB · {relDays(item.days_left)}
            {r.mode === "offline" && <><MapPin className="ml-1 size-3" /> <span className="truncate">{r.location.split("—")[0]}</span></>}
          </p>
        </div>
      </Link>
    );
  }
  const e = item.enrollment;
  const tone = item.state === "overdue" || item.urgency === "critical" ? "red" : item.urgency === "soon" ? "orange" : "amber";
  return (
    <Link to={`/belajar/${e.id}`} className="flex items-center gap-4 px-5 py-3 transition hover:bg-slate-50">
      <DateTile date={e.due_date} tone={tone} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <DeadlineBadge deadline={e.deadline} />
          <ModeBadge mode={e.course.delivery_mode} />
          {e.course.is_mandatory && <Badge tone="dark">Wajib</Badge>}
        </div>
        <p className="mt-1 truncate font-semibold text-slate-900">{e.course.title}</p>
        <div className="mt-1 flex items-center gap-2">
          <Progress value={e.progress} className="max-w-40" tone={item.state === "overdue" ? "red" : "brand"} />
          <span className="text-xs text-slate-500">{e.progress}% · {fmtHours(e.course.duration_hours)}</span>
        </div>
      </div>
      {item.state === "overdue" && <AlertTriangle className="size-5 shrink-0 text-red-500" />}
    </Link>
  );
}

// ------------------------------------------------------------------ Kalender bulanan
export function MonthCalendar({ events, today }) {
  const t = parse(today);
  const [cursor, setCursor] = useState(new Date(t.getFullYear(), t.getMonth(), 1));
  const [selected, setSelected] = useState(toInputDate(t));
  const byDate = useMemo(() => {
    const m = {};
    for (const e of events) (m[e.date] ||= []).push(e);
    return m;
  }, [events]);

  const first = new Date(cursor);
  const startPad = first.getDay();
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells = [...Array(startPad).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const key = (d) => toInputDate(new Date(cursor.getFullYear(), cursor.getMonth(), d));
  const todayKey = toInputDate(t);
  const dot = (e) =>
    e.kind === "session" ? "bg-brand-500" : e.state === "overdue" ? "bg-red-500" : e.state === "due_soon" ? "bg-amber-500" : "bg-slate-400";
  const sel = byDate[selected] || [];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button className="rounded-lg p-1.5 hover:bg-slate-100 cursor-pointer" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} aria-label="Bulan sebelumnya">
          <ChevronLeft className="size-4" />
        </button>
        <p className="text-sm font-bold">{BULAN_PANJANG[cursor.getMonth()]} {cursor.getFullYear()}</p>
        <button className="rounded-lg p-1.5 hover:bg-slate-100 cursor-pointer" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} aria-label="Bulan berikutnya">
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-slate-400">
        {HARI.map((h) => <div key={h}>{h}</div>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((d, i) =>
          d === null ? <div key={i} /> : (
            <button
              key={i}
              onClick={() => setSelected(key(d))}
              className={cx(
                "flex aspect-square flex-col items-center justify-center rounded-lg text-xs transition cursor-pointer",
                selected === key(d) ? "bg-ink text-white" : key(d) === todayKey ? "bg-brand-50 font-bold text-brand-700" : "hover:bg-slate-100",
              )}
            >
              {d}
              <span className="mt-0.5 flex h-1.5 gap-0.5">
                {(byDate[key(d)] || []).slice(0, 3).map((e, j) => <span key={j} className={cx("size-1.5 rounded-full", dot(e))} />)}
              </span>
            </button>
          ),
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-slate-500">
        <Legend c="bg-brand-500" l="Sesi kelas" /> <Legend c="bg-red-500" l="Overdue" /> <Legend c="bg-amber-500" l="≤ 90 hari" /> <Legend c="bg-slate-400" l="Tenggat > 90 hari" />
      </div>
      <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
        <p className="text-xs font-semibold text-slate-500">{fmtDate(selected)}</p>
        {sel.length === 0 && <p className="text-xs text-slate-400">Tidak ada agenda.</p>}
        {sel.map((e, i) => (
          <Link key={i} to={e.kind === "session" ? `/kelas/${e.ref_id}` : `/belajar/${e.ref_id}`} className="flex items-center gap-2 rounded-lg border border-slate-100 p-2 text-xs hover:bg-slate-50">
            <span className={cx("size-2 shrink-0 rounded-full", dot(e))} />
            <span className="min-w-0 flex-1 truncate font-medium">{e.title}</span>
            <span className="shrink-0 text-slate-400">{e.kind === "session" ? `${e.time} WIB` : "Tenggat"}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
const Legend = ({ c, l }) => <span className="flex items-center gap-1"><span className={cx("size-2 rounded-full", c)} />{l}</span>;

// ------------------------------------------------------------------ Kartu course aktif
export function EnrollmentCard({ e, actions }) {
  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="h-1.5" style={{ background: e.course.cover_color }} />
      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <ProviderBadge provider={e.course.provider} hideInternal />
          <ModeBadge mode={e.course.delivery_mode} />
          <StatusBadge status={e.status} />
          {e.course.is_mandatory && <Badge tone="dark">Wajib</Badge>}
          <DeadlineBadge deadline={e.deadline} />
        </div>
        <Link to={`/belajar/${e.id}`} className="mt-2 font-bold leading-snug text-slate-900 hover:text-brand-600">{e.course.title}</Link>
        <p className="mt-1 text-xs text-slate-500">
          {e.course.category} · {fmtHours(e.course.duration_hours)} · {SOURCE[e.source]}
          {e.assigned_by && ` oleh ${e.assigned_by.name}`}
        </p>
        {e.note && <p className="mt-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs italic text-slate-600">“{e.note}”</p>}
        <div className="mt-auto pt-3">
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-slate-500">{e.due_date ? `Tenggat ${fmtDate(e.due_date)}` : "Tanpa tenggat"}</span>
            <span className="font-semibold">{e.progress}%</span>
          </div>
          <Progress value={e.progress} tone={e.deadline?.state === "overdue" ? "red" : e.status === "completed" ? "green" : "brand"} />
          {actions && <div className="mt-3 flex gap-2">{actions}</div>}
        </div>
      </div>
    </Card>
  );
}

export function SectionCard({ title, subtitle, icon, action, children, className }) {
  return (
    <Card className={className}>
      <CardHeader title={title} subtitle={subtitle} icon={icon} action={action} />
      {children}
    </Card>
  );
}

export function BadgeChip({ b }) {
  return (
    <div className="flex flex-col items-center text-center" title={b.course_title}>
      <div className="relative flex size-14 items-center justify-center" style={{ color: b.color }}>
        <svg viewBox="0 0 60 60" className="absolute inset-0"><path d="M30 2 55 16v28L30 58 5 44V16Z" fill="currentColor" opacity=".14" stroke="currentColor" strokeWidth="2" /></svg>
        {b.kind === "target" ? <TrendingUp className="size-6" /> : <Award className="size-6" />}
      </div>
      <p className="mt-1 text-[11px] font-bold leading-tight text-slate-800">{b.name}</p>
    </div>
  );
}


export function AlertList({ alerts, max = 8 }) {
  if (!alerts.length) return <Empty icon={CheckCircle2} title="Semua aman">Tidak ada course overdue/mendekati tenggat.</Empty>;
  return (
    <div className="divide-y divide-slate-100">
      {alerts.slice(0, max).map((a) => (
        <Link key={a.id} to={`/tim/${a.user.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-slate-50">
          <Avatar name={a.user.name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{a.user.name}</p>
            <p className="truncate text-xs text-slate-500">{a.course.title}</p>
          </div>
          <div className="text-right">
            <DeadlineBadge deadline={a.deadline} />
            <p className="mt-0.5 text-[10px] text-slate-400">{fmtDate(a.due_date)}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}

