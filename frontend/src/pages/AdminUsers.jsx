import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { api } from "@/lib/api";
import { ROLE_LABEL } from "@/lib/session";
import { Avatar, Badge, Button, Card, ErrorBox, Field, Input, Modal, PageHeader, PaceBadge, Select, Spinner, Tabs } from "@/components/ui";

export default function AdminUsers() {
  const { data = [], isLoading } = useQuery({ queryKey: ["users", "all"], queryFn: () => api.get("/users") });
  const [role, setRole] = useState("");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState(null);
  const counselors = data.filter((u) => u.role === "counselor");
  const list = data.filter((u) => (!role || u.role === role) && (!q || `${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase())));
  const c = (r) => data.filter((u) => u.role === r).length;
  return (
    <>
      <PageHeader eyebrow="Administrasi" title="Kelola Pengguna" subtitle="Atur role (admin / counselor / counselee), pasangan counselor–counselee, dan target jam tahunan."
        action={<Button onClick={() => setEdit({})}><Plus className="size-4" /> Pengguna baru</Button>} />
      <div className="mb-4 flex flex-wrap gap-3">
        <Tabs value={role} onChange={setRole} tabs={[{ value: "", label: "Semua", count: data.length }, { value: "admin", label: "Admin", count: c("admin") }, { value: "counselor", label: "Counselor", count: c("counselor") }, { value: "counselee", label: "Counselee", count: c("counselee") }]} />
        <div className="relative min-w-56"><Search className="absolute left-3 top-2.5 size-4 text-slate-400" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari…" className="pl-9" /></div>
      </div>
      {isLoading ? <Spinner /> : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <tr><th className="px-5 py-2">Nama</th><th className="px-3 py-2">Role</th><th className="px-3 py-2">Departemen</th><th className="px-3 py-2">Counselor</th><th className="px-3 py-2">Target</th><th className="px-3 py-2">Progres</th><th className="px-5 py-2" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((u) => (
                <tr key={u.id} className={u.is_active ? "" : "opacity-50"}>
                  <td className="px-5 py-3"><div className="flex items-center gap-3"><Avatar name={u.name} size="sm" /><span>
                    {u.role === "admin" ? <span className="font-semibold">{u.name}</span> : <Link to={`/tim/${u.id}`} className="font-semibold hover:text-brand-600">{u.name}</Link>}
                    <span className="block text-[11px] text-slate-500">{u.email}</span></span></div></td>
                  <td className="px-3 py-3"><Badge tone={u.role === "admin" ? "dark" : u.role === "counselor" ? "violet" : "blue"}>{ROLE_LABEL[u.role]}</Badge></td>
                  <td className="px-3 py-3 text-xs">{u.job_title}<span className="block text-slate-500">{u.department}</span></td>
                  <td className="px-3 py-3 text-xs">{u.counselor_name || "—"}</td>
                  <td className="px-3 py-3 text-xs">{u.role === "admin" ? "—" : `${u.annual_target_hours} jam`}</td>
                  <td className="px-3 py-3 text-xs">{u.hours ? <span className="flex items-center gap-2">{u.hours.earned} jam <PaceBadge pace={u.hours.pace} /></span> : "—"}</td>
                  <td className="px-5 py-3 text-right"><Button size="sm" variant="outline" onClick={() => setEdit(u)}>Edit</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <UserForm user={edit} counselors={counselors} onClose={() => setEdit(null)} />
    </>
  );
}

function UserForm({ user, counselors, onClose }) {
  const qc = useQueryClient();
  const isNew = user && !user.id;
  const [f, setF] = useState({});
  const [lastId, setLastId] = useState(undefined);
  if (user && lastId !== (user.id || "new")) {
    setLastId(user.id || "new");
    setF({ role: "counselee", annual_target_hours: 40, is_active: true, counselor_id: "", ...user, password: "" });
  }
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: f.name, role: f.role, job_title: f.job_title || "", department: f.department || "",
        counselor_id: f.role === "counselee" ? f.counselor_id || null : null, annual_target_hours: Number(f.annual_target_hours),
      };
      if (isNew) return api.post("/users", { ...body, email: f.email, password: f.password });
      return api.patch(`/users/${user.id}`, { ...body, is_active: f.is_active, ...(f.password ? { password: f.password } : {}) });
    },
    onSuccess: () => { qc.invalidateQueries(); setLastId(undefined); onClose(); },
  });
  const close = () => { setLastId(undefined); onClose(); };
  return (
    <Modal open={!!user} onClose={close} title={isNew ? "Pengguna baru" : `Edit ${user?.name}`}
      footer={<><Button variant="outline" onClick={close}>Batal</Button><Button onClick={() => save.mutate()} loading={save.isPending}>Simpan</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nama" className="sm:col-span-2"><Input value={f.name || ""} onChange={set("name")} /></Field>
        <Field label="Email"><Input value={f.email || ""} onChange={set("email")} disabled={!isNew} /></Field>
        <Field label={isNew ? "Kata sandi" : "Kata sandi baru (opsional)"}><Input type="password" value={f.password || ""} onChange={set("password")} /></Field>
        <Field label="Role"><Select value={f.role} onChange={set("role")}><option value="counselee">Member / Counselee</option><option value="counselor">Counselor</option><option value="admin">Admin</option></Select></Field>
        <Field label="Target jam / tahun"><Input type="number" value={f.annual_target_hours ?? 40} onChange={set("annual_target_hours")} disabled={f.role === "admin"} /></Field>
        <Field label="Jabatan"><Input value={f.job_title || ""} onChange={set("job_title")} /></Field>
        <Field label="Departemen"><Input value={f.department || ""} onChange={set("department")} /></Field>
        {f.role === "counselee" && (
          <Field label="Counselor" className="sm:col-span-2">
            <Select value={f.counselor_id || ""} onChange={set("counselor_id")}><option value="">— Belum ditentukan —</option>{counselors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          </Field>
        )}
        {!isNew && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4 accent-brand-500" checked={!!f.is_active} onChange={set("is_active")} /> Akun aktif</label>}
      </div>
      <div className="mt-3"><ErrorBox error={save.error} /></div>
    </Modal>
  );
}
