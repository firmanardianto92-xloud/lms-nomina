const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
export const BULAN_PANJANG = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

// Semua tanggal dari server adalah waktu WIB tanpa offset → parse sebagai waktu lokal.
export function parse(d) {
  if (!d) return null;
  if (d instanceof Date) return d;
  const [date, time = "00:00:00"] = d.split("T");
  const [y, m, day] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, day, hh || 0, mm || 0);
}

export const fmtDate = (d) => {
  const x = parse(d);
  return x ? `${x.getDate()} ${BULAN[x.getMonth()]} ${x.getFullYear()}` : "—";
};
export const fmtLongDate = (d) => {
  const x = parse(d);
  return x ? `${x.getDate()} ${BULAN_PANJANG[x.getMonth()]} ${x.getFullYear()}` : "—";
};
export const fmtTime = (d) => {
  const x = parse(d);
  return x ? `${String(x.getHours()).padStart(2, "0")}.${String(x.getMinutes()).padStart(2, "0")}` : "";
};
export const fmtDateTime = (d) => `${fmtDate(d)}, ${fmtTime(d)} WIB`;
export const fmtHours = (h) => `${Number(h || 0).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jam`;
export const monthShort = (i) => BULAN[i];

export function relDays(n) {
  if (n === null || n === undefined) return "";
  if (n === 0) return "hari ini";
  if (n === 1) return "besok";
  if (n === -1) return "kemarin";
  return n > 0 ? `${n} hari lagi` : `terlambat ${-n} hari`;
}

export function timeAgo(d) {
  const x = parse(d);
  if (!x) return "—";
  const diff = (Date.now() - x.getTime()) / 1000;
  if (diff < 3600) return `${Math.max(1, Math.round(diff / 60))} menit lalu`;
  if (diff < 86400) return `${Math.round(diff / 3600)} jam lalu`;
  if (diff < 86400 * 30) return `${Math.round(diff / 86400)} hari lalu`;
  return fmtDate(d);
}

export const toInputDate = (d) => {
  const x = parse(d) || new Date();
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
export const addDays = (d, n) => {
  const x = new Date(parse(d));
  x.setDate(x.getDate() + n);
  return x;
};

export const initials = (name = "") => name.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]).join("").toUpperCase();
