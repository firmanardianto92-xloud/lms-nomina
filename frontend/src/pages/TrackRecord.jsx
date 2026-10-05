import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useMe } from "@/lib/session";
import { PageHeader, Spinner } from "@/components/ui";
import { ProfileView } from "@/components/profile";

export default function TrackRecord() {
  const { data: me } = useMe();
  const { data, isLoading } = useQuery({ queryKey: ["profile", me.id], queryFn: () => api.get(`/users/${me.id}/profile`) });
  return (
    <>
      <PageHeader eyebrow="Track Record" title="Riwayat Pengembangan Saya" subtitle="Semua pelatihan yang sudah dan sedang dilaksanakan, jam yang terkumpul, serta jejak aktivitas." />
      {isLoading ? <Spinner /> : <ProfileView profile={data} />}
    </>
  );
}
