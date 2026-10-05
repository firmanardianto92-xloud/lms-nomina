import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Info } from "lucide-react";
import { api } from "@/lib/api";
import { addDays, fmtHours, toInputDate } from "@/lib/format";
import { useMe } from "@/lib/session";
import { Avatar, Badge, Button, ErrorBox, Field, Input, Modal, ModeBadge, PLATFORM, Select, Textarea, cx } from "./ui";

function PeoplePicker({ people, value, onChange }) {
  const [q, setQ] = useState("");
  const list = people.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <div className="rounded-lg border border-slate-200">
      <div className="flex items-center gap-2 border-b border-slate-100 p-2">
        <Input placeholder="Cari nama…" value={q} onChange={(e) => setQ(e.target.value)} className="py-1.5" />
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(value.length === people.length ? [] : people.map((p) => p.id))}>
          {value.length === people.length ? "Kosongkan" : "Semua"}
        </Button>
      </div>
      <div className="max-h-52 overflow-y-auto p-1">
        {list.map((p) => (
          <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-slate-50">
            <input type="checkbox" checked={value.includes(p.id)} onChange={() => toggle(p.id)} className="size-4 accent-brand-500" />
            <Avatar name={p.name} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{p.name}</span>
              <span className="block truncate text-[11px] text-slate-500">{p.job_title} · {p.department}</span>
            </span>
            {p.hours && <span className="text-[11px] text-slate-500">{p.hours.earned}/{p.hours.target} jam</span>}
          </label>
        ))}
        {list.length === 0 && <p className="p-3 text-center text-xs text-slate-400">Tidak ada data</p>}
      </div>
    </div>
  );
}

