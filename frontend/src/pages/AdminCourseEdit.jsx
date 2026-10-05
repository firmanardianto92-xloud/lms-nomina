import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileText, Save, Trash2, Upload } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Card, ErrorBox, Field, Input, PageHeader, Select, Spinner, Textarea } from "@/components/ui";
import { SectionCard } from "@/components/learning";

const EMPTY = {
  code: "", title: "", summary: "", description: "", category: "Soft Skill", delivery_mode: "online", duration_hours: 4,
  level: "Dasar", instructor: "", skills: [], badge_name: "", has_certificate: true, is_mandatory: false, is_published: true,
  cover_color: "#0A84FF",
};
const KINDS = [["article", "Artikel / teks"], ["video", "Video"], ["pdf", "PDF"], ["slide", "Slide"], ["link", "Link eksternal"], ["file", "File lain"]];

export default function AdminCourseEdit() {
  const { id } = useParams();
  const isNew = id === "baru";
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["course", id], queryFn: () => api.get(`/courses/${id}`), enabled: !isNew });
  const [f, setF] = useState(EMPTY);
  const [skills, setSkills] = useState("");
  useEffect(() => {
    if (data) { setF(data); setSkills(data.skills.join(", ")); }
  }, [data]);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const save = useMutation({
    mutationFn: () => {
      const body = { ...f, duration_hours: Number(f.duration_hours), skills: skills.split(",").map((s) => s.trim()).filter(Boolean) };
      return isNew ? api.post("/courses", body) : api.put(`/courses/${id}`, body);
    },
    onSuccess: (c) => { qc.invalidateQueries(); if (isNew) nav(`/admin/course/${c.id}`, { replace: true }); },
  });
  const archive = useMutation({ mutationFn: () => api.del(`/courses/${id}`), onSuccess: () => { qc.invalidateQueries(); nav("/admin/course"); } });

  if (!isNew && isLoading) return <Spinner />;
  return (
    <>
      <button onClick={() => nav("/admin/course")} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 cursor-pointer"><ArrowLeft className="size-4" /> Kelola course</button>
      <PageHeader title={isNew ? "Course Baru" : f.title} subtitle={isNew ? "Simpan dulu informasi course, lalu tambahkan materi." : f.code}
        action={<div className="flex gap-2">
          {!isNew && <Button variant="ghost" className="text-red-600" onClick={() => confirm("Hapus/arsipkan course ini? Course yang punya riwayat peserta akan diarsipkan.") && archive.mutate()}><Trash2 className="size-4" /> Hapus</Button>}
          <Button onClick={() => save.mutate()} loading={save.isPending}><Save className="size-4" /> Simpan</Button>
        </div>} />
      <ErrorBox error={save.error} />
      {save.isSuccess && !isNew && <p className="mb-3 text-sm text-emerald-700">✓ Tersimpan</p>}
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="space-y-4 p-5 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Kode"><Input value={f.code} onChange={set("code")} placeholder="NMA-XXX-000" /></Field>
            <Field label="Judul" className="sm:col-span-2"><Input value={f.title} onChange={set("title")} /></Field>
          </div>
          <Field label="Ringkasan"><Input value={f.summary} onChange={set("summary")} /></Field>
          <Field label="Deskripsi"><Textarea value={f.description} onChange={set("description")} /></Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Mode" hint="Online: lulus via materi · Offline: via absensi · Blended: keduanya">
              <Select value={f.delivery_mode} onChange={set("delivery_mode")}><option value="online">Online</option><option value="offline">Offline</option><option value="blended">Blended</option></Select>
            </Field>
            <Field label="Durasi (jam)" hint="Dihitung ke target tahunan"><Input type="number" step="0.5" min="0.5" value={f.duration_hours} onChange={set("duration_hours")} /></Field>
            <Field label="Level"><Select value={f.level} onChange={set("level")}><option>Dasar</option><option>Menengah</option><option>Lanjutan</option></Select></Field>
            <Field label="Kategori"><Input value={f.category} onChange={set("category")} list="cats" /></Field>
            <Field label="Instruktur"><Input value={f.instructor} onChange={set("instructor")} /></Field>
            <Field label="Warna"><Input type="color" value={f.cover_color} onChange={set("cover_color")} className="h-10 p-1" /></Field>
          </div>
          <datalist id="cats">{["Leadership", "Soft Skill", "Customer Service", "Sales", "Digital & Data", "Compliance", "Event & Project", "Talent Management"].map((c) => <option key={c} value={c} />)}</datalist>
          <Field label="Skill (pisahkan dengan koma)"><Input value={skills} onChange={(e) => setSkills(e.target.value)} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nama badge"><Input value={f.badge_name} onChange={set("badge_name")} /></Field>
            <div className="flex flex-wrap items-end gap-4 pb-2 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-brand-500" checked={f.has_certificate} onChange={set("has_certificate")} /> Sertifikat</label>
              <label className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-brand-500" checked={f.is_mandatory} onChange={set("is_mandatory")} /> Wajib</label>
              <label className="flex items-center gap-2"><input type="checkbox" className="size-4 accent-brand-500" checked={f.is_published} onChange={set("is_published")} /> Publikasikan</label>
            </div>
          </div>
        </Card>
        {!isNew && data && <Materials course={data} />}
      </div>
    </>
  );
}

