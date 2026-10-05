import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Award, BadgeCheck, BookOpenCheck, CalendarCheck, CalendarX, CheckCircle2, CirclePlay, History, Lightbulb, ListChecks,
  Send, TrendingUp, UserPlus, XCircle,
} from "lucide-react";
import { fmtDate, fmtDateTime, fmtHours } from "@/lib/format";
import { DeadlineBadge, Empty, ModeBadge, ProviderBadge, SOURCE, StatusBadge, Tabs } from "./ui";
import { BadgeChip, HoursCard, MonthlyChart, SectionCard, YearHistory } from "./learning";

const ACT_ICON = {
  completed: [CheckCircle2, "text-emerald-600 bg-emerald-50"],
  external_progress: [TrendingUp, "text-violet-600 bg-violet-50"],
  badge: [Award, "text-amber-600 bg-amber-50"],
  attended: [CalendarCheck, "text-brand-600 bg-brand-50"],
  absent: [CalendarX, "text-red-600 bg-red-50"],
  started: [CirclePlay, "text-brand-600 bg-brand-50"],
  assigned: [Send, "text-slate-600 bg-slate-100"],
  suggested: [Lightbulb, "text-violet-600 bg-violet-50"],
  enrolled: [UserPlus, "text-slate-600 bg-slate-100"],
  accepted: [BadgeCheck, "text-violet-600 bg-violet-50"],
  declined: [XCircle, "text-slate-500 bg-slate-100"],
  room_invited: [CalendarCheck, "text-slate-600 bg-slate-100"],
  room_registered: [CalendarCheck, "text-slate-600 bg-slate-100"],
  cancelled: [XCircle, "text-slate-500 bg-slate-100"],
};

