import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Mail, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/session";
import { Avatar, Badge, Button, Card, ErrorBox, Spinner } from "@/components/ui";
import { ProfileView } from "@/components/profile";
import { AssignDialog } from "@/components/dialogs";

export default function MemberDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const { data, isLoading, error } = useQuery({ queryKey: ["profile", id], queryFn: () => api.get(`/users/${id}/profile`) });
  if (isLoading) return <Spinner />;
  if (error) return <ErrorBox error={error} />;
  const u = data.user;
  return (
    <>
      <button onClick={() => nav(-1)} className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 cursor-pointer"><ArrowLeft className="size-4" /> Kembali</button>
      <Card className="mb-5 flex flex-wrap items-center gap-4 p-5">
        <Avatar name={u.name} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-extrabold">{u.name}</h1><Badge tone="blue">{ROLE_LABEL[u.role]}</Badge></div>
          <p className="text-sm text-slate-500">{u.job_title} · {u.department}</p>
          <p className="mt-1 flex flex-wrap gap-x-4 text-xs text-slate-500">
            <span className="flex items-center gap-1"><Mail className="size-3" /> {u.email}</span>
            {u.counselor_name && <span>Counselor: <b>{u.counselor_name}</b></span>}
            <span>Bergabung {fmtDate(u.joined_at)}</span>
          </p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="size-4" /> Assign / sarankan course</Button>
      </Card>
      <ProfileView profile={data} />
      <AssignDialog open={open} onClose={() => setOpen(false)} presetUserIds={[u.id]} />
    </>
  );
}
