"""Integrasi platform belajar eksternal: Udemy Business & Coursera for Business.

Tanpa kredensial → **mode contoh**: katalog contoh dipakai dan progres peserta disimulasikan
dari halaman belajar. Dengan kredensial → API resmi dipanggil (endpoint perlu diverifikasi
terhadap developer portal akun Anda; Udemy menaruh dokumentasinya di
https://<subdomain>.udemy.com/dev-portal/api-reference/).

Udemy Business : UDEMY_SUBDOMAIN, UDEMY_ACCOUNT_ID, UDEMY_CLIENT_ID, UDEMY_CLIENT_SECRET,
                 (opsional) UDEMY_XAPI_SECRET untuk webhook xAPI real-time.
Coursera       : COURSERA_ORG_ID, COURSERA_PROGRAM_ID, COURSERA_CLIENT_ID, COURSERA_CLIENT_SECRET

ATURAN JAM: progres dari platform hanya informasi. Jam dihitung penuh sesuai durasi resmi course
saat platform menyatakan course selesai — bukan dari lama akses.
"""

import os
from datetime import datetime
from urllib.parse import quote_plus

import httpx

from .db import TZ
from .models import COURSERA, UDEMY

TIMEOUT = 20
LABEL = {UDEMY: "Udemy Business", COURSERA: "Coursera for Business"}


class ProviderError(Exception):
    pass


def _env(*names: str) -> dict | None:
    vals = {n: os.environ.get(n, "").strip() for n in names}
    return vals if all(vals.values()) else None


def _udemy_cfg():
    return _env("UDEMY_SUBDOMAIN", "UDEMY_ACCOUNT_ID", "UDEMY_CLIENT_ID", "UDEMY_CLIENT_SECRET")


def _coursera_cfg():
    return _env("COURSERA_ORG_ID", "COURSERA_PROGRAM_ID", "COURSERA_CLIENT_ID", "COURSERA_CLIENT_SECRET")


def mode(provider: str) -> str:
    cfg = _udemy_cfg() if provider == UDEMY else _coursera_cfg()
    return "api" if cfg else "sample"


def status() -> dict:
    return {p: {"label": LABEL[p], "mode": mode(p)} for p in (UDEMY, COURSERA)}


# --------------------------------------------------------------------------- katalog contoh
def _search(provider: str, title: str) -> str:
    if provider == UDEMY:
        return f"https://www.udemy.com/courses/search/?q={quote_plus(title)}"
    return f"https://www.coursera.org/search?query={quote_plus(title)}"


_SAMPLE = {
    UDEMY: [
        ("UDM-1001", "Excel Data Analysis: Pivot Tables & Dashboards", "Digital & Data", 11.5, "Menengah",
         ["Pivot Table", "Power Query", "Dashboard"], "Excel Power User"),
        ("UDM-1002", "Complete Customer Service Training", "Customer Service", 6, "Dasar",
         ["Service Mindset", "Komunikasi", "Handling Complaint"], "Service Pro (Udemy)"),
        ("UDM-1003", "Negotiation Skills Masterclass", "Sales", 4.5, "Menengah",
         ["Negosiasi", "BATNA", "Closing"], "Skilled Negotiator"),
        ("UDM-1004", "Project Management Fundamentals", "Event & Project", 9, "Dasar",
         ["Scope", "Timeline", "Risk"], "Project Starter"),
        ("UDM-1005", "Python for Data Analysis Bootcamp", "Digital & Data", 22, "Menengah",
         ["Python", "Pandas", "Visualisasi"], "Python Analyst"),
        ("UDM-1006", "Effective Leadership for New Managers", "Leadership", 7, "Dasar",
         ["Delegasi", "Coaching", "1-on-1"], "New Manager Ready"),
    ],
    COURSERA: [
        ("CRS-2001", "Foundations of Data Analytics", "Digital & Data", 18, "Dasar",
         ["Data Cleaning", "Spreadsheet", "SQL"], "Data Foundations"),
        ("CRS-2002", "Introduction to Project Management", "Event & Project", 14, "Dasar",
         ["Project Lifecycle", "Stakeholder", "Agile"], "PM Essentials"),
        ("CRS-2003", "Leading People and Teams", "Leadership", 12, "Menengah",
         ["Motivasi", "Team Building", "Feedback"], "Team Leader (Coursera)"),
        ("CRS-2004", "Customer Experience Management", "Customer Service", 10, "Menengah",
         ["Customer Journey", "NPS", "Service Design"], "CX Practitioner"),
        ("CRS-2005", "Generative AI Fundamentals for Work", "Digital & Data", 6, "Dasar",
         ["Prompting", "Use Case", "Etika AI"], "GenAI Literate"),
        ("CRS-2006", "Financial Literacy for Professionals", "Soft Skill", 8, "Dasar",
         ["Anggaran", "Laporan Keuangan", "Investasi Dasar"], "Finance Literate"),
    ],
}


def _sample_catalog(provider: str) -> list[dict]:
    color = "#A435F0" if provider == UDEMY else "#0056D2"
    out = []
    for ext_id, title, cat, hours, level, skills, badge in _SAMPLE[provider]:
        out.append({
            "external_id": ext_id, "title": title, "category": cat, "duration_hours": hours, "level": level,
            "skills": skills, "badge_name": badge, "cover_color": color, "external_url": _search(provider, title),
            "instructor": f"Contoh katalog {LABEL[provider]}",
            "summary": f"Course {LABEL[provider]} (contoh). Durasi resmi {hours:g} jam.",
            "description": (f"Diikuti di {LABEL[provider]}. Progres disinkronkan otomatis; jam pelatihan "
                            f"({hours:g} jam) baru dihitung setelah course dinyatakan selesai oleh platform."),
        })
    return out


