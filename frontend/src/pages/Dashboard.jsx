import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, Award, BookOpen, CalendarClock, CalendarDays, CheckCircle2, Clock, GraduationCap, Lightbulb,
  Plus, Sparkles, TrendingUp, Users,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import { fmtDateTime, fmtHours } from "@/lib/format";
import {
  Avatar, Badge, Button, Empty, ModeBadge, PACE, PageHeader, PaceBadge, PlatformBadge, Progress, Spinner, StatCard,
} from "@/components/ui";
import { AlertList, BadgeChip, EnrollmentCard, HoursCard, MonthCalendar, MonthlyChart, ScheduleList, SectionCard } from "@/components/learning";
import { AssignDialog, RoomFormDialog } from "@/components/dialogs";

export default function Dashboard() {
  const { data, isLoading, error } = useQuery({ queryKey: ["dashboard"], queryFn: () => api.get("/dashboard") });
  if (isLoading) return <Spinner />;
  if (error) return <p className="text-red-600">{error.message}</p>;
  if (data.admin) return <AdminDashboard data={data} />;
  return <LearnerDashboard data={data} />;
}

function Greeting({ user }) {
  const h = new Date().getHours();
  const sapa = h < 11 ? "Selamat pagi" : h < 15 ? "Selamat siang" : h < 18 ? "Selamat sore" : "Selamat malam";
  return `${sapa}, ${user.name.split(" ")[0]}`;
}

// ------------------------------------------------------------------ counselee & counselor
function LearnerDashboard({ data }) {
  const L = data.learner;
  const isCounselor = data.user.role === "counselor";
  const [assignOpen, setAssignOpen] = useState(false);
  const [roomOpen, setRoomOpen] = useState(false);
  return (
    <>
      <PageHeader
        eyebrow={isCounselor ? "Dashboard Counselor" : "Dashboard Member"}
        title={<Greeting user={data.user} />}
        subtitle={`${data.user.job_title} · ${data.user.department}${data.user.counselor_name ? ` · Counselor: ${data.user.counselor_name}` : ""}`}
        action={
          isCounselor ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setRoomOpen(true)}><CalendarDays className="size-4" /> Buat kelas</Button>
              <Button onClick={() => setAssignOpen(true)}><Plus className="size-4" /> Assign course</Button>
            </div>
          ) : (
            <Link to="/katalog"><Button variant="outline"><BookOpen className="size-4" /> Jelajahi katalog</Button></Link>
          )
        }
      />

      {L.counts.overdue > 0 && (
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="size-5 shrink-0" />
          <span><b>{L.counts.overdue} course melewati tenggat.</b> Selesaikan segera agar target {L.hours.target} jam tahun ini tetap tercapai.</span>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2"><HoursCard hours={L.hours} title={isCounselor ? "Target Jam Saya" : "Target Jam Pelatihan"} /></div>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Overdue" value={L.counts.overdue} icon={AlertTriangle} tone="red" hint="lewat tenggat" />
          <StatCard label="≤ 90 hari" value={L.counts.due_soon} icon={CalendarClock} tone="amber" hint="mendekati tenggat" />
          <StatCard label="Berjalan" value={L.counts.in_progress + L.counts.not_started} icon={GraduationCap} hint={`${L.counts.in_progress} sedang dikerjakan`} />
          <StatCard label="Sertifikat" value={L.counts.certificates} icon={Award} tone="green" hint={`${L.counts.completed_year} course selesai ${L.hours.year}`} />
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <SectionCard
          className="lg:col-span-2"
          title="Jadwal Course & Kelas"
          subtitle={`Overdue dan tenggat dalam ${data.warning_window_days} hari ke depan, online maupun offline`}
          icon={CalendarClock}
          action={<Link to="/kelas" className="text-xs font-semibold text-brand-600">Semua kelas →</Link>}
        >
          <ScheduleList items={L.schedule} windowDays={data.warning_window_days} />
        </SectionCard>
        <SectionCard title="Kalender" icon={CalendarDays}>
          <div className="p-4"><MonthCalendar events={L.calendar} today={data.today} /></div>
        </SectionCard>
      </div>

      {isCounselor && <TeamSection team={data.team} onAssign={() => setAssignOpen(true)} />}

      {L.suggestions.length > 0 && <Suggestions items={L.suggestions} />}

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title="Pelatihan Aktif" subtitle="Diurutkan berdasarkan tenggat terdekat" icon={GraduationCap}
          action={<Link to="/pelatihan" className="text-xs font-semibold text-brand-600">Lihat semua →</Link>}>
          {L.active.length === 0 ? <Empty icon={GraduationCap} title="Belum ada course aktif" /> : (
            <div className="grid gap-3 p-4 sm:grid-cols-2">{L.active.slice(0, 4).map((e) => <EnrollmentCard key={e.id} e={e} />)}</div>
          )}
        </SectionCard>
        <div className="space-y-5">
          <SectionCard title={`Jam per Bulan ${L.hours.year}`} icon={TrendingUp}>
            <div className="p-3"><MonthlyChart monthly={L.hours.monthly} height={170} /></div>
          </SectionCard>
          <SectionCard title="Badge Terbaru" icon={Award} action={<Link to="/sertifikat" className="text-xs font-semibold text-brand-600">Semua →</Link>}>
            <div className="grid grid-cols-3 gap-2 p-4">
              {L.recent_badges.map((b, i) => <BadgeChip key={i} b={b} />)}
            </div>
          </SectionCard>
        </div>
      </div>

      <AssignDialog open={assignOpen} onClose={() => setAssignOpen(false)} />
      <RoomFormDialog open={roomOpen} onClose={() => setRoomOpen(false)} />
    </>
  );
}