/** Assign (wajib + tenggat) atau Suggest (rekomendasi) course ke satu/lebih peserta. */
export function AssignDialog({ open, onClose, presetUserIds = [], presetCourseId = "" }) {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const courses = useQuery({ queryKey: ["courses"], queryFn: () => api.get("/courses"), enabled: open });
  const people = useQuery({
    queryKey: ["assignable", me?.role],
    queryFn: async () => {
      if (me.role === "admin") {
        const all = await api.get("/users");
        return all.filter((u) => u.role !== "admin");
      }
      return api.get("/users?role=counselee");
    },
    enabled: open,
  });
  const [form, setForm] = useState({});
  const [result, setResult] = useState(null);
  useEffect(() => {
    if (open) {
      setForm({ kind: "assigned", course_id: presetCourseId, user_ids: presetUserIds, due_date: toInputDate(addDays(new Date(), 60)), note: "" });
      setResult(null);
    }
  }, [open]);
  const course = courses.data?.find((c) => c.id === form.course_id);

  const m = useMutation({
    mutationFn: () => api.post("/assignments", { ...form, due_date: form.due_date || null }),
    onSuccess: (r) => {
      setResult(r);
      qc.invalidateQueries();
    },
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Assign / Sarankan Course"
      subtitle={me?.role === "counselor" ? "Hanya untuk counselee binaan Anda" : "Untuk counselor maupun counselee"}
      footer={
        result ? (
          <Button onClick={onClose}>Selesai</Button>
        ) : (
          <>
            <Button variant="outline" onClick={onClose}>Batal</Button>
            <Button onClick={() => m.mutate()} loading={m.isPending} disabled={!form.course_id || !form.user_ids?.length}>
              {form.kind === "assigned" ? "Tugaskan" : "Kirim rekomendasi"} ({form.user_ids?.length || 0} orang)
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">
            <CheckCircle2 className="size-5" /> {result.created.length} penugasan berhasil dibuat.
          </div>
          {result.skipped.length > 0 && (
            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              <p className="font-semibold">Dilewati:</p>
              {result.skipped.map((s) => <p key={s.user_id}>• {s.name || s.user_id}: {s.reason}</p>)}
            </div>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {[["assigned", "Wajib (assign)", "Masuk target & punya tenggat"], ["suggested", "Rekomendasi", "Peserta memilih terima/tolak"]].map(([v, l, d]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, kind: v }))}
                  className={cx("rounded-xl border p-3 text-left cursor-pointer", form.kind === v ? "border-brand-500 bg-brand-50" : "border-slate-200")}
                >
                  <p className="text-sm font-bold">{l}</p>
                  <p className="text-[11px] text-slate-500">{d}</p>
                </button>
              ))}
            </div>
            <Field label="Course">
              <Select value={form.course_id || ""} onChange={set("course_id")}>
                <option value="">— Pilih course —</option>
                {courses.data?.map((c) => (
                  <option key={c.id} value={c.id}>{c.title} · {c.delivery_mode} · {c.duration_hours} jam</option>
                ))}
              </Select>
            </Field>
            {course && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <ModeBadge mode={course.delivery_mode} /> {fmtHours(course.duration_hours)} · {course.category}
                {course.is_mandatory && <Badge tone="dark">Wajib tahunan</Badge>}
              </div>
            )}
            <Field label={form.kind === "assigned" ? "Tenggat (wajib)" : "Tenggat (opsional)"} hint="Peringatan muncul di dashboard peserta mulai 90 hari sebelum tenggat.">
              <Input type="date" value={form.due_date || ""} min={toInputDate(new Date())} onChange={set("due_date")} />
            </Field>
            <Field label="Catatan untuk peserta">
              <Textarea value={form.note || ""} onChange={set("note")} placeholder="Mis. persiapan promosi, kebutuhan proyek klien…" />
            </Field>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-600">Peserta</p>
            {people.data && <PeoplePicker people={people.data} value={form.user_ids || []} onChange={set("user_ids")} />}
            <ErrorBox error={m.error} />
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Buat room/kelas training online (Zoom/Teams/Meet) atau offline. */
export function RoomFormDialog({ open, onClose, onCreated, presetCourseId = "" }) {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const courses = useQuery({ queryKey: ["courses"], queryFn: () => api.get("/courses"), enabled: open });
  const integrations = useQuery({ queryKey: ["integrations"], queryFn: () => api.get("/integrations/meetings"), enabled: open });
  const facilitators = useQuery({
    queryKey: ["facilitators"],
    queryFn: async () => [...(await api.get("/users?role=admin")), ...(await api.get("/users?role=counselor"))],
    enabled: open,
  });
  const people = useQuery({
    queryKey: ["assignable", me?.role],
    queryFn: async () => (me.role === "admin" ? (await api.get("/users")).filter((u) => u.role !== "admin") : api.get("/users?role=counselee")),
    enabled: open,
  });
  const [f, setF] = useState({});
  useEffect(() => {
    if (open) {
      const d = addDays(new Date(), 7);
      setF({
        course_id: presetCourseId, title: "", mode: "online", platform: "zoom", auto_link: true, meeting_url: "", meeting_code: "",
        location: "Nomina Training Center — Jl. H.R. Rasuna Said Kav. 10, Jakarta Selatan", date: toInputDate(d), start: "09:00", end: "",
        capacity: 25, facilitator_id: me?.id, notes: "", participant_ids: [],
      });
    }
  }, [open]);
  const course = courses.data?.find((c) => c.id === f.course_id);
  const endDefault = useMemo(() => {
    if (!course || !f.start) return "";
    const [h, m] = f.start.split(":").map(Number);
    const mins = h * 60 + m + Math.min(course.duration_hours, 8) * 60;
    return `${String(Math.floor(mins / 60) % 24).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
  }, [course, f.start]);

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e?.target ? (e.target.type === "checkbox" ? e.target.checked : e.target.value) : e }));
  const m = useMutation({
    mutationFn: () =>
      api.post("/rooms", {
        course_id: f.course_id, title: f.title, mode: f.mode, platform: f.mode === "offline" ? "offline" : f.platform,
        auto_link: f.auto_link, meeting_url: f.auto_link ? "" : f.meeting_url, meeting_code: f.meeting_code,
        location: f.mode === "offline" ? f.location : "", start_at: `${f.date}T${f.start}:00`,
        end_at: `${f.date}T${f.end || endDefault}:00`, capacity: Number(f.capacity), facilitator_id: f.facilitator_id,
        notes: f.notes, participant_ids: f.participant_ids,
      }),
    onSuccess: (room) => {
      qc.invalidateQueries();
      onCreated?.(room);
      onClose();
    },
  });
  const configured = integrations.data?.[f.platform];

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Buat Kelas / Room Training"
      subtitle="Kelas online otomatis mendapat link Zoom, Teams, atau Google Meet"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={() => m.mutate()} loading={m.isPending} disabled={!f.course_id || !f.date || !f.start}>Buat kelas</Button>
        </>
      }
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <Field label="Course">
            <Select value={f.course_id || ""} onChange={set("course_id")}>
              <option value="">— Pilih course —</option>
              {courses.data?.map((c) => <option key={c.id} value={c.id}>{c.title} ({c.delivery_mode})</option>)}
            </Select>
          </Field>
          <Field label="Judul kelas" hint="Kosongkan untuk memakai judul course">
            <Input value={f.title || ""} onChange={set("title")} placeholder={course?.title || "Mis. Batch Oktober — Call Center"} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            {[["online", "Online"], ["offline", "Offline (tatap muka)"]].map(([v, l]) => (
              <button key={v} type="button" onClick={() => setF((x) => ({ ...x, mode: v }))}
                className={cx("rounded-xl border p-2.5 text-sm font-semibold cursor-pointer", f.mode === v ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200")}>
                {l}
              </button>
            ))}
          </div>
          {f.mode === "online" ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                {["zoom", "teams", "gmeet"].map((p) => (
                  <button key={p} type="button" onClick={() => setF((x) => ({ ...x, platform: p }))}
                    className={cx("rounded-xl border p-2 text-xs font-bold cursor-pointer", f.platform === p ? "text-white" : "border-slate-200 text-slate-600")}
                    style={f.platform === p ? { background: PLATFORM[p].color, borderColor: PLATFORM[p].color } : undefined}>
                    {PLATFORM[p].label}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!f.auto_link} onChange={set("auto_link")} className="size-4 accent-brand-500" />
                Buat link meeting otomatis
              </label>
              {f.auto_link ? (
                <p className={cx("flex gap-2 rounded-lg p-2.5 text-xs", configured ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800")}>
                  <Info className="size-4 shrink-0" />
                  {configured
                    ? `Integrasi ${PLATFORM[f.platform].label} aktif — meeting asli akan dibuat lewat API.`
                    : `Kredensial ${PLATFORM[f.platform].label} belum diset di server, sistem membuat link demo. Atur di .env backend atau tempel link manual.`}
                </p>
              ) : (
                <>
                  <Field label="Link meeting"><Input value={f.meeting_url} onChange={set("meeting_url")} placeholder="https://…" /></Field>
                  <Field label="Meeting ID / passcode (opsional)"><Input value={f.meeting_code} onChange={set("meeting_code")} /></Field>
                </>
              )}
            </>
          ) : (
            <Field label="Lokasi / ruangan"><Textarea value={f.location} onChange={set("location")} className="min-h-14" /></Field>
          )}
          <div className="grid grid-cols-3 gap-2">
            <Field label="Tanggal"><Input type="date" value={f.date || ""} onChange={set("date")} /></Field>
            <Field label="Mulai"><Input type="time" value={f.start || ""} onChange={set("start")} /></Field>
            <Field label="Selesai"><Input type="time" value={f.end || endDefault} onChange={set("end")} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Kapasitas"><Input type="number" min={1} value={f.capacity || ""} onChange={set("capacity")} /></Field>
            <Field label="Fasilitator">
              <Select value={f.facilitator_id || ""} onChange={set("facilitator_id")}>
                {facilitators.data?.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Catatan / persiapan peserta"><Textarea value={f.notes || ""} onChange={set("notes")} className="min-h-14" /></Field>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold text-slate-600">Undang peserta <span className="font-normal text-slate-400">(otomatis ditugaskan bila belum terdaftar di course)</span></p>
          {people.data && <PeoplePicker people={people.data} value={f.participant_ids || []} onChange={set("participant_ids")} />}
          <div className="mt-3"><ErrorBox error={m.error} /></div>
        </div>
      </div>
    </Modal>
  );
}
