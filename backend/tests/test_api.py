import os
import tempfile
from datetime import date, timedelta

import pytest

_tmp = tempfile.mkdtemp()
os.environ["NOMINA_DB_URL"] = f"sqlite:///{_tmp}/test.db"
os.environ["NOMINA_UPLOAD_DIR"] = f"{_tmp}/uploads"

from fastapi.testclient import TestClient  # noqa: E402

from app.db import today  # noqa: E402
from app.main import app  # noqa: E402
from app.seed import seed  # noqa: E402

PW = "nomina123"


@pytest.fixture(scope="module", autouse=True)
def _db():
    seed(reset=True)
    yield


def login(email: str, password: str = PW) -> TestClient:
    c = TestClient(app)
    r = c.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return c


def course_by_code(c: TestClient, code: str) -> dict:
    return next(x for x in c.get("/api/courses").json() if x["code"] == code)


def test_login_and_roles():
    c = TestClient(app)
    assert c.post("/api/auth/login", json={"email": "member@nomina.id", "password": "salah"}).status_code == 401
    assert c.get("/api/auth/me").status_code == 401
    for email, role in [("admin@nomina.id", "admin"), ("counselor@nomina.id", "counselor"),
                        ("member@nomina.id", "counselee")]:
        assert login(email).get("/api/auth/me").json()["role"] == role


def test_counselee_access_is_scoped():
    m = login("member@nomina.id")
    assert m.get("/api/users").status_code == 403
    admin = login("admin@nomina.id")
    budi = next(u for u in admin.get("/api/users?q=Budi").json())
    assert m.get(f"/api/users/{budi['id']}/profile").status_code == 403
    me = m.get("/api/auth/me").json()
    prof = m.get(f"/api/users/{me['id']}/profile").json()
    assert prof["hours"]["target"] == 40
    assert prof["hours"]["earned"] == 34
    assert len(prof["badges"]) > 0 and len(prof["activities"]) > 0


def test_member_dashboard_shows_overdue_and_90_day_window():
    m = login("member@nomina.id")
    d = m.get("/api/dashboard").json()["learner"]
    states = {s["state"] for s in d["schedule"]}
    assert {"overdue", "due_soon", "session"} <= states
    # Course SQL (tenggat ±125 hari) belum masuk jendela peringatan 90 hari.
    titles = [s["enrollment"]["course"]["title"] for s in d["schedule"] if s["type"] == "deadline"]
    assert "Dasar Data Analytics dengan SQL" not in titles
    for s in d["schedule"]:
        if s["type"] == "deadline":
            assert s["days_left"] <= 90
    assert d["counts"]["suggested"] == 2


def test_counselor_team_and_assign_permissions():
    andi = login("counselor@nomina.id")
    team = andi.get("/api/team").json()["members"]
    names = {m["user"]["name"] for m in team}
    assert names == {"Siti Rahmawati", "Budi Hartono", "Citra Ayu Lestari", "Dimas Prakoso"}
    # Counselor juga punya target jam sendiri.
    assert andi.get("/api/dashboard").json()["learner"]["hours"]["target"] == 40

    dimas = next(m["user"] for m in team if m["user"]["name"] == "Dimas Prakoso")
    course = course_by_code(andi, "NMA-PRD-180")
    due = (today() + timedelta(days=30)).isoformat()
    r = andi.post("/api/assignments", json={"user_ids": [dimas["id"]], "course_id": course["id"], "due_date": due})
    assert r.status_code == 201 and len(r.json()["created"]) == 1
    # Duplikat dilewati
    r = andi.post("/api/assignments", json={"user_ids": [dimas["id"]], "course_id": course["id"], "due_date": due})
    assert r.json()["skipped"][0]["reason"] == "Sudah terdaftar di course ini"

    admin = login("admin@nomina.id")
    eka = admin.get("/api/users?q=Eka").json()[0]
    r = andi.post("/api/assignments", json={"user_ids": [eka["id"]], "course_id": course["id"], "due_date": due})
    assert r.status_code == 403
    # Course wajib tanpa due date ditolak
    r = andi.post("/api/assignments", json={"user_ids": [dimas["id"]], "course_id": course["id"]})
    assert r.status_code == 400


def test_suggestion_accept_then_complete_online_course_earns_hours_and_certificate():
    andi = login("counselor@nomina.id")
    budi = next(m["user"] for m in andi.get("/api/team").json()["members"] if m["user"]["name"] == "Budi Hartono")
    course = course_by_code(andi, "NMA-HR-171")
    r = andi.post("/api/assignments", json={"user_ids": [budi["id"]], "course_id": course["id"], "kind": "suggested"})
    eid = r.json()["created"][0]["id"]
    assert r.json()["created"][0]["status"] == "suggested"

    b = login("budi@nomina.id")
    before = b.get("/api/dashboard").json()["learner"]["hours"]["earned"]
    assert b.post(f"/api/enrollments/{eid}/accept").json()["status"] == "not_started"
    detail = b.get(f"/api/enrollments/{eid}").json()
    mats = detail["course"]["materials"]
    for i, m in enumerate(mats):
        res = b.post(f"/api/enrollments/{eid}/materials/{m['id']}", json={"done": True}).json()
        assert res["status"] == ("completed" if i == len(mats) - 1 else "in_progress")
    assert res["certificate_no"].startswith(f"NMA/{today().year}/")
    after = b.get("/api/dashboard").json()["learner"]["hours"]["earned"]
    assert after == before + course["duration_hours"]
    cert = b.get(f"/api/certificates/{eid}").json()
    assert cert["user"]["name"] == "Budi Hartono"
    # Counselee lain tidak boleh membuka sertifikat Budi
    assert login("citra@nomina.id").get(f"/api/certificates/{eid}").status_code == 403


