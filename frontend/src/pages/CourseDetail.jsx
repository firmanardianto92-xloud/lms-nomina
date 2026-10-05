import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Award, CalendarDays, CheckCircle2, Clock, ExternalLink, FileText, GraduationCap, Info, Pencil, Plus, UserRound } from "lucide-react";
import { api } from "@/lib/api";
import { fmtDateTime, fmtHours } from "@/lib/format";
import { useMe } from "@/lib/session";
import { Badge, Button, Card, ErrorBox, Field, Input, ModeBadge, PROVIDER, PlatformBadge, ProviderBadge, Spinner } from "@/components/ui";
import { SectionCard } from "@/components/learning";
import { AssignDialog, RoomFormDialog } from "@/components/dialogs";

export default function CourseDetail() {
  const { id } = useParams();
  const { data: me } = useMe();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [due, setDue] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [roomOpen, setRoomOpen] = useState(false);
  const { data: c, isLoading } = useQuery({ queryKey: ["course", id], queryFn: () => api.get(`/courses/${id}`) });
  const mine = useQuery({ queryKey: ["enrollments"], queryFn: () => api.get("/enrollments"), enabled: me.role !== "admin" });
  const rooms = useQuery({ queryKey: ["rooms", "upcoming", "all"], queryFn: () => api.get("/rooms?when=upcoming&scope=all") });
  const enroll = useMutation({
    mutationFn: () => api.post("/enrollments", { course_id: id, due_date: due || null }),
    onSuccess: (e) => { qc.invalidateQueries(); nav(`/belajar/${e.id}`); },
  });
  if (isLoading) return <Spinner />;
  const existing = mine.data?.find((e) => e.course.id === id && ["not_started", "in_progress", "suggested"].includes(e.status));
  const history = mine.data?.filter((e) => e.course.id === id && e.status === "completed") || [];
  const courseRooms = (rooms.data || []).filter((r) => r.course.id === id);
  const req = c.requirements;

  return (
    <>
      <button onClick={() => nav(-1)} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 cursor-pointer"><ArrowLeft className="size-4" /> Katalog</button>
      <Card className="overflow-hidden">
        <div className="p-8 text-white" style={{ background: `linear-gradient(135deg, ${c.cover_color}, #0b0f1a)` }}>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">{c.category} · {c.code}</p>
          <h1 className="mt-2 max-w-3xl text-3xl font-extrabold">{c.title}</h1>
          <p className="mt-2 max-w-2xl text-white/80">{c.summary}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <ProviderBadge provider={c.provider} hideInternal /> <ModeBadge mode={c.delivery_mode} /> <Badge>{c.level}</Badge> <Badge><Clock className="size-3" /> {fmtHours(c.duration_hours)}</Badge>
            {c.is_mandatory && <Badge tone="red">Wajib tahunan</Badge>}
            {!c.is_published && <Badge tone="amber">Draft</Badge>}
          </div>
        </div>
        <div className="grid gap-6 p-6 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <div>
              <h2 className="font-bold">Tentang course</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{c.description}</p>
            </div>
            <div>
              <h2 className="font-bold">Skill yang dikembangkan</h2>
              <div className="mt-2 flex flex-wrap gap-2">{c.skills.map((s) => <Badge key={s} tone="blue">{s}</Badge>)}</div>
            </div>
            <div>
              <h2 className="font-bold">Syarat kelulusan</h2>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {req.materials && <li className="flex gap-2"><CheckCircle2 className="size-4 text-emerald-500" /> Menyelesaikan {c.material_count} materi online</li>}
                {req.external && <li className="flex gap-2"><CheckCircle2 className="size-4 text-emerald-500" /> Menyelesaikan course di {PROVIDER[c.provider].label} hingga platform menyatakan selesai</li>}
                {req.external && <li className="flex gap-2"><Info className="size-4 text-slate-400" /> Progres parsial / berhenti di tengah tidak menambah jam — {fmtHours(c.duration_hours)} dihitung penuh setelah selesai</li>}
                {req.attendance && <li className="flex gap-2"><CheckCircle2 className="size-4 text-emerald-500" /> Hadir di kelas {c.delivery_mode === "blended" ? "live / tatap muka" : "tatap muka"} (absensi fasilitator)</li>}
                <li className="flex gap-2"><Award className="size-4 text-amber-500" /> Mendapat badge “{c.badge_name}”{c.has_certificate && " + sertifikat Nomina Academy"} dan +{fmtHours(c.duration_hours)} ke target tahunan</li>
              </ul>
            </div>
            {c.materials.length > 0 && <div>
              <h2 className="font-bold">Silabus</h2>
              <ol className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
                {c.materials.map((m, i) => (
                  <li key={m.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <FileText className="size-4 text-slate-400" /> <span className="flex-1">{i + 1}. {m.title}</span>
                    <span className="text-xs text-slate-400">{m.kind} · {m.duration_minutes} mnt</span>
                  </li>
                ))}
              </ol>
            </div>}
          </div>
          <div className="space-y-4">
            <Card className="p-4">
              <p className="flex items-center gap-2 text-sm text-slate-600"><UserRound className="size-4" /> {c.provider === "internal" ? "Instruktur" : "Penyedia"}: <b>{c.instructor}</b></p>
              {c.provider !== "internal" && (
                <a href={c.external_url} target="_blank" rel="noreferrer" className="mt-3 block">
                  <Button variant="outline" className="w-full"><ExternalLink className="size-4" /> Lihat di {PROVIDER[c.provider].short}</Button>
                </a>
              )}
              {me.role === "admin" ? (
                <div className="mt-4 space-y-2">
                  <Link to={`/admin/course/${c.id}`}><Button variant="outline" className="w-full"><Pencil className="size-4" /> Edit course & materi</Button></Link>
                  <Button className="w-full" onClick={() => setAssignOpen(true)}><Plus className="size-4" /> Assign ke peserta</Button>
                  <Button variant="dark" className="w-full" onClick={() => setRoomOpen(true)}><CalendarDays className="size-4" /> Buat kelas</Button>
                </div>
              ) : existing ? (
                <Link to={`/belajar/${existing.id}`}><Button className="mt-4 w-full"><GraduationCap className="size-4" /> {existing.status === "suggested" ? "Lihat rekomendasi" : "Lanjutkan belajar"}</Button></Link>
              ) : (
                <div className="mt-4 space-y-2">
                  <Field label="Target selesai (opsional)"><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
                  <Button className="w-full" onClick={() => enroll.mutate()} loading={enroll.isPending}><Plus className="size-4" /> Ikuti course ini</Button>
                  <ErrorBox error={enroll.error} />
                </div>
              )}
              {me.role === "counselor" && (
                <div className="mt-2 space-y-2">
                  <Button variant="outline" className="w-full" onClick={() => setAssignOpen(true)}>Assign / sarankan ke counselee</Button>
                  <Button variant="dark" className="w-full" onClick={() => setRoomOpen(true)}><CalendarDays className="size-4" /> Buat kelas</Button>
                </div>
              )}
              {history.length > 0 && <p className="mt-3 text-xs text-emerald-700">✓ Anda pernah menyelesaikan course ini ({history.length}×)</p>}
            </Card>
            <SectionCard title="Kelas terjadwal" icon={CalendarDays}>
              <div className="divide-y divide-slate-100">
                {courseRooms.length === 0 && <p className="p-4 text-sm text-slate-400">Belum ada kelas terjadwal.</p>}
                {courseRooms.map((r) => (
                  <Link key={r.id} to={`/kelas/${r.id}`} className="block p-4 hover:bg-slate-50">
                    <PlatformBadge platform={r.platform} />
                    <p className="mt-1 text-sm font-semibold">{r.title}</p>
                    <p className="text-xs text-slate-500">{fmtDateTime(r.start_at)} · {r.participant_count}/{r.capacity}</p>
                  </Link>
                ))}
              </div>
            </SectionCard>
          </div>
        </div>
      </Card>
      <AssignDialog open={assignOpen} onClose={() => setAssignOpen(false)} presetCourseId={c.id} />
      <RoomFormDialog open={roomOpen} onClose={() => setRoomOpen(false)} presetCourseId={c.id} onCreated={(r) => nav(`/kelas/${r.id}`)} />
    </>
  );
}
