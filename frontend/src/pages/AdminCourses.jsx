import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw, Search } from "lucide-react";
import { api } from "@/lib/api";
import { fmtHours } from "@/lib/format";
import { Badge, Button, Card, ErrorBox, Input, ModeBadge, PROVIDER, PageHeader, ProviderBadge, Select, Spinner } from "@/components/ui";

export default function AdminCourses() {
  const [q, setQ] = useState("");
  const [src, setSrc] = useState("");
  const { data = [], isLoading } = useQuery({ queryKey: ["courses", "admin"], queryFn: () => api.get("/courses?include_drafts=true") });
  const list = data.filter((c) => (!src || c.provider === src) && (!q || `${c.title} ${c.code}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <>
      <PageHeader eyebrow="Administrasi" title="Kelola Course" subtitle="Buat course online/offline/blended, upload materi (PDF, slide, video), dan atur badge & sertifikat."
        action={<Link to="/admin/course/baru"><Button><Plus className="size-4" /> Course baru</Button></Link>} />
      <Integrations />
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-56 max-w-sm flex-1"><Search className="absolute left-3 top-2.5 size-4 text-slate-400" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari course…" className="pl-9" /></div>
        <Select value={src} onChange={(e) => setSrc(e.target.value)} className="w-auto" aria-label="Sumber">
          <option value="">Semua sumber</option>
          {Object.entries(PROVIDER).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
        </Select>
      </div>
      {isLoading ? <Spinner /> : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <tr><th className="px-5 py-2">Course</th><th className="px-3 py-2">Sumber</th><th className="px-3 py-2">Mode</th><th className="px-3 py-2">Durasi</th><th className="px-3 py-2">Materi</th><th className="px-3 py-2">Peserta</th><th className="px-3 py-2">Status</th><th className="px-5 py-2" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="size-8 shrink-0 rounded-lg" style={{ background: c.cover_color }} />
                      <span><Link to={`/katalog/${c.id}`} className="font-semibold text-slate-900 hover:text-brand-600">{c.title}</Link>
                        <span className="block text-[11px] text-slate-500">{c.code} · {c.category}</span></span>
                    </div>
                  </td>
                  <td className="px-3 py-3"><ProviderBadge provider={c.provider} /></td>
                  <td className="px-3 py-3"><ModeBadge mode={c.delivery_mode} /></td>
                  <td className="px-3 py-3">{fmtHours(c.duration_hours)}</td>
                  <td className="px-3 py-3">{c.material_count}</td>
                  <td className="px-3 py-3">{c.enrollment_count}</td>
                  <td className="px-3 py-3"><div className="flex gap-1">{c.is_published ? <Badge tone="green">Publik</Badge> : <Badge tone="amber">Draft</Badge>}{c.is_mandatory && <Badge tone="dark">Wajib</Badge>}</div></td>
                  <td className="px-5 py-3 text-right"><Link to={`/admin/course/${c.id}`}><Button size="sm" variant="outline">Edit</Button></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}

function Integrations() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["learning-integrations"], queryFn: () => api.get("/integrations/learning") });
  const [msg, setMsg] = useState("");
  const catalog = useMutation({
    mutationFn: (p) => api.post(`/integrations/learning/${p}/sync-catalog`, { publish: true }),
    onSuccess: (r) => { setMsg(`${PROVIDER[r.provider].label}: ${r.created} course baru, ${r.updated} diperbarui.`); qc.invalidateQueries(); },
  });
  const progress = useMutation({
    mutationFn: () => api.post("/integrations/learning/sync-progress"),
    onSuccess: (r) => {
      setMsg(Object.entries(r).map(([p, v]) => `${PROVIDER[p].short}: ${v.mode === "sample" ? "mode contoh" : v.error || `${v.applied} progres diperbarui`}`).join(" · "));
      qc.invalidateQueries();
    },
  });
  if (!data) return null;
  return (
    <Card className="mb-5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-900">Integrasi Udemy & Coursera</h2>
          <p className="text-sm text-slate-500">Impor katalog dan tarik progres peserta. Jam dihitung penuh sesuai durasi resmi saat course selesai di platform.</p>
        </div>
        <Button variant="outline" onClick={() => progress.mutate()} loading={progress.isPending}><RefreshCw className="size-4" /> Sinkron progres peserta</Button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {["udemy", "coursera"].map((p) => (
          <div key={p} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
            <ProviderBadge provider={p} />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold">{data[p].label}</p>
              <p className="text-xs text-slate-500">{data[p].courses} course di katalog · {data[p].mode === "api" ? "Terhubung via API" : "Mode contoh (belum ada kredensial)"}</p>
            </div>
            {data[p].mode === "sample" && <Badge tone="amber">Contoh</Badge>}
            <Button size="sm" variant="outline" onClick={() => catalog.mutate(p)} loading={catalog.isPending && catalog.variables === p}>Sinkron katalog</Button>
          </div>
        ))}
      </div>
      {msg && <p className="mt-3 text-sm text-emerald-700">✓ {msg}</p>}
      <div className="mt-2"><ErrorBox error={catalog.error || progress.error} /></div>
    </Card>
  );
}