def test_room_online_demo_link_and_offline_attendance_completes_course():
    andi = login("counselor@nomina.id")
    team = {m["user"]["name"]: m["user"] for m in andi.get("/api/team").json()["members"]}
    course = course_by_code(andi, "NMA-COM-110")  # offline 8 jam
    start = f"{today().isoformat()}T00:01:00"

    r = andi.post("/api/rooms", json={"course_id": course["id"], "mode": "offline", "start_at": start,
                                      "participant_ids": [team["Citra Ayu Lestari"]["id"]]})
    assert r.status_code == 400  # lokasi wajib

    r = andi.post("/api/rooms", json={"course_id": course["id"], "mode": "offline", "start_at": start,
                                      "location": "Ruang Mastery",
                                      "participant_ids": [team["Citra Ayu Lestari"]["id"]]})
    assert r.status_code == 201, r.text
    room = r.json()
    assert room["platform"] == "offline" and room["participant_count"] == 1

    citra = login("citra@nomina.id")
    enr = next(e for e in citra.get("/api/enrollments").json() if e["course"]["code"] == "NMA-COM-110"
               and e["status"] != "completed")
    assert enr["source"] == "assigned"

    r = andi.post(f"/api/rooms/{room['id']}/attendance", json={"user_id": team["Citra Ayu Lestari"]["id"],
                                                              "status": "attended"})
    assert r.status_code == 200
    enr = citra.get(f"/api/enrollments/{enr['id']}").json()
    assert enr["status"] == "completed" and enr["hours_earned"] == 8

    for platform, prefix in [("zoom", "https://zoom.us/j/"), ("teams", "https://teams.microsoft.com/"),
                             ("gmeet", "https://meet.google.com/")]:
        r = andi.post("/api/rooms", json={"course_id": course["id"], "mode": "online", "platform": platform,
                                          "start_at": f"{(today() + timedelta(days=5)).isoformat()}T10:00:00"})
        assert r.status_code == 201
        assert r.json()["meeting_url"].startswith(prefix) and r.json()["link_source"] == "demo"
    r = andi.post("/api/rooms", json={"course_id": course["id"], "mode": "online", "platform": "zoom",
                                      "meeting_url": "https://zoom.us/j/123", "start_at": "2030-01-01T10:00:00"})
    assert r.json()["link_source"] == "manual"
    ics = andi.get(f"/api/rooms/{r.json()['id']}/ics")
    assert ics.status_code == 200 and "BEGIN:VCALENDAR" in ics.text

    # Counselee tidak boleh membuat kelas
    assert citra.post("/api/rooms", json={"course_id": course["id"], "start_at": start}).status_code == 403


def test_admin_course_crud_and_upload():
    admin = login("admin@nomina.id")
    r = admin.post("/api/courses", json={"code": "TST-001", "title": "Course Uji", "delivery_mode": "online",
                                         "duration_hours": 1.5,
                                         "materials": [{"title": "Modul 1", "content": "Isi"}]})
    assert r.status_code == 201
    cid = r.json()["id"]
    up = admin.post("/api/uploads", files={"file": ("materi.pdf", b"%PDF-1.4 test", "application/pdf")})
    assert up.status_code == 201
    r = admin.post(f"/api/courses/{cid}/materials", json={"title": "Slide", "kind": "pdf", "url": up.json()["url"]})
    assert r.status_code == 201
    assert admin.get(up.json()["url"]).content == b"%PDF-1.4 test"
    assert len(admin.get(f"/api/courses/{cid}").json()["materials"]) == 2
    assert admin.post("/api/uploads", files={"file": ("x.exe", b"MZ", "application/octet-stream")}).status_code == 400
    member = login("member@nomina.id")
    assert member.post("/api/courses", json={"code": "X", "title": "X", "duration_hours": 1}).status_code == 403
    assert admin.delete(f"/api/courses/{cid}").json()["archived"] is False


def test_admin_creates_user_and_sets_target():
    admin = login("admin@nomina.id")
    andi = login("counselor@nomina.id").get("/api/auth/me").json()
    r = admin.post("/api/users", json={"email": "baru@nomina.id", "name": "Peserta Baru", "role": "counselee",
                                       "password": "rahasia1", "counselor_id": andi["id"]})
    assert r.status_code == 201
    uid = r.json()["id"]
    assert admin.patch(f"/api/users/{uid}", json={"annual_target_hours": 48}).json()["annual_target_hours"] == 48
    new = login("baru@nomina.id", "rahasia1")
    assert new.get("/api/dashboard").json()["learner"]["hours"]["target"] == 48
    assert admin.post("/api/users", json={"email": "baru@nomina.id", "name": "X", "role": "counselee",
                                          "password": "rahasia1"}).status_code == 409


def test_deadline_boundaries():
    from app.models import NOT_STARTED, Enrollment
    from app.services import deadline_info

    ref = date(2026, 1, 1)
    e = Enrollment(status=NOT_STARTED)
    for days, state in [(-1, "overdue"), (0, "due_soon"), (90, "due_soon"), (91, "scheduled")]:
        e.due_date = ref + timedelta(days=days)
        assert deadline_info(e, ref)["state"] == state
