import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarPlus, Check, Copy, MapPin, RefreshCw, Trash2, UserPlus, Users, Video, X } from "lucide-react";
import { api } from "@/lib/api";
import { fmtDateTime, fmtHours, fmtTime } from "@/lib/format";
import { useMe } from "@/lib/session";
import { Avatar, Badge, Button, Card, Empty, ErrorBox, Modal, ModeBadge, PLATFORM, PlatformBadge, Spinner, cx } from "@/components/ui";
import { SectionCard } from "@/components/learning";

export default function RoomDetail() {
  const { id } = useParams();
  const { data: me } = useMe();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const { data: r, isLoading, error } = useQuery({ queryKey: ["room", id], queryFn: () => api.get(`/rooms/${id}`) });
  const done = () => qc.invalidateQueries();
  const attend = useMutation({ mutationFn: (b) => api.post(`/rooms/${id}/attendance`, b), onSuccess: done });
  const register = useMutation({ mutationFn: () => api.post(`/rooms/${id}/register`), onSuccess: done });
  const leave = useMutation({ mutationFn: () => api.del(`/rooms/${id}/participants/${me.id}`), onSuccess: done });
  const relink = useMutation({ mutationFn: () => api.post(`/rooms/${id}/link`), onSuccess: done });
  const remove = useMutation({ mutationFn: () => api.del(`/rooms/${id}`), onSuccess: () => { done(); nav("/kelas"); } });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;
  const started = r.state !== "upcoming";
  const copy = () => { navigator.clipboard?.writeText(r.meeting_url); setCopied(true); setTimeout(() => setCopied(false), 1500); };

  return (
    <>
      <button onClick={() => nav(-1)} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 cursor-pointer"><ArrowLeft className="size-4" /> Kembali</button>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card className="overflow-hidden">
            <div className="p-6 text-white" style={{ background: `linear-gradient(135deg, ${PLATFORM[r.platform]?.color || "#0a84ff"}, #0b0f1a)` }}>
              <div className="flex flex-wrap gap-2"><PlatformBadge platform={r.platform} /><ModeBadge mode={r.course.delivery_mode} />{r.state === "live" && <Badge tone="red">● Sedang berlangsung</Badge>}{r.state === "finished" && <Badge>Selesai</Badge>}</div>
              <h1 className="mt-3 text-2xl font-extrabold">{r.title}</h1>
              <Link to={`/katalog/${r.course.id}`} className="text-sm text-white/80 underline-offset-2 hover:underline">{r.course.title} · {fmtHours(r.course.duration_hours)}</Link>
              <p className="mt-3 text-sm">{fmtDateTime(r.start_at)} – {fmtTime(r.end_at)} WIB ({r.duration_hours} jam)</p>
            </div>
            <div className="space-y-4 p-6">
              {r.mode === "online" ? (
                r.meeting_url ? (
                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="text-xs font-semibold text-slate-500">Link {PLATFORM[r.platform]?.label}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <code className="min-w-0 flex-1 truncate rounded bg-slate-50 px-2 py-1 text-xs">{r.meeting_url}</code>
                      <Button size="sm" variant="outline" onClick={copy}>{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} Salin</Button>
                      {r.state !== "finished" && <a href={r.meeting_url} target="_blank" rel="noreferrer"><Button size="sm" variant={r.state === "live" ? "danger" : "primary"}><Video className="size-3.5" /> Gabung</Button></a>}
                    </div>
                    {r.meeting_code && <p className="mt-2 text-xs text-slate-500">{r.meeting_code}</p>}
                    {r.link_source === "demo" && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">Link demo — kredensial {PLATFORM[r.platform]?.label} belum dikonfigurasi di server. Lihat README untuk mengaktifkan integrasi API.</p>}
                    {r.link_source === "api" && <p className="mt-2 text-xs text-emerald-700">✓ Dibuat otomatis melalui API {PLATFORM[r.platform]?.label}</p>}
                    {r.can_manage && ["zoom", "teams", "gmeet"].includes(r.platform) && r.state !== "finished" && (
                      <Button size="sm" variant="ghost" className="mt-2" onClick={() => relink.mutate()} loading={relink.isPending}><RefreshCw className="size-3.5" /> Buat ulang link</Button>
                    )}
                    <ErrorBox error={relink.error} />
                  </div>
                ) : <p className="text-sm text-slate-500">Link belum tersedia.</p>
              ) : (
                <p className="flex gap-2 rounded-xl border border-slate-200 p-4 text-sm"><MapPin className="size-4 shrink-0 text-orange-500" /> {r.location}</p>
              )}
              {r.notes && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">📝 {r.notes}</p>}
              <div className="flex flex-wrap gap-2">
                <a href={`/api/rooms/${r.id}/ics`}><Button variant="outline" size="sm"><CalendarPlus className="size-3.5" /> Tambah ke kalender (.ics)</Button></a>
                {me.role !== "admin" && !r.can_manage && !r.my_status && r.state !== "finished" && (
                  <Button size="sm" onClick={() => register.mutate()} loading={register.isPending}>Daftar kelas ini</Button>
                )}
                {r.my_status === "registered" && r.state === "upcoming" && (
                  <Button size="sm" variant="ghost" onClick={() => leave.mutate()}>Batal ikut</Button>
                )}
                {r.can_manage && r.state === "upcoming" && (
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => confirm("Hapus kelas ini?") && remove.mutate()}><Trash2 className="size-3.5" /> Hapus kelas</Button>
                )}
              </div>
              <ErrorBox error={register.error || remove.error} />
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="p-5 text-sm">
            <p className="text-xs font-semibold text-slate-500">Fasilitator</p>
            <div className="mt-2 flex items-center gap-3"><Avatar name={r.facilitator?.name} /><div><p className="font-semibold">{r.facilitator?.name}</p><p className="text-xs text-slate-500">{r.facilitator?.job_title}</p></div></div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Stat label="Peserta" value={`${r.participant_count}/${r.capacity}`} />
              <Stat label="Hadir" value={r.attendance.attended || 0} />
              <Stat label="Absen" value={r.attendance.absent || 0} />
            </div>
            {r.my_status && <p className="mt-3 text-center text-xs">Status Anda: <b>{{ registered: "Terdaftar", attended: "Hadir", absent: "Tidak hadir" }[r.my_status]}</b></p>}
          </Card>
        </div>
      </div>

      {r.participants && (
        <SectionCard className="mt-5" title="Peserta & Absensi" icon={Users}
          subtitle={r.can_manage ? (started ? "Tandai kehadiran — peserta yang hadir otomatis menyelesaikan syarat kelas & mendapat jam" : "Absensi dapat diisi setelah kelas dimulai") : "Counselee Anda di kelas ini"}
          action={r.can_manage && r.state !== "finished" && <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}><UserPlus className="size-3.5" /> Tambah peserta</Button>}>
          {r.participants.length === 0 ? <Empty icon={Users} title="Belum ada peserta" /> : (
            <div className="divide-y divide-slate-100">
              {r.participants.map((p) => (
                <div key={p.user.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <Avatar name={p.user.name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{p.user.name}</p>
                    <p className="text-xs text-slate-500">{p.user.job_title} · {p.user.department}</p>
                  </div>
                  {r.can_manage && started ? (
                    <div className="flex gap-1">
                      {[["attended", "Hadir", Check, "success"], ["absent", "Tidak hadir", X, "danger"]].map(([s, l, Icon, v]) => (
                        <Button key={s} size="sm" variant={p.status === s ? v : "outline"} className={cx(p.status !== s && "opacity-70")}
                          onClick={() => attend.mutate({ user_id: p.user.id, status: s })}>
                          <Icon className="size-3.5" /> {l}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <Badge tone={p.status === "attended" ? "green" : p.status === "absent" ? "red" : "slate"}>{{ registered: "Terdaftar", attended: "Hadir", absent: "Tidak hadir" }[p.status]}</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="px-5 pb-3"><ErrorBox error={attend.error} /></div>
        </SectionCard>
      )}
      <AddParticipants open={addOpen} onClose={() => setAddOpen(false)} room={r} />
    </>
  );
}

const Stat = ({ label, value }) => (
  <div className="rounded-lg bg-slate-50 p-2"><p className="text-lg font-extrabold">{value}</p><p className="text-[10px] text-slate-500">{label}</p></div>
);

function AddParticipants({ open, onClose, room }) {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const [ids, setIds] = useState([]);
  const people = useQuery({
    queryKey: ["assignable", me.role],
    queryFn: async () => (me.role === "admin" ? (await api.get("/users")).filter((u) => u.role !== "admin") : api.get("/users?role=counselee")),
    enabled: open,
  });
  const add = useMutation({
    mutationFn: () => api.post(`/rooms/${room.id}/participants`, { user_ids: ids }),
    onSuccess: () => { qc.invalidateQueries(); setIds([]); onClose(); },
  });
  const existing = new Set((room.participants || []).map((p) => p.user.id));
  const list = (people.data || []).filter((p) => !existing.has(p.id));
  return (
    <Modal open={open} onClose={onClose} title="Tambah peserta" subtitle="Peserta otomatis mendapat penugasan course bila belum terdaftar"
      footer={<><Button variant="outline" onClick={onClose}>Batal</Button><Button onClick={() => add.mutate()} disabled={!ids.length} loading={add.isPending}>Tambah {ids.length || ""}</Button></>}>
      <div className="max-h-80 space-y-1 overflow-y-auto">
        {list.map((p) => (
          <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50">
            <input type="checkbox" className="size-4 accent-brand-500" checked={ids.includes(p.id)} onChange={() => setIds((x) => (x.includes(p.id) ? x.filter((i) => i !== p.id) : [...x, p.id]))} />
            <Avatar name={p.name} size="sm" /><span className="text-sm">{p.name}</span><span className="text-xs text-slate-400">{p.department}</span>
          </label>
        ))}
        {list.length === 0 && <p className="text-sm text-slate-400">Semua orang sudah terdaftar.</p>}
      </div>
      <ErrorBox error={add.error} />
    </Modal>
  );
}
