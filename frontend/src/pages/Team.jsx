import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Plus, Search, Users } from "lucide-react";
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { useMe } from "@/lib/session";
import { Avatar, Badge, Button, Card, Empty, Input, PACE, PageHeader, PaceBadge, Progress, Select, Spinner, StatCard, Tabs } from "@/components/ui";
import { AlertList, SectionCard } from "@/components/learning";
import { AssignDialog } from "@/components/dialogs";

export default function Team() {
  const { data: me } = useMe();
  const { data, isLoading } = useQuery({ queryKey: ["team"], queryFn: () => api.get("/team") });
  const [q, setQ] = useState("");
  const [pace, setPace] = useState("");
  const [role, setRole] = useState("");
  const [dept, setDept] = useState("");
  const [assign, setAssign] = useState(null);
  if (isLoading) return <Spinner />;
  const members = data.members;
  const depts = [...new Set(members.map((m) => m.user.department))].sort();
  const list = members.filter((m) => (!q || m.user.name.toLowerCase().includes(q.toLowerCase())) && (!pace || m.hours.pace === pace) &&
    (!role || m.user.role === role) && (!dept || m.user.department === dept));
  const count = (p) => members.filter((m) => m.hours.pace === p).length;
  const isAdmin = me.role === "admin";

  return (
    <>
      <PageHeader eyebrow={isAdmin ? "Monitoring" : "Counselor"} title={isAdmin ? "Monitoring Seluruh Peserta" : "Counselee Saya"}
        subtitle={isAdmin ? "Counselor & counselee — progres target 40 jam, overdue, dan aktivitas terakhir." : "Pantau progres, assign course wajib, atau sarankan course untuk pengembangan skill."}
        action={<Button onClick={() => setAssign([])}><Plus className="size-4" /> Assign course</Button>} />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Target tercapai" value={count("achieved")} tone="green" icon={Users} />
        <StatCard label="Sesuai jalur" value={count("on_track")} icon={Users} />
        <StatCard label="Tertinggal" value={count("behind")} tone="amber" icon={Users} />
        <StatCard label="Berisiko" value={count("at_risk")} tone="red" icon={AlertTriangle} />
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4">
            <Tabs value={pace} onChange={setPace} tabs={[{ value: "", label: "Semua", count: members.length }, ...Object.keys(PACE).map((k) => ({ value: k, label: PACE[k].label, count: count(k) }))]} />
            {isAdmin && (
              <>
                <Select value={role} onChange={(e) => setRole(e.target.value)} className="w-auto"><option value="">Semua role</option><option value="counselor">Counselor</option><option value="counselee">Counselee</option></Select>
                <Select value={dept} onChange={(e) => setDept(e.target.value)} className="w-auto"><option value="">Semua departemen</option>{depts.map((d) => <option key={d}>{d}</option>)}</Select>
              </>
            )}
            <div className="relative min-w-44 flex-1"><Search className="absolute left-3 top-2.5 size-4 text-slate-400" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama…" className="pl-9" /></div>
          </div>
          {list.length === 0 ? <Empty icon={Users} title="Tidak ada peserta" /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <tr><th className="px-5 py-2">Nama</th><th className="px-3 py-2">Jam {new Date().getFullYear()}</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Deadline</th><th className="px-3 py-2">Aktivitas</th><th className="px-5 py-2" /></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {list.map((m) => (
                    <tr key={m.user.id} className="hover:bg-slate-50/60">
                      <td className="px-5 py-3">
                        <Link to={`/tim/${m.user.id}`} className="flex items-center gap-3">
                          <Avatar name={m.user.name} size="sm" />
                          <span><span className="block font-semibold text-slate-900 hover:text-brand-600">{m.user.name}</span>
                            <span className="text-[11px] text-slate-500">{m.user.job_title}{isAdmin && ` · ${m.user.role === "counselor" ? "Counselor" : `Counselor: ${m.user.counselor_name || "-"}`}`}</span></span>
                        </Link>
                      </td>
                      <td className="w-48 px-3 py-3">
                        <div className="flex justify-between text-xs"><b>{m.hours.earned}</b><span className="text-slate-400">/ {m.hours.target} jam</span></div>
                        <Progress value={m.hours.percent} tone={PACE[m.hours.pace].bar} className="mt-1" />
                      </td>
                      <td className="px-3 py-3"><PaceBadge pace={m.hours.pace} /></td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          {m.overdue > 0 && <Badge tone="red">{m.overdue} overdue</Badge>}
                          {m.due_soon > 0 && <Badge tone="amber">{m.due_soon} ≤ 90 hari</Badge>}
                          {m.overdue + m.due_soon === 0 && <span className="text-xs text-slate-400">—</span>}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-500">{m.last_activity ? timeAgo(m.last_activity) : "—"}</td>
                      <td className="px-5 py-3 text-right"><Button size="sm" variant="outline" onClick={() => setAssign([m.user.id])}>Assign</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <SectionCard title="Perlu Tindak Lanjut" subtitle="Overdue & tenggat ≤ 90 hari" icon={AlertTriangle}>
          <AlertList alerts={data.alerts} max={20} />
        </SectionCard>
      </div>
      <AssignDialog open={assign !== null} onClose={() => setAssign(null)} presetUserIds={assign || []} />
    </>
  );
}
