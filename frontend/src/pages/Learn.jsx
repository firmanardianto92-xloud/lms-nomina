import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Award, CalendarDays, CheckCircle2, Circle, ExternalLink, FileText, Link2, MapPin, PlayCircle, Presentation, Video,
} from "lucide-react";
import { api } from "@/lib/api";
import { fmtDate, fmtDateTime, fmtHours, fmtTime } from "@/lib/format";
import { useMe } from "@/lib/session";
import {
  Badge, Button, Card, DeadlineBadge, Empty, ErrorBox, ModeBadge, PlatformBadge, Progress, SOURCE, Spinner, StatusBadge, cx,
} from "@/components/ui";
import { SectionCard } from "@/components/learning";

const KIND_ICON = { article: FileText, video: PlayCircle, pdf: FileText, slide: Presentation, link: Link2, file: FileText };

export default function Learn() {
  const { id } = useParams();
  const { data: me } = useMe();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: e, isLoading, error } = useQuery({ queryKey: ["enrollment", id], queryFn: () => api.get(`/enrollments/${id}`) });
  const [openId, setOpenId] = useState(null);
  const toggle = useMutation({
    mutationFn: ({ mid, done }) => api.post(`/enrollments/${id}/materials/${mid}`, { done }),
    onSuccess: () => qc.invalidateQueries(),
  });
  const register = useMutation({ mutationFn: (rid) => api.post(`/rooms/${rid}/register`), onSuccess: () => qc.invalidateQueries() });
  const accept = useMutation({ mutationFn: () => api.post(`/enrollments/${id}/accept`), onSuccess: () => qc.invalidateQueries() });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;

  const owner = e.user.id === me.id;
  const active = ["not_started", "in_progress"].includes(e.status);
  const done = new Set(e.completed_material_ids);
  const req = e.course.requirements;
  const current = e.course.materials.find((m) => m.id === openId) || e.course.materials.find((m) => !done.has(m.id)) || e.course.materials[0];

  return (
    <>
      <button onClick={() => nav(-1)} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 cursor-pointer"><ArrowLeft className="size-4" /> Kembali</button>
      <Card className="mb-5 overflow-hidden">
        <div className="h-2" style={{ background: e.course.cover_color }} />
        <div className="flex flex-wrap items-start justify-between gap-4 p-6">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <ModeBadge mode={e.course.delivery_mode} /> <StatusBadge status={e.status} /> <DeadlineBadge deadline={e.deadline} />
              {e.course.is_mandatory && <Badge tone="dark">Wajib</Badge>}
              <span className="text-xs text-slate-400">{e.course.code}</span>
            </div>
            <h1 className="mt-2 text-2xl font-extrabold text-slate-900">{e.course.title}</h1>
            <p className="mt-1 text-sm text-slate-600">{e.course.description || e.course.summary}</p>
            <p className="mt-2 text-xs text-slate-500">
              {!owner && <b className="text-slate-700">Peserta: {e.user.name} · </b>}
              {fmtHours(e.course.duration_hours)} · {e.course.level} · Instruktur {e.course.instructor} · {SOURCE[e.source]}{e.assigned_by && ` oleh ${e.assigned_by.name}`}
              {e.due_date && ` · Tenggat ${fmtDate(e.due_date)}`}
            </p>
            {e.note && <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">💬 {e.note}</p>}
          </div>
          <div className="w-full max-w-xs rounded-xl bg-slate-50 p-4">
            <div className="flex items-end justify-between">
              <span className="text-xs font-semibold text-slate-500">Progres</span>
              <span className="text-2xl font-extrabold">{e.progress}%</span>
            </div>
            <Progress value={e.progress} className="mt-2" tone={e.status === "completed" ? "green" : "brand"} />
            <ul className="mt-3 space-y-1 text-xs text-slate-600">
              {req.materials && <li className="flex items-center gap-1.5">{done.size === e.course.materials.length ? <CheckCircle2 className="size-3.5 text-emerald-500" /> : <Circle className="size-3.5" />} Selesaikan {e.course.materials.length} materi online ({done.size}/{e.course.materials.length})</li>}
              {req.attendance && <li className="flex items-center gap-1.5">{e.attended ? <CheckCircle2 className="size-3.5 text-emerald-500" /> : <Circle className="size-3.5" />} Hadir di kelas {e.course.delivery_mode === "blended" ? "live/offline" : "offline"} (absensi oleh fasilitator)</li>}
            </ul>
            {e.status === "completed" && (
              <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">
                <p className="font-bold">Selesai {fmtDate(e.completed_at)} · +{fmtHours(e.hours_earned)}</p>
                {e.certificate_no && <Link to={`/sertifikat/${e.id}/cetak`} className="mt-1 inline-flex items-center gap-1 font-semibold underline"><Award className="size-3.5" /> Sertifikat {e.certificate_no}</Link>}
              </div>
            )}
            {e.status === "suggested" && owner && <Button className="mt-3 w-full" onClick={() => accept.mutate()} loading={accept.isPending}>Terima rekomendasi</Button>}
          </div>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <SectionCard className="lg:col-span-2" title={req.materials ? "Materi Course" : "Materi Pendukung"} subtitle={req.materials ? "Tandai selesai setiap materi — course otomatis selesai saat semua syarat terpenuhi" : "Bacaan sebelum kelas (tidak memengaruhi kelulusan)"} icon={FileText}>
          {e.course.materials.length === 0 ? <Empty title="Tidak ada materi online" /> : (
            <div className="grid md:grid-cols-[240px_1fr]">
              <ol className="border-b border-slate-100 p-2 md:border-b-0 md:border-r">
                {e.course.materials.map((m, i) => {
                  const Icon = KIND_ICON[m.kind] || FileText;
                  return (
                    <li key={m.id}>
                      <button onClick={() => setOpenId(m.id)} className={cx("flex w-full items-start gap-2 rounded-lg p-2 text-left text-sm cursor-pointer", current?.id === m.id ? "bg-brand-50" : "hover:bg-slate-50")}>
                        {done.has(m.id) ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" /> : <Icon className="mt-0.5 size-4 shrink-0 text-slate-400" />}
                        <span className="min-w-0">
                          <span className="block font-medium leading-snug">{i + 1}. {m.title}</span>
                          <span className="text-[11px] text-slate-400">{m.kind} · {m.duration_minutes} menit</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
              {current && (
                <div className="p-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{current.kind}</p>
                  <h3 className="mt-1 text-lg font-bold">{current.title}</h3>
                  {current.content && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-700">{current.content}</p>}
                  {current.kind === "video" && current.url && /\.(mp4|webm)$/i.test(current.url) && <video src={current.url} controls className="mt-3 w-full rounded-lg" />}
                  {current.url && (
                    <a href={current.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-brand-600 hover:bg-brand-50">
                      <ExternalLink className="size-4" /> Buka materi
                    </a>
                  )}
                  {owner && active && req.materials && (
                    <div className="mt-6 border-t border-slate-100 pt-4">
                      <Button variant={done.has(current.id) ? "outline" : "success"} loading={toggle.isPending}
                        onClick={() => toggle.mutate({ mid: current.id, done: !done.has(current.id) })}>
                        <CheckCircle2 className="size-4" /> {done.has(current.id) ? "Batalkan tanda selesai" : "Tandai selesai"}
                      </Button>
                      <ErrorBox error={toggle.error} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Kelas / Sesi" subtitle={req.attendance ? "Wajib hadir untuk menyelesaikan course" : "Sesi live pendamping (opsional)"} icon={CalendarDays}>
          <div className="divide-y divide-slate-100">
            {e.rooms.length === 0 && e.past_rooms.length === 0 && <Empty icon={CalendarDays} title="Belum ada jadwal kelas">Counselor/admin akan membuka kelas untuk course ini.</Empty>}
            {e.rooms.map((r) => (
              <div key={r.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2"><PlatformBadge platform={r.platform} />{r.state === "live" && <Badge tone="red">● Live</Badge>}</div>
                <Link to={`/kelas/${r.id}`} className="mt-1 block font-semibold hover:text-brand-600">{r.title}</Link>
                <p className="text-xs text-slate-500">{fmtDateTime(r.start_at)} – {fmtTime(r.end_at)}</p>
                {r.mode === "offline" && <p className="mt-0.5 flex gap-1 text-xs text-slate-500"><MapPin className="size-3 shrink-0" /> {r.location}</p>}
                <div className="mt-2 flex gap-2">
                  {r.my_status ? (
                    <>
                      <Badge tone="green">Terdaftar</Badge>
                      {r.mode === "online" && r.meeting_url && <a href={r.meeting_url} target="_blank" rel="noreferrer"><Button size="sm"><Video className="size-3.5" /> Gabung</Button></a>}
                    </>
                  ) : owner && active ? (
                    <Button size="sm" variant="outline" onClick={() => register.mutate(r.id)} loading={register.isPending}>Daftar kelas</Button>
                  ) : null}
                </div>
              </div>
            ))}
            {e.past_rooms.map((r) => (
              <div key={r.id} className="p-4 opacity-80">
                <p className="text-xs font-semibold text-slate-400">Riwayat</p>
                <p className="font-semibold">{r.title}</p>
                <p className="text-xs text-slate-500">{fmtDateTime(r.start_at)}</p>
                <Badge tone={r.my_status === "attended" ? "green" : r.my_status === "absent" ? "red" : "slate"}>
                  {r.my_status === "attended" ? "Hadir" : r.my_status === "absent" ? "Tidak hadir" : "Terdaftar"}
                </Badge>
              </div>
            ))}
          </div>
          <ErrorBox error={register.error} />
        </SectionCard>
      </div>
    </>
  );
}
