import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Award, FileBadge2 } from "lucide-react";
import { api } from "@/lib/api";
import { fmtDate, fmtHours } from "@/lib/format";
import { Card, Empty, ModeBadge, PageHeader, Spinner } from "@/components/ui";
import { BadgeChip, SectionCard } from "@/components/learning";

export default function Certificates() {
  const { data, isLoading } = useQuery({ queryKey: ["certificates"], queryFn: () => api.get("/certificates") });
  if (isLoading) return <Spinner />;
  const target = data.badges.filter((b) => b.kind === "target");
  const course = data.badges.filter((b) => b.kind === "course");
  return (
    <>
      <PageHeader eyebrow="Pencapaian" title="Sertifikat & Badge" subtitle="Diterbitkan otomatis setiap kali course selesai. Badge target diberikan bila mencapai target jam tahunan." />
      {target.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-3">
          {target.map((b) => (
            <div key={b.name} className="flex items-center gap-3 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-3 text-white shadow">
              <Award className="size-7" />
              <div><p className="font-extrabold">{b.name}</p><p className="text-xs text-white/90">{b.course_title}</p></div>
            </div>
          ))}
        </div>
      )}
      <SectionCard title="Koleksi Badge" subtitle={`${course.length} badge skill`} icon={Award} className="mb-5">
        <div className="grid grid-cols-3 gap-4 p-5 sm:grid-cols-5 lg:grid-cols-8">{course.map((b, i) => <BadgeChip key={i} b={b} />)}</div>
      </SectionCard>
      <h2 className="mb-3 font-bold text-slate-900">Sertifikat ({data.certificates.length})</h2>
      {data.certificates.length === 0 ? <Empty icon={FileBadge2} title="Belum ada sertifikat" /> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.certificates.map((e) => (
            <Link key={e.id} to={`/sertifikat/${e.id}/cetak`}>
              <Card className="relative overflow-hidden p-5 transition hover:shadow-md">
                <div className="absolute -right-6 -top-6 size-24 rotate-12 opacity-15" style={{ background: e.course.cover_color, clipPath: "polygon(0 0,100% 0,50% 100%)" }} />
                <FileBadge2 className="size-6" style={{ color: e.course.cover_color }} />
                <p className="mt-2 font-mono text-[11px] text-slate-400">{e.certificate_no}</p>
                <p className="font-bold leading-snug text-slate-900">{e.course.title}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                  <span>{fmtDate(e.completed_at)} · {fmtHours(e.hours_earned)}</span>
                  <ModeBadge mode={e.course.delivery_mode} />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
