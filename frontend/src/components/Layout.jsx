import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Award, BookOpen, CalendarDays, GraduationCap, History, LayoutDashboard, LibraryBig, LogOut, Menu, Settings2, Users, X,
} from "lucide-react";
import { api } from "@/lib/api";
import { ROLE_LABEL, useMe } from "@/lib/session";
import { Logo } from "./Logo";
import { Avatar, cx } from "./ui";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["admin", "counselor", "counselee"], end: true },
  { to: "/pelatihan", label: "Pelatihan Saya", icon: GraduationCap, roles: ["counselor", "counselee"] },
  { to: "/kelas", label: "Kelas & Jadwal", icon: CalendarDays, roles: ["admin", "counselor", "counselee"] },
  { to: "/katalog", label: "Katalog Course", icon: LibraryBig, roles: ["admin", "counselor", "counselee"] },
  { to: "/track-record", label: "Track Record", icon: History, roles: ["counselor", "counselee"] },
  { to: "/sertifikat", label: "Sertifikat & Badge", icon: Award, roles: ["counselor", "counselee"] },
  { section: "Counselor", roles: ["counselor"] },
  { to: "/tim", label: "Counselee Saya", icon: Users, roles: ["counselor"] },
  { section: "Administrasi", roles: ["admin"] },
  { to: "/tim", label: "Monitoring Peserta", icon: Users, roles: ["admin"] },
  { to: "/admin/course", label: "Kelola Course", icon: BookOpen, roles: ["admin"] },
  { to: "/admin/pengguna", label: "Kelola Pengguna", icon: Settings2, roles: ["admin"] },
];

export default function Layout() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  const logout = async () => {
    await api.post("/auth/logout");
    qc.clear();
    nav("/login");
  };

  const items = NAV.filter((n) => n.roles.includes(me.role));
  const sidebar = (
    <div className="flex h-full flex-col bg-ink text-slate-300">
      <div className="flex items-center justify-between px-5 py-5">
        <Logo />
        <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Tutup menu">
          <X className="size-5" />
        </button>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {items.map((n, i) =>
          n.section ? (
            <p key={i} className="px-3 pb-1 pt-5 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{n.section}</p>
          ) : (
            <NavLink
              key={n.to + n.label}
              to={n.to}
              end={n.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cx("flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                  isActive ? "bg-brand-500 text-white" : "hover:bg-white/5 hover:text-white")
              }
            >
              <n.icon className="size-4" /> {n.label}
            </NavLink>
          ),
        )}
      </nav>
      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <Avatar name={me.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{me.name}</p>
            <p className="truncate text-xs text-slate-400">{ROLE_LABEL[me.role]}</p>
          </div>
          <button onClick={logout} className="rounded-lg p-2 hover:bg-white/10 cursor-pointer" title="Keluar" aria-label="Keluar">
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-full">
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64">{sidebar}</aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} aria-label="Buka menu">
            <Menu className="size-5" />
          </button>
          <Logo dark={false} />
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
