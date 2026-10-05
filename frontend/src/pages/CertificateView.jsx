import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { api } from "@/lib/api";
import { fmtHours, fmtLongDate } from "@/lib/format";
import { Button, ErrorBox, Spinner } from "@/components/ui";
import { LogoMark } from "@/components/Logo";

export default function CertificateView() {
  const { id } = useParams();
  const nav = useNavigate();
  const { data: e, isLoading, error } = useQuery({ queryKey: ["certificate", id], queryFn: () => api.get(`/certificates/${id}`) });
  if (isLoading) return <Spinner />;
  if (error) return <div className="p-8"><ErrorBox error={error} /></div>;
  const mode = { online: "daring (online)", offline: "luring (tatap muka)", blended: "blended (online & tatap muka)" }[e.course.delivery_mode];
  return (
    <div className="min-h-full bg-slate-200 p-4 print:bg-white print:p-0">
      <div className="no-print mx-auto mb-4 flex max-w-[1000px] justify-between">
        <Button variant="outline" onClick={() => nav(-1)}><ArrowLeft className="size-4" /> Kembali</Button>
        <Button onClick={() => window.print()}><Printer className="size-4" /> Cetak / simpan PDF</Button>
      </div>
      <div className="relative mx-auto aspect-[297/210] max-w-[1000px] overflow-hidden bg-white shadow-xl print:max-w-none print:shadow-none">
        <div className="absolute inset-0 bg-ink" style={{ clipPath: "polygon(0 0, 34% 0, 22% 100%, 0 100%)" }} />
        <div className="absolute inset-0 bg-brand-500" style={{ clipPath: "polygon(34% 0, 37% 0, 25% 100%, 22% 100%)" }} />
        <div className="absolute left-[4%] top-[8%] w-[20%] text-white">
          <LogoMark className="h-10" />
          <p className="mt-2 text-2xl font-extrabold">Nomina</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-brand-500">Academy</p>
        </div>
        <div className="absolute bottom-[8%] left-[4%] w-[16%] text-[10px] text-slate-400">
          <p className="font-mono text-white/80">{e.certificate_no}</p>
          <p className="mt-1">PT Nomina Akselerasi Indonesia</p>
        </div>
        <div className="absolute inset-y-0 left-[40%] right-[5%] flex flex-col justify-center">
          <p className="text-xs font-bold uppercase tracking-[0.4em] text-brand-500">Sertifikat Pelatihan</p>
          <p className="mt-6 text-sm text-slate-500">Diberikan kepada</p>
          <p className="mt-1 text-4xl font-extrabold text-slate-900">{e.user.name}</p>
          <p className="text-sm text-slate-500">{e.user.job_title} · {e.user.department}</p>
          <p className="mt-6 text-sm leading-relaxed text-slate-600">
            atas keberhasilannya menyelesaikan pelatihan {mode}
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{e.course.title}</p>
          <p className="mt-2 text-sm text-slate-600">
            dengan durasi <b>{fmtHours(e.hours_earned)}</b> · kompetensi: {e.course.skills.join(", ")}
          </p>
          <div className="mt-10 flex items-end justify-between">
            <div>
              <p className="text-sm text-slate-500">Jakarta, {fmtLongDate(e.completed_at)}</p>
              <div className="mt-10 w-56 border-t border-slate-300 pt-1">
                <p className="text-sm font-bold">Rina Pratama, CHRP</p>
                <p className="text-xs text-slate-500">Manager Training & Development</p>
              </div>
            </div>
            <div className="flex size-24 flex-col items-center justify-center rounded-full border-4 text-center" style={{ borderColor: e.course.cover_color, color: e.course.cover_color }}>
              <p className="text-[9px] font-bold uppercase tracking-wider">Badge</p>
              <p className="px-2 text-[11px] font-extrabold leading-tight">{e.course.badge_name}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
