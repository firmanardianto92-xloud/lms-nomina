"""Pembuatan link meeting online: Zoom, Microsoft Teams, Google Meet.

Setiap provider memakai API resminya bila kredensial tersedia di environment.
Tanpa kredensial, sistem membuat *link demo* (ditandai link_source="demo") agar alur
tetap bisa dicoba; penyelenggara juga selalu bisa menempel link manual.

Zoom   : Server-to-Server OAuth app
         ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, (opsional) ZOOM_USER_ID=me
Teams  : Azure AD app (client credentials) + Application Access Policy untuk onlineMeetings
         MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET, MS_ORGANIZER_ID (user id / UPN penyelenggara)
Meet   : Google service account dengan domain-wide delegation, scope Calendar
         GOOGLE_SA_EMAIL, GOOGLE_SA_PRIVATE_KEY (PEM, \\n boleh di-escape), GOOGLE_IMPERSONATE (email organizer)
"""

import base64
import os
import random
import string
import time
import uuid
from datetime import datetime, timedelta, timezone

import httpx
import jwt

from .db import TZ

TIMEOUT = 15


class MeetingError(Exception):
    pass


def _env(*names: str) -> dict | None:
    vals = {n: os.environ.get(n, "").strip() for n in names}
    return vals if all(vals.values()) else None


def provider_status() -> dict:
    return {
        "zoom": bool(_env("ZOOM_ACCOUNT_ID", "ZOOM_CLIENT_ID", "ZOOM_CLIENT_SECRET")),
        "teams": bool(_env("MS_TENANT_ID", "MS_CLIENT_ID", "MS_CLIENT_SECRET", "MS_ORGANIZER_ID")),
        "gmeet": bool(_env("GOOGLE_SA_EMAIL", "GOOGLE_SA_PRIVATE_KEY", "GOOGLE_IMPERSONATE")),
    }


def _aware(dt: datetime) -> datetime:
    return dt.replace(tzinfo=TZ) if dt.tzinfo is None else dt


