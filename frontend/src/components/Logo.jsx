export function LogoMark({ className = "h-7" }) {
  return (
    <svg viewBox="0 0 64 48" className={className} aria-hidden="true">
      <g fill="#0A84FF">
        <path d="M0 4h20l-10 18z" />
        <path d="M22 4h20L32 22z" opacity=".85" />
        <path d="M44 4h20L54 22z" />
        <path d="M11 26h20L21 44z" opacity=".85" />
        <path d="M33 26h20L43 44z" />
      </g>
    </svg>
  );
}

export function Logo({ dark = true, sub = "Academy" }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      <div className="leading-none">
        <div className={`text-lg font-extrabold tracking-tight ${dark ? "text-white" : "text-slate-900"}`}>Nomina</div>
        <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-500">{sub}</div>
      </div>
    </div>
  );
}
