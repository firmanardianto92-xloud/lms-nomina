import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Award, Clock, LibraryBig, Search, Users } from "lucide-react";
import { api } from "@/lib/api";
import { fmtHours } from "@/lib/format";
import { useMe } from "@/lib/session";
import { Badge, Button, Card, Empty, Input, ModeBadge, PageHeader, Select, Spinner, Tabs } from "@/components/ui";

export default function Catalog() {
  const { data: me } = useMe();
  const [mode, setMode] = useState("");
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const { data = [], isLoading } = useQuery({ queryKey: ["courses"], queryFn: () => api.get("/courses") });
  const categories = [...new Set(data.map((c) => c.category))].sort();
  const list = data.filter((c) => (!mode || c.delivery_mode === mode) && (!cat || c.category === cat) &&
    (!q || `${c.title} ${c.code} ${c.skills.join(" ")}`.toLowerCase().includes(q.toLowerCase())));

  return (
    <>
      <PageHeader eyebrow="Nomina Academy" title="Katalog Course" subtitle="Kurikulum berbasis kebutuhan industri — online mandiri, kelas offline, atau blended."
        action={me.role === "admin" && <Link to="/admin/course/baru"><Button>+ Course baru</Button></Link>} />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Tabs value={mode} onChange={setMode} tabs={[
          { value: "", label: "Semua", count: data.length },
          { value: "online", label: "Online", count: data.filter((c) => c.delivery_mode === "online").length },
          { value: "offline", label: "Offline", count: data.filter((c) => c.delivery_mode === "offline").length },
          { value: "blended", label: "Blended", count: data.filter((c) => c.delivery_mode === "blended").length },
        ]} />
        <Select value={cat} onChange={(e) => setCat(e.target.value)} className="w-auto">
          <option value="">Semua kategori</option>
          {categories.map((c) => <option key={c}>{c}</option>)}
        </Select>
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari course, kode, atau skill…" className="pl-9" />
        </div>
      </div>
      {isLoading ? <Spinner /> : list.length === 0 ? <Empty icon={LibraryBig} title="Course tidak ditemukan" /> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((c) => (
            <Link key={c.id} to={`/katalog/${c.id}`}>
              <Card className="flex h-full flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="relative h-24 p-4" style={{ background: `linear-gradient(135deg, ${c.cover_color}, ${c.cover_color}cc)` }}>
                  <div className="absolute right-0 top-0 h-full w-28 bg-white/10" style={{ clipPath: "polygon(30% 0,100% 0,100% 100%)" }} />
                  <p className="text-[11px] font-bold uppercase tracking-wider text-white/80">{c.category}</p>
                  <p className="mt-1 font-mono text-xs text-white/70">{c.code}</p>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <div className="flex flex-wrap gap-1.5">
                    <ModeBadge mode={c.delivery_mode} />
                    <Badge>{c.level}</Badge>
                    {c.is_mandatory && <Badge tone="dark">Wajib tahunan</Badge>}
                  </div>
                  <h3 className="mt-2 font-bold leading-snug text-slate-900">{c.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">{c.summary}</p>
                  <div className="mt-auto flex items-center gap-4 pt-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Clock className="size-3.5" /> {fmtHours(c.duration_hours)}</span>
                    <span className="flex items-center gap-1"><Users className="size-3.5" /> {c.enrollment_count}</span>
                    {c.badge_name && <span className="flex items-center gap-1 truncate"><Award className="size-3.5" /> {c.badge_name}</span>}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