# --------------------------------------------------------------------------- Udemy Business API
def _udemy_get(path: str, params: dict | None = None) -> list[dict]:
    cfg = _udemy_cfg()
    url = f"https://{cfg['UDEMY_SUBDOMAIN']}.udemy.com/api-2.0/organizations/{cfg['UDEMY_ACCOUNT_ID']}/{path}"
    results, params = [], {"page_size": 100, **(params or {})}
    while url:
        r = httpx.get(url, params=params, auth=(cfg["UDEMY_CLIENT_ID"], cfg["UDEMY_CLIENT_SECRET"]), timeout=TIMEOUT)
        if r.status_code != 200:
            raise ProviderError(f"Udemy API {r.status_code}: {r.text[:200]}")
        data = r.json()
        results += data.get("results", [])
        url, params = data.get("next"), None
    return results


def _udemy_catalog() -> list[dict]:
    out = []
    for c in _udemy_get("courses/list/"):
        minutes = c.get("estimated_content_length") or c.get("content_length") or 60
        out.append({
            "external_id": str(c["id"]), "title": c.get("title", ""), "summary": c.get("headline", ""),
            "description": c.get("description", "")[:2000], "duration_hours": round(minutes / 60, 1),
            "category": (c.get("categories") or ["Udemy"])[0], "level": c.get("level", "Semua level"),
            "instructor": ", ".join(c.get("instructors") or []), "skills": [], "badge_name": c.get("title", "")[:60],
            "cover_color": "#A435F0", "external_url": c.get("url", ""),
        })
    return out


def _udemy_progress() -> list[dict]:
    out = []
    for a in _udemy_get("analytics/user-course-activity/"):
        ratio = a.get("completion_ratio") or 0
        out.append({
            "email": a.get("user_email", ""), "external_id": str(a.get("course_id")),
            "progress": int(round(ratio)), "completed": bool(a.get("course_completion_date")),
            "completed_at": a.get("course_completion_date"), "last_activity": a.get("course_last_accessed_date"),
            "certificate_url": "",
        })
    return out


# --------------------------------------------------------------------------- Coursera for Business API
def _coursera_token(cfg: dict) -> str:
    r = httpx.post("https://api.coursera.com/oauth2/client_credentials/token",
                   data={"grant_type": "client_credentials"},
                   auth=(cfg["COURSERA_CLIENT_ID"], cfg["COURSERA_CLIENT_SECRET"]), timeout=TIMEOUT)
    if r.status_code != 200:
        raise ProviderError(f"Coursera OAuth {r.status_code}: {r.text[:200]}")
    return r.json()["access_token"]


def _coursera_get(path: str) -> list[dict]:
    cfg = _coursera_cfg()
    headers = {"Authorization": f"Bearer {_coursera_token(cfg)}"}
    base = f"https://api.coursera.com/ent/api/businesses.v1/{cfg['COURSERA_ORG_ID']}"
    url, start, results = f"{base}/{path.format(program=cfg['COURSERA_PROGRAM_ID'])}", 0, []
    while True:
        r = httpx.get(url, params={"start": start, "limit": 100}, headers=headers, timeout=TIMEOUT)
        if r.status_code != 200:
            raise ProviderError(f"Coursera API {r.status_code}: {r.text[:200]}")
        data = r.json()
        results += data.get("elements", [])
        nxt = (data.get("paging") or {}).get("next")
        if not nxt:
            return results
        start = int(nxt)


def _coursera_catalog() -> list[dict]:
    out = []
    for c in _coursera_get("programs/{program}/contents"):
        hours = c.get("estimatedHours") or round((c.get("workload") or 60) / 60, 1)
        out.append({
            "external_id": str(c.get("contentId") or c.get("id")), "title": c.get("name", ""),
            "summary": (c.get("description") or "")[:280], "description": c.get("description", ""),
            "duration_hours": float(hours), "category": c.get("domain") or "Coursera", "level": c.get("level") or "",
            "instructor": ", ".join(c.get("partners") or []), "skills": c.get("skills") or [],
            "badge_name": c.get("name", "")[:60], "cover_color": "#0056D2", "external_url": c.get("url", ""),
        })
    return out


def _coursera_progress() -> list[dict]:
    out = []
    for e in _coursera_get("programs/{program}/enrollmentReports"):
        out.append({
            "email": e.get("email") or e.get("externalId") or "", "external_id": str(e.get("contentId")),
            "progress": int(round(e.get("overallProgress") or 0)), "completed": bool(e.get("isCompleted")),
            "completed_at": e.get("completedAt"), "last_activity": e.get("lastActivityAt"),
            "certificate_url": e.get("certificateUrl") or "",
        })
    return out


# --------------------------------------------------------------------------- facade
def fetch_catalog(provider: str) -> list[dict]:
    if mode(provider) == "sample":
        return _sample_catalog(provider)
    return _udemy_catalog() if provider == UDEMY else _coursera_catalog()


def fetch_progress(provider: str) -> list[dict] | None:
    """None di mode contoh (progres disimulasikan dari halaman belajar)."""
    if mode(provider) == "sample":
        return None
    return _udemy_progress() if provider == UDEMY else _coursera_progress()


def parse_dt(v) -> datetime | None:
    if not v:
        return None
    try:
        d = datetime.fromisoformat(str(v).replace("Z", "+00:00"))
    except ValueError:
        return None
    return d.astimezone(TZ).replace(tzinfo=None) if d.tzinfo else d