export function Timeline({ items }) {
  if (!items.length) return <Empty icon={History} title="Belum ada aktivitas" />;
  return (
    <ol className="relative space-y-4 p-5 before:absolute before:bottom-5 before:left-[34px] before:top-5 before:w-px before:bg-slate-200">
      {items.map((a) => {
        const [Icon, cls] = ACT_ICON[a.kind] || [History, "text-slate-500 bg-slate-100"];
        return (
          <li key={a.id} className="relative flex gap-3">
            <div className={`relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full ring-4 ring-white ${cls}`}>
              <Icon className="size-3.5" />
            </div>
            <div className="min-w-0 pt-0.5">
              <p className="text-sm text-slate-800">{a.message}</p>
              <p className="text-[11px] text-slate-400">{fmtDateTime(a.created_at)}{a.actor_name ? ` · oleh ${a.actor_name}` : ""}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function EnrollmentTable({ rows, linkable = true }) {
  const [tab, setTab] = useState("all");
  const filtered = rows.filter((e) =>
    tab === "all" ? true
      : tab === "active" ? ["not_started", "in_progress"].includes(e.status)
      : tab === "overdue" ? e.deadline.state === "overdue"
      : e.status === tab,
  );
  const count = (t) => rows.filter((e) => (t === "active" ? ["not_started", "in_progress"].includes(e.status) : t === "overdue" ? e.deadline.state === "overdue" : e.status === t)).length;
  return (
    <div>
      <div className="px-5 pt-4">
        <Tabs value={tab} onChange={setTab} tabs={[
          { value: "all", label: "Semua", count: rows.length },
          { value: "active", label: "Aktif", count: count("active") },
          { value: "overdue", label: "Overdue", count: count("overdue") },
          { value: "completed", label: "Selesai", count: count("completed") },
          { value: "suggested", label: "Rekomendasi", count: count("suggested") },
        ]} />
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-2">Course</th>
              <th className="px-3 py-2">Mode</th>
              <th className="px-3 py-2">Sumber</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Tenggat</th>
              <th className="px-3 py-2">Selesai</th>
              <th className="px-3 py-2 text-right">Jam</th>
              <th className="px-5 py-2">Sertifikat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50/60">
                <td className="px-5 py-2.5">
                  {linkable ? <Link to={`/belajar/${e.id}`} className="font-semibold text-slate-900 hover:text-brand-600">{e.course.title}</Link>
                    : <span className="font-semibold text-slate-900">{e.course.title}</span>}
                  <p className="flex items-center gap-1.5 text-[11px] text-slate-500"><ProviderBadge provider={e.course.provider} hideInternal />{e.course.code} · {e.course.category}</p>
                </td>
                <td className="px-3 py-2.5"><ModeBadge mode={e.course.delivery_mode} /></td>
                <td className="px-3 py-2.5 text-xs text-slate-600">{SOURCE[e.source]}{e.assigned_by ? <span className="block text-slate-400">{e.assigned_by.name}</span> : null}</td>
                <td className="px-3 py-2.5"><StatusBadge status={e.status} />{e.status !== "completed" && e.status !== "suggested" && <span className="ml-1 text-[11px] text-slate-500">{e.progress}%</span>}
                  {e.external && e.status !== "completed" && e.external.progress > 0 && <span className="block text-[10px] text-slate-400">0 jam s/d selesai</span>}</td>
                <td className="px-3 py-2.5 text-xs">{e.due_date ? fmtDate(e.due_date) : "—"}<div><DeadlineBadge deadline={e.deadline} /></div></td>
                <td className="px-3 py-2.5 text-xs">{e.completed_at ? fmtDate(e.completed_at) : "—"}</td>
                <td className="px-3 py-2.5 text-right font-semibold">{e.status === "completed" ? fmtHours(e.hours_earned) : <span className="font-normal text-slate-400">{fmtHours(e.course.duration_hours)}</span>}</td>
                <td className="px-5 py-2.5 text-xs">
                  {e.certificate_no ? <Link to={`/sertifikat/${e.id}/cetak`} className="font-mono text-brand-600 hover:underline">{e.certificate_no}</Link>
                    : e.external?.certificate_url ? <a href={e.external.certificate_url} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">Sertifikat {e.course.provider === "udemy" ? "Udemy" : "Coursera"} ↗</a> : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <Empty icon={ListChecks} title="Tidak ada data" />}
      </div>
    </div>
  );
}

/** Track record lengkap seorang peserta (dipakai di halaman Track Record & detail counselee). */
export function ProfileView({ profile, linkable = true }) {
  const { hours, enrollments, badges, activities } = profile;
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2"><HoursCard hours={hours} /></div>
        <SectionCard title="Riwayat per Tahun" subtitle={`Target ${hours.target} jam / tahun`} icon={TrendingUp}>
          <div className="p-5"><YearHistory byYear={hours.by_year} target={hours.target} /></div>
        </SectionCard>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title={`Jam Pelatihan per Bulan ${hours.year}`} subtitle={`Online ${fmtHours(hours.by_mode.online || 0)} · Offline ${fmtHours(hours.by_mode.offline || 0)} · Blended ${fmtHours(hours.by_mode.blended || 0)}`} icon={TrendingUp}>
          <div className="p-4"><MonthlyChart monthly={hours.monthly} /></div>
        </SectionCard>
        <SectionCard title="Badge" subtitle={`${badges.length} badge diraih`} icon={Award}>
          <div className="grid max-h-64 grid-cols-3 gap-3 overflow-y-auto p-4">
            {badges.map((b, i) => <BadgeChip key={i} b={b} />)}
          </div>
        </SectionCard>
      </div>
      <SectionCard title="Track Record Pelatihan" subtitle="Semua course yang pernah diikuti, ditugaskan, dan direkomendasikan" icon={BookOpenCheck}>
        <EnrollmentTable rows={enrollments} linkable={linkable} />
      </SectionCard>
      <SectionCard title="Timeline Aktivitas" subtitle="60 aktivitas terakhir" icon={History}>
        <div className="max-h-[520px] overflow-y-auto"><Timeline items={activities} /></div>
      </SectionCard>
    </div>
  );
}
