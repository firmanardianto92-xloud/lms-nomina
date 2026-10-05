import { useEffect } from "react";
import { Building2, Laptop, Layers, Loader2, Video, X } from "lucide-react";
import { initials } from "@/lib/format";

export const cx = (...c) => c.filter(Boolean).join(" ");

const BTN = {
  primary: "bg-brand-500 text-white hover:bg-brand-600 shadow-sm",
  dark: "bg-ink text-white hover:bg-ink-2",
  outline: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
  ghost: "text-slate-600 hover:bg-slate-100",
  danger: "bg-red-600 text-white hover:bg-red-700",
  success: "bg-emerald-600 text-white hover:bg-emerald-700",
};

export function Button({ variant = "primary", size = "md", className, loading, children, ...props }) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer",
        size === "sm" ? "px-3 py-1.5 text-xs" : size === "lg" ? "px-5 py-3 text-sm" : "px-4 py-2 text-sm",
        BTN[variant],
        className,
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Card({ className, children, ...props }) {
  return (
    <div className={cx("rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]", className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, icon: Icon }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="mt-0.5 rounded-lg bg-brand-50 p-2 text-brand-600">
            <Icon className="size-4" />
          </div>
        )}
        <div>
          <h3 className="font-bold text-slate-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

const TONES = {
  slate: "bg-slate-100 text-slate-700",
  blue: "bg-brand-50 text-brand-700",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  orange: "bg-orange-50 text-orange-700",
  red: "bg-red-50 text-red-700",
  violet: "bg-violet-50 text-violet-700",
  dark: "bg-ink text-white",
};

export function Badge({ tone = "slate", className, children, icon: Icon }) {
  return (
    <span className={cx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold", TONES[tone], className)}>
      {Icon && <Icon className="size-3" />}
      {children}
    </span>
  );
}

export function Field({ label, hint, children, className }) {
  return (
    <label className={cx("block", className)}>
      <span className="mb-1 block text-xs font-semibold text-slate-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-400">{hint}</span>}
    </label>
  );
}

const INPUT = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50";
export const Input = ({ className, ...p }) => <input className={cx(INPUT, className)} {...p} />;
export const Textarea = ({ className, ...p }) => <textarea className={cx(INPUT, "min-h-20", className)} {...p} />;
export const Select = ({ className, children, ...p }) => (
  <select className={cx(INPUT, "pr-8", className)} {...p}>
    {children}
  </select>
);

export function Modal({ open, onClose, title, subtitle, children, footer, wide }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className={cx("my-8 w-full rounded-2xl bg-white shadow-2xl", wide ? "max-w-3xl" : "max-w-lg")} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 cursor-pointer" aria-label="Tutup">
            <X className="size-5" />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={cx(
            "rounded-lg px-3 py-1.5 text-sm font-semibold transition cursor-pointer",
            value === t.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800",
          )}
        >
          {t.label}
          {t.count !== undefined && (
            <span className={cx("ml-1.5 rounded-full px-1.5 text-[11px]", value === t.value ? "bg-brand-50 text-brand-700" : "bg-slate-200")}>{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Progress({ value, className, tone = "brand" }) {
  const color = { brand: "bg-brand-500", green: "bg-emerald-500", amber: "bg-amber-500", red: "bg-red-500" }[tone];
  return (
    <div className={cx("h-2 w-full overflow-hidden rounded-full bg-slate-100", className)}>
      <div className={cx("h-full rounded-full transition-all", color)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export function Spinner({ label = "Memuat…" }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
      <Loader2 className="size-5 animate-spin" /> {label}
    </div>
  );
}

export function Empty({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
      {Icon && <Icon className="mb-3 size-8 text-slate-300" />}
      <p className="font-semibold text-slate-700">{title}</p>
      {children && <p className="mt-1 text-sm text-slate-500">{children}</p>}
    </div>
  );
}

export function ErrorBox({ error }) {
  if (!error) return null;
  return <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error.message || String(error)}</div>;
}

export function Avatar({ name, size = "md", className }) {
  const s = size === "sm" ? "size-7 text-[10px]" : size === "lg" ? "size-14 text-lg" : "size-9 text-xs";
  const palette = ["bg-brand-500", "bg-violet-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-cyan-600", "bg-indigo-500"];
  const idx = [...(name || "")].reduce((a, c) => a + c.charCodeAt(0), 0) % palette.length;
  return <div className={cx("flex shrink-0 items-center justify-center rounded-full font-bold text-white", s, palette[idx], className)}>{initials(name)}</div>;
}

export function PageHeader({ title, subtitle, action, eyebrow }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-brand-500">{eyebrow}</p>}
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({ label, value, hint, icon: Icon, tone = "blue" }) {
  const t = { blue: "bg-brand-50 text-brand-600", red: "bg-red-50 text-red-600", amber: "bg-amber-50 text-amber-600", green: "bg-emerald-50 text-emerald-600", violet: "bg-violet-50 text-violet-600" }[tone];
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        {Icon && (
          <div className={cx("rounded-lg p-1.5", t)}>
            <Icon className="size-4" />
          </div>
        )}
      </div>
      <p className="mt-2 text-2xl font-extrabold text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </Card>
  );
}

// ------------------------------------------------------------------ domain badges
export const MODE = {
  online: { label: "Online", tone: "blue", icon: Laptop },
  offline: { label: "Offline", tone: "orange", icon: Building2 },
  blended: { label: "Blended", tone: "violet", icon: Layers },
};
export const ModeBadge = ({ mode }) => {
  const m = MODE[mode] || MODE.online;
  return <Badge tone={m.tone} icon={m.icon}>{m.label}</Badge>;
};

export const PLATFORM = {
  zoom: { label: "Zoom", color: "#2D8CFF" },
  teams: { label: "Microsoft Teams", color: "#5059C9" },
  gmeet: { label: "Google Meet", color: "#00897B" },
  other: { label: "Link lain", color: "#64748b" },
  offline: { label: "Tatap muka", color: "#ea580c" },
};
export function PlatformBadge({ platform }) {
  const p = PLATFORM[platform] || PLATFORM.other;
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white" style={{ background: p.color }}>
      {platform === "offline" ? <Building2 className="size-3" /> : <Video className="size-3" />}
      {p.label}
    </span>
  );
}

export const STATUS = {
  suggested: { label: "Rekomendasi", tone: "violet" },
  not_started: { label: "Belum mulai", tone: "slate" },
  in_progress: { label: "Berjalan", tone: "blue" },
  completed: { label: "Selesai", tone: "green" },
  declined: { label: "Ditolak", tone: "slate" },
};
export const StatusBadge = ({ status }) => <Badge tone={STATUS[status]?.tone}>{STATUS[status]?.label || status}</Badge>;

export const SOURCE = { assigned: "Ditugaskan", suggested: "Disarankan", self: "Mandiri" };

export const PACE = {
  achieved: { label: "Target tercapai", tone: "green", bar: "green" },
  on_track: { label: "Sesuai jalur", tone: "blue", bar: "brand" },
  behind: { label: "Tertinggal", tone: "amber", bar: "amber" },
  at_risk: { label: "Berisiko", tone: "red", bar: "red" },
};
export const PaceBadge = ({ pace }) => <Badge tone={PACE[pace]?.tone}>{PACE[pace]?.label}</Badge>;

export function DeadlineBadge({ deadline }) {
  if (!deadline || deadline.state === "none") return null;
  const d = deadline.days_left;
  if (deadline.state === "overdue") return <Badge tone="red">Overdue {-d} hari</Badge>;
  if (deadline.state === "scheduled") return <Badge tone="slate">{d} hari lagi</Badge>;
  const tone = deadline.urgency === "critical" ? "red" : deadline.urgency === "soon" ? "orange" : "amber";
  return <Badge tone={tone}>{d === 0 ? "Jatuh tempo hari ini" : `${d} hari lagi`}</Badge>;
}