function Materials({ course }) {
  const qc = useQueryClient();
  const fileRef = useRef(null);
  const [m, setM] = useState({ title: "", kind: "pdf", url: "", content: "", duration_minutes: 20 });
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState(null);
  const add = useMutation({
    mutationFn: () => api.post(`/courses/${course.id}/materials`, { ...m, duration_minutes: Number(m.duration_minutes) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["course", course.id] }); setM({ title: "", kind: "pdf", url: "", content: "", duration_minutes: 20 }); },
  });
  const del = useMutation({ mutationFn: (mid) => api.del(`/materials/${mid}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["course", course.id] }) });
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setErr(null);
    try {
      const r = await api.upload(file);
      const ext = file.name.split(".").pop().toLowerCase();
      const kind = ext === "pdf" ? "pdf" : ["ppt", "pptx"].includes(ext) ? "slide" : ["mp4", "webm"].includes(ext) ? "video" : "file";
      setM((x) => ({ ...x, url: r.url, kind, title: x.title || file.name.replace(/\.[^.]+$/, "") }));
    } catch (ex) { setErr(ex); } finally { setUploading(false); e.target.value = ""; }
  };
  const set = (k) => (e) => setM((x) => ({ ...x, [k]: e.target.value }));
  return (
    <SectionCard title="Materi" subtitle={`${course.materials.length} materi`} icon={FileText}>
      <ol className="divide-y divide-slate-100">
        {course.materials.map((x, i) => (
          <li key={x.id} className="flex items-center gap-2 px-5 py-2.5 text-sm">
            <span className="min-w-0 flex-1"><span className="block truncate font-medium">{i + 1}. {x.title}</span><span className="text-[11px] text-slate-400">{x.kind} · {x.duration_minutes} mnt{x.url && " · ada file/link"}</span></span>
            <button onClick={() => del.mutate(x.id)} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 cursor-pointer" aria-label="Hapus materi"><Trash2 className="size-4" /></button>
          </li>
        ))}
      </ol>
      <div className="space-y-3 border-t border-slate-100 p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Tambah materi</p>
        <Field label="Judul"><Input value={m.title} onChange={set("title")} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Jenis"><Select value={m.kind} onChange={set("kind")}>{KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></Field>
          <Field label="Durasi (menit)"><Input type="number" value={m.duration_minutes} onChange={set("duration_minutes")} /></Field>
        </div>
        {m.kind === "article" ? (
          <Field label="Isi materi"><Textarea value={m.content} onChange={set("content")} /></Field>
        ) : (
          <>
            <Field label="URL" hint="Tempel link (YouTube, SharePoint, Drive) atau upload file"><Input value={m.url} onChange={set("url")} placeholder="https://…" /></Field>
            <input ref={fileRef} type="file" className="hidden" onChange={onFile} accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.mp4,.webm,.mp3,.png,.jpg,.jpeg,.zip,.txt" />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} loading={uploading}><Upload className="size-3.5" /> Upload file (maks 50 MB)</Button>
            <Field label="Keterangan (opsional)"><Textarea value={m.content} onChange={set("content")} className="min-h-14" /></Field>
          </>
        )}
        <ErrorBox error={err || add.error} />
        <Button className="w-full" onClick={() => add.mutate()} disabled={!m.title} loading={add.isPending}>Tambah materi</Button>
      </div>
    </SectionCard>
  );
}
