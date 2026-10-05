// Mode mockup (VITE_DEMO=1): tanpa backend. GET dibaca dari snapshot data sampel
// (public/demo-data.json, dibuat oleh backend/scripts/export_demo.py); aksi yang mengubah data tidak disimpan.
export const IS_DEMO = import.meta.env.VITE_DEMO === "1";

let dataPromise = null;
let current = null; // email akun demo yang sedang login (hanya di memori)

const load = () => (dataPromise ||= fetch("./demo-data.json").then((r) => r.json()));

export async function demoRequest(method, path, body, ApiError) {
  const data = await load();
  await new Promise((r) => setTimeout(r, 120)); // terasa seperti jaringan sungguhan

  if (path === "/auth/login") {
    const email = String(body?.email || "").trim().toLowerCase();
    const u = data.users[email];
    if (!u || body?.password !== data.password) {
      throw new ApiError(401, { detail: u ? "Email atau kata sandi salah" : "Mockup hanya berisi 3 akun demo: admin@, counselor@, dan member@nomina.id" });
    }
    current = email;
    return u.me;
  }
  if (path === "/auth/logout") {
    current = null;
    return { ok: true };
  }
  if (!current) throw new ApiError(401, { detail: "Belum masuk" });

  if (method !== "GET") {
    throw new ApiError(400, { detail: "Mode mockup: aksi ini tidak disimpan. Jalankan versi penuh (lihat README) untuk mencobanya." });
  }
  const hit = data.users[current].responses[path];
  if (!hit) throw new ApiError(404, { detail: "Data ini tidak tersedia di mockup" });
  if (hit.status >= 400) throw new ApiError(hit.status, hit.body);
  return structuredClone(hit.body);
}
