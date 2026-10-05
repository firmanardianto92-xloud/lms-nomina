import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { api } from "@/lib/api";
import { fmtHours } from "@/lib/format";
import { Badge, Button, Card, Input, ModeBadge, PageHeader, Spinner } from "@/components/ui";

export default function AdminCourses() {
  const [q, setQ] = useState("");
  const { data = [], isLoading } = useQuery({ queryKey: ["courses", "admin"], queryFn: () => api.get("/courses?include_drafts=true") });
  const list = data.filter((c) => !q || `${c.title} ${c.code}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHeader eyebrow="Administrasi" title="Kelola Course" subtitle="Buat course online/offline/blended, upload materi (PDF, slide, video), dan atur badge & sertifikat."
        action={<Link to="/admin/course/baru"><Button><Plus className="size-4" /> Course baru</Button></Link>} />
      <div className="relative mb-4 max-w-sm"><Search className="absolute left-3 top-2.5 size-4 text-slate-400" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari course…" className="pl-9" /></div>
      {isLoading ? <Spinner /> : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wider text-slate-500">
              <tr><th className="px-5 py-2">Course</th><th className="px-3 py-2">Mode</th><th className="px-3 py-2">Durasi</th><th className="px-3 py-2">Materi</th><th className="px-3 py-2">Peserta</th><th className="px-3 py-2">Status</th><th className="px-5 py-2" /></tr>
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