# ---------------------------------------------------------------- Zoom
def _zoom(topic: str, start: datetime, end: datetime) -> dict:
    cfg = _env("ZOOM_ACCOUNT_ID", "ZOOM_CLIENT_ID", "ZOOM_CLIENT_SECRET")
    basic = base64.b64encode(f"{cfg['ZOOM_CLIENT_ID']}:{cfg['ZOOM_CLIENT_SECRET']}".encode()).decode()
    tok = httpx.post(
        "https://zoom.us/oauth/token",
        params={"grant_type": "account_credentials", "account_id": cfg["ZOOM_ACCOUNT_ID"]},
        headers={"Authorization": f"Basic {basic}"}, timeout=TIMEOUT,
    )
    if tok.status_code != 200:
        raise MeetingError(f"Zoom OAuth gagal: {tok.text[:200]}")
    user = os.environ.get("ZOOM_USER_ID", "me")
    res = httpx.post(
        f"https://api.zoom.us/v2/users/{user}/meetings",
        headers={"Authorization": f"Bearer {tok.json()['access_token']}"},
        json={
            "topic": topic, "type": 2,
            "start_time": start.strftime("%Y-%m-%dT%H:%M:%S"), "timezone": str(TZ),
            "duration": max(15, int((end - start).total_seconds() // 60)),
            "settings": {"join_before_host": False, "waiting_room": True},
        },
        timeout=TIMEOUT,
    )
    if res.status_code >= 300:
        raise MeetingError(f"Zoom gagal membuat meeting: {res.text[:200]}")
    data = res.json()
    code = f"ID {data.get('id')} · Passcode {data.get('password', '-')}"
    return {"meeting_url": data["join_url"], "meeting_code": code}


# ---------------------------------------------------------------- Microsoft Teams
def _teams(topic: str, start: datetime, end: datetime) -> dict:
    cfg = _env("MS_TENANT_ID", "MS_CLIENT_ID", "MS_CLIENT_SECRET", "MS_ORGANIZER_ID")
    tok = httpx.post(
        f"https://login.microsoftonline.com/{cfg['MS_TENANT_ID']}/oauth2/v2.0/token",
        data={"client_id": cfg["MS_CLIENT_ID"], "client_secret": cfg["MS_CLIENT_SECRET"],
              "scope": "https://graph.microsoft.com/.default", "grant_type": "client_credentials"},
        timeout=TIMEOUT,
    )
    if tok.status_code != 200:
        raise MeetingError(f"Microsoft OAuth gagal: {tok.text[:200]}")
    res = httpx.post(
        f"https://graph.microsoft.com/v1.0/users/{cfg['MS_ORGANIZER_ID']}/onlineMeetings",
        headers={"Authorization": f"Bearer {tok.json()['access_token']}"},
        json={"subject": topic, "startDateTime": _aware(start).isoformat(), "endDateTime": _aware(end).isoformat()},
        timeout=TIMEOUT,
    )
    if res.status_code >= 300:
        raise MeetingError(f"Teams gagal membuat meeting: {res.text[:200]}")
    data = res.json()
    code = (data.get("joinMeetingIdSettings") or {}).get("joinMeetingId", "")
    return {"meeting_url": data["joinWebUrl"], "meeting_code": f"Meeting ID {code}" if code else ""}


# ---------------------------------------------------------------- Google Meet (via Calendar API)
def _gmeet(topic: str, start: datetime, end: datetime) -> dict:
    cfg = _env("GOOGLE_SA_EMAIL", "GOOGLE_SA_PRIVATE_KEY", "GOOGLE_IMPERSONATE")
    key = cfg["GOOGLE_SA_PRIVATE_KEY"].replace("\\n", "\n")
    iat = int(time.time())
    assertion = jwt.encode({
        "iss": cfg["GOOGLE_SA_EMAIL"], "sub": cfg["GOOGLE_IMPERSONATE"],
        "scope": "https://www.googleapis.com/auth/calendar.events",
        "aud": "https://oauth2.googleapis.com/token", "iat": iat, "exp": iat + 3600,
    }, key, algorithm="RS256")
    tok = httpx.post("https://oauth2.googleapis.com/token", data={
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": assertion,
    }, timeout=TIMEOUT)
    if tok.status_code != 200:
        raise MeetingError(f"Google OAuth gagal: {tok.text[:200]}")
    res = httpx.post(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events",
        params={"conferenceDataVersion": 1},
        headers={"Authorization": f"Bearer {tok.json()['access_token']}"},
        json={
            "summary": topic,
            "start": {"dateTime": _aware(start).isoformat(), "timeZone": str(TZ)},
            "end": {"dateTime": _aware(end).isoformat(), "timeZone": str(TZ)},
            "conferenceData": {"createRequest": {
                "requestId": uuid.uuid4().hex, "conferenceSolutionKey": {"type": "hangoutsMeet"},
            }},
        },
        timeout=TIMEOUT,
    )
    if res.status_code >= 300:
        raise MeetingError(f"Google Calendar gagal membuat Meet: {res.text[:200]}")
    data = res.json()
    entry_points = (data.get("conferenceData") or {}).get("entryPoints", [])
    url = data.get("hangoutLink") or next(
        (ep["uri"] for ep in entry_points if ep.get("entryPointType") == "video"), None)
    if not url:
        raise MeetingError("Google tidak mengembalikan link Meet")
    return {"meeting_url": url, "meeting_code": url.rsplit("/", 1)[-1]}


# ---------------------------------------------------------------- demo links
def demo_link(platform: str, rng: random.Random | None = None) -> dict:
    r = rng or random.Random()
    if platform == "zoom":
        mid = "".join(r.choices(string.digits, k=11))
        pwd = "".join(r.choices(string.ascii_letters + string.digits, k=10))
        return {"meeting_url": f"https://zoom.us/j/{mid}?pwd={pwd}",
                "meeting_code": f"ID {mid[:3]} {mid[3:7]} {mid[7:]} · Passcode {pwd[:6]}"}
    if platform == "teams":
        tid = "".join(r.choices(string.ascii_lowercase + string.digits, k=32))
        mid = " ".join("".join(r.choices(string.digits, k=3)) for _ in range(4))
        return {"meeting_url": f"https://teams.microsoft.com/l/meetup-join/19%3ameeting_{tid}%40thread.v2/0",
                "meeting_code": f"Meeting ID {mid}"}
    if platform == "gmeet":
        a = "".join(r.choices(string.ascii_lowercase, k=3))
        b = "".join(r.choices(string.ascii_lowercase, k=4))
        c = "".join(r.choices(string.ascii_lowercase, k=3))
        return {"meeting_url": f"https://meet.google.com/{a}-{b}-{c}", "meeting_code": f"{a}-{b}-{c}"}
    return {"meeting_url": "", "meeting_code": ""}


CREATORS = {"zoom": _zoom, "teams": _teams, "gmeet": _gmeet}


def create_meeting(platform: str, topic: str, start: datetime, end: datetime) -> dict:
    """Return dict meeting_url, meeting_code, link_source (api|demo)."""
    if platform not in CREATORS:
        raise MeetingError("Platform tidak didukung untuk pembuatan link otomatis")
    if provider_status()[platform]:
        return {**CREATORS[platform](topic, start, end), "link_source": "api"}
    return {**demo_link(platform), "link_source": "demo"}


def ics_for(uid: str, title: str, start: datetime, end: datetime, location: str, description: str) -> str:
    def f(dt: datetime) -> str:
        return _aware(dt).astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    def esc(s: str) -> str:
        return s.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    return "\r\n".join([
        "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Nomina Academy//LMS//ID", "CALSCALE:GREGORIAN",
        "BEGIN:VEVENT", f"UID:{uid}@nomina-academy", f"DTSTAMP:{stamp}",
        f"DTSTART:{f(start)}", f"DTEND:{f(end)}", f"SUMMARY:{esc(title)}",
        f"LOCATION:{esc(location)}", f"DESCRIPTION:{esc(description)}",
        "BEGIN:VALARM", "TRIGGER:-PT30M", "ACTION:DISPLAY", "DESCRIPTION:Pengingat kelas", "END:VALARM",
        "END:VEVENT", "END:VCALENDAR", "",
    ])


def default_end(start: datetime, hours: float) -> datetime:
    return start + timedelta(hours=hours)
