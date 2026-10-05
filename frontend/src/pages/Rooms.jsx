import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Clock, MapPin, Plus, Users, Video } from "lucide-react";
import { api } from "@/lib/api";
import { fmtTime, monthShort, parse } from "@/lib/format";
import { useMe } from "@/lib/session";
import { Badge, Button, Card, Empty, PageHeader, PlatformBadge, Spinner, Tabs } from "@/components/ui";
import { RoomFormDialog } from "@/components/dialogs";

const HARI_PANJANG = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export default function Rooms() {
  const { data: me } = useMe();
  const nav = useNavigate();
  const [when, setWhen] = useState("upcoming");
  const [scope, setScope] = useState("auto");
  const [open, setOpen] = useState(false);
  const canCreate = me.role !== "counselee";
  const { data = [], isLoading } = useQuery({ queryKey: ["rooms", when, scope], queryFn: () => api.get(`/rooms?when=${when}&scope=${scope}`) });

  return (
    <>
      <PageHeader eyebrow="Kelas & Jadwal" title="Room Training Online & Offline"
        subtitle={canCreate ? "Buat kelas dengan link Zoom / Microsoft Teams / Google Meet otomatis, atau kelas tatap muka di ruang training." : "Kelas yang Anda ikuti dan kelas terbuka untuk course aktif Anda."}
        action={canCreate && <Button onClick={() => setOpen(true)}><Plus className="size-4" /> Buat kelas</Button>} />
      <div className="mb-5 flex flex-wrap gap-3">
        <Tabs value={when} onChange={setWhen} tabs={[{ value: "upcoming", label: "Akan datang" }, { value: "past", label: "Riwayat" }]} />
        {canCreate && <Tabs value={scope} onChange={setScope} tabs={[{ value: "auto", label: "Semua kelas" }, { value: "mine", label: "Kelas saya" }]} />}
      </div>
      {isLoading ? <Spinner /> : data.length === 0 ? <Empty icon={CalendarDays} title="Belum ada kelas" /> : (
        <div className="space-y-3">
          {data.map((r) => {
            const d = parse(r.start_at);
            return (
              <div key={r.id} role="link" tabIndex={0} onClick={() => nav(`/kelas/${r.id}`)} onKeyDown={(e) => e.key === "Enter" && nav(`/kelas/${r.id}`)} className="block cursor-pointer">
                <Card className="flex flex-wrap items-center gap-4 p-4 transition hover:shadow-md">
                  <div className="flex w-16 flex-col items-center rounded-xl bg-slate-50 py-2">
                    <span className="text-[10px] font-bold uppercase text-slate-400">{HARI_PANJANG[d.getDay()].slice(0, 3)}</span>
                    <span className="text-2xl font-extrabold leading-none text-slate-900">{d.getDate()}</span>
                    <span className="text-[10px] font-bold uppercase text-slate-500">{monthShort(d.getMonth())} {String(d.getFullYear()).slice(2)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <PlatformBadge platform={r.platform} />
                      {r.state === "live" && <Badge tone="red">● Sedang berlangsung</Badge>}
                      {r.my_status && <Badge tone={r.my_status === "attended" ? "green" : r.my_status === "absent" ? "red" : "blue"}>{{ registered: "Terdaftar", attended: "Hadir", absent: "Tidak hadir" }[r.my_status]}</Badge>}
                      {r.link_source === "demo" && <Badge tone="amber">Link demo</Badge>}
                    </div>
                    <p className="mt-1 font-bold text-slate-900">{r.title}</p>
                    <p className="flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><Clock className="size-3" /> {fmtTime(r.start_at)}–{fmtTime(r.end_at)} WIB</span>
                      {r.mode === "offline" ? <span className="flex items-center gap-1"><MapPin className="size-3" /> {r.location.split(",").slice(-1)[0].trim()}</span> : <span className="flex items-center gap-1"><Video className="size-3" /> {r.course.title}</span>}
                      <span className="flex items-center gap-1"><Users className="size-3" /> {r.participant_count}/{r.capacity}</span>
                      {r.facilitator && <span>Fasilitator: {r.facilitator.name}</span>}
                    </p>
                  </div>
                  {r.state !== "finished" && r.mode === "online" && r.meeting_url && (r.my_status || r.can_manage) && (
                    <a href={r.meeting_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant={r.state === "live" ? "danger" : "outline"}><Video className="size-3.5" /> {r.state === "live" ? "Gabung sekarang" : "Link meeting"}</Button>
                    </a>
                  )}
                </Card>
              </div>
            );
          })}
        </div>
      )}
      <RoomFormDialog open={open} onClose={() => setOpen(false)} onCreated={(r) => nav(`/kelas/${r.id}`)} />
    </>
  );
}
