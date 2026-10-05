import { IS_DEMO, demoRequest } from "./demo";

// Lapisan fetch ke FastAPI. Selalu relatif ke /api; sesi memakai cookie httpOnly.
export class ApiError extends Error {
  constructor(status, body) {
    super(typeof body?.detail === "string" ? body.detail : `Permintaan gagal (${status})`);
    this.status = status;
    this.body = body;
  }
}

async function request(method, path, body) {
  if (IS_DEMO) return demoRequest(method, path, body, ApiError);
  const isForm = body instanceof FormData;
  const init = { method, credentials: "include" };
  if (body !== undefined) {
    init.body = isForm ? body : JSON.stringify(body);
    if (!isForm) init.headers = { "Content-Type": "application/json" };
  }
  const res = await fetch(`/api${path}`, init);
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    if (Array.isArray(err?.detail)) err.detail = err.detail.map((d) => `${d.loc?.slice(-1)[0]}: ${d.msg}`).join(", ");
    throw new ApiError(res.status, err);
  }
  if (res.status === 204) return undefined;
  return res.json();
}

export const api = {
  get: (p) => request("GET", p),
  post: (p, b) => request("POST", p, b ?? {}),
  put: (p, b) => request("PUT", p, b ?? {}),
  patch: (p, b) => request("PATCH", p, b ?? {}),
  del: (p) => request("DELETE", p),
  upload: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return request("POST", "/uploads", fd);
  },
};