function Suggestions({ items }) {
  const qc = useQueryClient();
  const act = useMutation({
    mutationFn: ({ id, action }) => api.post(`/enrollments/${id}/${action}`),
    onSuccess: () => qc.invalidateQueries(),
  });
  return (
    <SectionCard className="mt-5" title="Rekomendasi dari Counselor" subtitle="Terima untuk menambah ke pelatihan aktif dan target jam Anda" icon={Lightbulb}>
      <div className="grid gap-3 p-4 md:grid-cols-2">
        {items.map((e) => (
          <EnrollmentCard
            key={e.id}
            e={e}
            actions={
              <>
                <Button size="sm" onClick={() => act.mutate({ id: e.id, action: "accept" })} loading={act.isPending && act.variables?.id === e.id}>
                  <CheckCircle2 className="size-3.5" /> Terima
                </Button>
                <Button size="sm" variant="ghost" onClick={() => act.mutate({ id: e.id, action: "decline" })}>Tolak</Button>
              </>
            }
          />
        ))}
      </div>
    </SectionCard>
  );
}

function TeamSection({ team, onAssign }) {
  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-5">
      <SectionCard className="lg:col-span-3" title="Progres Counselee Saya" subtitle="Target 40 jam per orang per tahun" icon={Users}
        action={<Link to="/tim" className="text-xs font-semibold text-brand-600">Detail tim →</Link>}>
        <div className="divide-y divide-slate-100">
          {team.members.map((m) => (
            <Link key={m.user.id} to={`/tim/${m.user.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
              <Avatar name={m.user.name} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold text-slate-900">{m.user.name}</p>
                  <PaceBadge pace={m.hours.pace} />
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <Progress value={m.hours.percent} tone={PACE[m.hours.pace].bar} className="max-w-56" />
                  <span className="text-xs text-slate-500">{m.hours.earned}/{m.hours.target} jam</span>
                </div>
              </div>
              <div className="hidden gap-1 sm:flex">
                {m.overdue > 0 && <Badge tone="red">{m.overdue} overdue</Badge>}
                {m.due_soon > 0 && <Badge tone="amber">{m.due_soon} ≤90 hr</Badge>}
              </div>
            </Link>
          ))}
        </div>
      </SectionCard>
      <SectionCard className="lg:col-span-2" title="Perlu Perhatian" subtitle="Overdue & mendekati tenggat di tim" icon={AlertTriangle}
        action={<Button size="sm" variant="outline" onClick={onAssign}><Plus className="size-3.5" /> Assign</Button>}>
        <AlertList alerts={team.alerts} />
      </SectionCard>
    </div>
  );
}

// ------------------------------------------------------------------ admin
const PACE_COLORS = { achieved: "#10b981", on_track: "#0a84ff", behind: "#f59e0b", at_risk: "#ef4444" };

function AdminDashboard({ data }) {
  const A = data.admin;
  const [roomOpen, setRoomOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const paceData = Object.entries(A.pace).map(([k, v]) => ({ name: PACE[k].label, key: k, value: v }));
  return (
    <>
      <PageHeader
        eyebrow="Dashboard Admin L&D"
        title={<Greeting user={data.user} />}
        subtitle="Ringkasan pengembangan talenta Nomina Academy tahun berjalan"
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setAssignOpen(true)}><Plus className="size-4" /> Assign course</Button>
            <Button variant="outline" onClick={() => setRoomOpen(true)}><CalendarDays className="size-4" /> Buat kelas</Button>
            <Link to="/admin/course/baru"><Button><BookOpen className="size-4" /> Upload course</Button></Link>
          </div>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Peserta aktif" value={A.totals.learners} hint={`${A.totals.counselors} counselor`} icon={Users} />
        <StatCard label="Total jam tahun ini" value={A.totals.hours_ytd.toLocaleString("id-ID")} hint={`rata-rata ${fmtHours(A.totals.avg_hours)}/orang`} icon={Clock} tone="violet" />
        <StatCard label="Sertifikat terbit" value={A.totals.certificates_ytd} hint={`${A.totals.courses} course aktif`} icon={Award} tone="green" />
        <StatCard label="Overdue / ≤90 hari" value={`${A.totals.overdue} / ${A.totals.due_soon}`} hint={`${A.totals.upcoming_rooms} kelas terjadwal`} icon={AlertTriangle} tone="red" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title="Jam Pelatihan per Bulan" subtitle="Akumulasi seluruh peserta" icon={TrendingUp}>
          <div className="p-4"><MonthlyChart monthly={A.monthly} height={240} /></div>
        </SectionCard>
        <SectionCard title="Status Target 40 Jam" subtitle="Dibandingkan jalur ideal hari ini" icon={Sparkles}>
          <div className="flex items-center gap-2 p-4">
            <div className="h-44 w-40 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={paceData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} isAnimationActive={false}>
                    {paceData.map((d) => <Cell key={d.key} fill={PACE_COLORS[d.key]} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 text-sm">
              {paceData.map((d) => (
                <div key={d.key} className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: PACE_COLORS[d.key] }} />
                  <span className="text-slate-600">{d.name}</span>
                  <b>{d.value}</b>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <SectionCard title="Rata-rata Jam per Departemen" icon={Users}>
          <div className="p-3">
            <ResponsiveContainer width="100%" height={Math.max(180, A.departments.length * 34)}>
              <BarChart data={A.departments} layout="vertical" margin={{ left: 10, right: 16 }}>
                <CartesianGrid horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="department" width={120} fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v) => [fmtHours(v), "Rata-rata"]} />
                <Bar dataKey="avg" fill="#0a84ff" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
        <SectionCard title="Perlu Tindak Lanjut" subtitle="Overdue & ≤ 90 hari — seluruh organisasi" icon={AlertTriangle}
          action={<Link to="/tim" className="text-xs font-semibold text-brand-600">Monitoring →</Link>}>
          <AlertList alerts={A.alerts} />
        </SectionCard>
        <div className="space-y-5">
          <SectionCard title="Kelas Mendatang" icon={CalendarDays} action={<Link to="/kelas" className="text-xs font-semibold text-brand-600">Semua →</Link>}>
            <div className="divide-y divide-slate-100">
              {A.upcoming_rooms.map((r) => (
                <Link key={r.id} to={`/kelas/${r.id}`} className="block px-5 py-2.5 hover:bg-slate-50">
                  <div className="flex items-center gap-2"><PlatformBadge platform={r.platform} />{r.state === "live" && <Badge tone="red">● Live</Badge>}</div>
                  <p className="mt-1 truncate text-sm font-semibold">{r.title}</p>
                  <p className="text-xs text-slate-500">{fmtDateTime(r.start_at)} · {r.participant_count} peserta</p>
                </Link>
              ))}
            </div>
          </SectionCard>
          <SectionCard title={`Course Terpopuler ${data.today.slice(0, 4)}`} icon={BookOpen}>
            <div className="space-y-2 p-4">
              {A.top_courses.map((t) => (
                <div key={t.course.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2"><ModeBadge mode={t.course.delivery_mode} /><span className="truncate">{t.course.title}</span></span>
                  <b className="shrink-0">{t.completions}×</b>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
      <AssignDialog open={assignOpen} onClose={() => setAssignOpen(false)} />
      <RoomFormDialog open={roomOpen} onClose={() => setRoomOpen(false)} />
    </>
  );
}

