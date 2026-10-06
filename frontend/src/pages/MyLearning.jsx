import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CheckCircle2, GraduationCap } from "lucide-react";
import { api } from "@/lib/api";
import { Button, Empty, ModeLegend, PageHeader, Spinner, Tabs } from "@/components/ui";
import { EnrollmentCard } from "@/components/learning";

export default function MyLearning() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["enrollments"], queryFn: () => api.get("/enrollments") });
  const [tab, setTab] = useState("active");
  const act = useMutation({ mutationFn: ({ id, action }) => api.post(`/enrollments/${id}/${action}`), onSuccess: () => qc.invalidateQueries() });

  const groups = {
    active: data.filter((e) => ["not_started", "in_progress"].includes(e.status))
      .sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999")),
    suggested: data.filter((e) => e.status === "suggested"),
    completed: data.filter((e) => e.status === "completed").sort((a, b) => b.completed_at.localeCompare(a.completed_at)),
  };
  const list = groups[tab];
  return (
    <>
      <PageHeader eyebrow="Pelatihan Saya" title="Course yang Saya Ikuti" subtitle="Course wajib dari counselor/admin, rekomendasi, dan course yang Anda pilih sendiri."
        action={<Link to="/katalog"><Button variant="outline"><BookOpen className="size-4" /> Tambah dari katalog</Button></Link>} />
      <div className="mb-4"><ModeLegend /></div>
      <Tabs value={tab} onChange={setTab} tabs={[
        { value: "active", label: "Aktif", count: groups.active.length },
        { value: "suggested", label: "Rekomendasi", count: groups.suggested.length },
        { value: "completed", label: "Selesai", count: groups.completed.length },
      ]} />
      {isLoading ? <Spinner /> : list.length === 0 ? (
        <Empty icon={GraduationCap} title="Belum ada course di sini" />
      ) : (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((e) => (
            <EnrollmentCard key={e.id} e={e} actions={
              e.status === "suggested" ? (
                <>
                  <Button size="sm" onClick={() => act.mutate({ id: e.id, action: "accept" })}><CheckCircle2 className="size-3.5" /> Terima</Button>
                  <Button size="sm" variant="ghost" onClick={() => act.mutate({ id: e.id, action: "decline" })}>Tolak</Button>
                </>
              ) : e.status === "completed" ? (
                e.certificate_no && <Link to={`/sertifikat/${e.id}/cetak`}><Button size="sm" variant="outline">Lihat sertifikat</Button></Link>
              ) : (
                <Link to={`/belajar/${e.id}`}><Button size="sm">{e.status === "in_progress" ? "Lanjutkan" : "Mulai"}</Button></Link>
              )
            } />
          ))}
        </div>
      )}
    </>
  );
}
