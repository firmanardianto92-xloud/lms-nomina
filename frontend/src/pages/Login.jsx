import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ShieldCheck, UserRound, Users } from "lucide-react";
import { api } from "@/lib/api";
import { IS_DEMO } from "@/lib/demo";
import { useMe } from "@/lib/session";
import { Logo } from "@/components/Logo";
import { Button, ErrorBox, Field, Input } from "@/components/ui";

const DEMO = [
  { email: "admin@nomina.id", role: "Admin", name: "Rina Pratama", desc: "Kelola & upload course, pengguna, monitoring seluruh peserta", icon: ShieldCheck },
  { email: "counselor@nomina.id", role: "Counselor", name: "Andi Wijaya", desc: "Assign & monitor counselee, buat kelas, ikut pelatihan wajib", icon: Users },
  { email: "member@nomina.id", role: "Member / Counselee", name: "Siti Rahmawati", desc: "Ikuti course, kumpulkan jam, raih sertifikat", icon: UserRound },
];

export default function Login() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  if (me) return <Navigate to="/" replace />;

  const submit = async (e, creds) => {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const user = await api.post("/auth/login", creds || { email, password });
      qc.setQueryData(["me"], user);
      nav("/");
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-full lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-ink p-12 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-10 size-[420px] rotate-12 bg-brand-500/10" style={{ clipPath: "polygon(0 0,100% 0,50% 100%)" }} />
        <div className="absolute -bottom-24 left-10 size-72 bg-brand-500/10" style={{ clipPath: "polygon(50% 0,100% 100%,0 100%)" }} />
        <Logo />
        <div className="relative">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-brand-500">People Development Portal</p>
          <h1 className="text-4xl font-extrabold leading-tight text-white">Akselerasi Talenta,<br />Akselerasi Bisnis.</h1>
          <p className="mt-4 max-w-md text-slate-400">
            LMS Nomina Academy untuk upskilling karyawan & talenta: course online/offline, target 40 jam per tahun,
            pendampingan counselor, dan sertifikat keahlian.
          </p>
          <div className="mt-8 grid max-w-md grid-cols-3 gap-3 text-center">
            {[["40 jam", "target / tahun"], ["Online + Offline", "Zoom · Teams · Meet"], ["Sertifikat", "& badge skill"]].map(([a, b]) => (
              <div key={a} className="rounded-xl border border-white/10 bg-white/5 px-2 py-3">
                <p className="text-sm font-bold text-white">{a}</p>
                <p className="text-[11px] text-slate-400">{b}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-slate-500">PT Nomina Akselerasi Indonesia · Networking · Ownership · Mastery · Integrity · Nimble · Accelerate</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden"><Logo dark={false} /></div>
          {IS_DEMO && <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Mode mockup — pilih salah satu akun demo di bawah untuk mencoba tiap peran.</p>}
          <h2 className="text-2xl font-extrabold text-slate-900">Masuk ke portal</h2>
          <p className="mt-1 text-sm text-slate-500">Gunakan akun perusahaan Anda.</p>
          <form onSubmit={submit} className="mt-6 space-y-4">
            <Field label="Email">
              <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@nomina.id" autoComplete="username" />
            </Field>
            <Field label="Kata sandi">
              <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </Field>
            <ErrorBox error={error} />
            <Button type="submit" size="lg" className="w-full" loading={loading}>
              Masuk <ArrowRight className="size-4" />
            </Button>
          </form>

          <div className="mt-8">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Akun demo · kata sandi <code className="rounded bg-slate-100 px-1 text-slate-600">nomina123</code></p>
            <div className="space-y-2">
              {DEMO.map((d) => (
                <button
                  key={d.email}
                  onClick={() => submit(null, { email: d.email, password: "nomina123" })}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-brand-500 hover:shadow-sm cursor-pointer"
                >
                  <div className="rounded-lg bg-brand-50 p-2 text-brand-600"><d.icon className="size-5" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900">{d.role} <span className="font-medium text-slate-500">· {d.name}</span></p>
                    <p className="truncate text-xs text-slate-500">{d.desc}</p>
                  </div>
                  <ArrowRight className="size-4 text-slate-400" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
