"""Ekspor snapshot API (data sampel) untuk build mockup frontend tanpa backend.

    cd backend && python -m scripts.export_demo ../frontend/public/demo-data.json

Setiap akun demo login, lalu semua endpoint GET yang dipakai frontend direkam
({status, body}) per pengguna. Frontend mode mockup (VITE_DEMO=1) membaca file ini.
"""

import json
import os
import sys
import tempfile

_tmp = tempfile.mkdtemp()
os.environ["NOMINA_DB_URL"] = f"sqlite:///{_tmp}/demo.db"
os.environ["NOMINA_AUTO_SEED"] = "0"

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.seed import DEMO_PASSWORD, seed  # noqa: E402

ACCOUNTS = ["member@nomina.id", "counselor@nomina.id", "admin@nomina.id"]


def capture(c: TestClient, out: dict, path: str):
    if path in out:
        return out[path]["body"]
    r = c.get(f"/api{path}")
    out[path] = {"status": r.status_code, "body": r.json()}
    return out[path]["body"] if r.status_code == 200 else None


def export(email: str) -> dict:
    c = TestClient(app)
    c.post("/api/auth/login", json={"email": email, "password": DEMO_PASSWORD}).raise_for_status()
    out: dict = {}
    me = capture(c, out, "/auth/me")
    for p in ["/dashboard", "/courses", "/enrollments", "/integrations/learning", "/certificates", "/team",
              "/integrations/meetings",
              "/users", "/users?role=counselee", "/users?role=admin", "/users?role=counselor",
              f"/users/{me['id']}/profile"]:
        capture(c, out, p)
    if me["role"] == "admin":
        capture(c, out, "/courses?include_drafts=true")
    courses = capture(c, out, "/courses?include_drafts=true") if me["role"] == "admin" else out["/courses"]["body"]
    for co in courses:
        capture(c, out, f"/courses/{co['id']}")
    for when in ("upcoming", "past"):
        for scope in ("auto", "mine", "all"):
            for room in capture(c, out, f"/rooms?when={when}&scope={scope}") or []:
                capture(c, out, f"/rooms/{room['id']}")
    # Track record pengguna yang boleh dilihat (diri sendiri, counselee, atau semua untuk admin)
    people = [me] + [m["user"] for m in (out["/team"]["body"] or {}).get("members", [])]
    for u in people:
        prof = capture(c, out, f"/users/{u['id']}/profile")
        for e in prof["enrollments"] if prof else []:
            capture(c, out, f"/enrollments/{e['id']}")
            if e["certificate_no"]:
                capture(c, out, f"/certificates/{e['id']}")
    return {"email": email, "me": me, "responses": out}


if __name__ == "__main__":
    seed(reset=True)
    data = {"password": DEMO_PASSWORD, "users": {e: export(e) for e in ACCOUNTS}}
    target = sys.argv[1] if len(sys.argv) > 1 else "demo-data.json"
    with open(target, "w") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(target, os.path.getsize(target) // 1024, "KB", {e: len(u["responses"]) for e, u in data["users"].items()})
