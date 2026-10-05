"""Aturan bisnis inti: progres, penyelesaian course, jam belajar, deadline, sertifikat."""

from collections import defaultdict
from datetime import date, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .db import now, today
from .models import (
    ACTIVE_STATUSES, BLENDED, COMPLETED, IN_PROGRESS, INTERNAL, OFFLINE, ONLINE, Activity, Course, Enrollment,
    Room, RoomParticipant, User,
)

# Jendela peringatan: deadline mulai tampil di dashboard 90 hari sebelum jatuh tempo.
WARNING_WINDOW_DAYS = 90


# ---------------------------------------------------------------- activity log
def log(db: Session, user_id: str, kind: str, message: str, actor_id: str | None = None,
        course_id: str | None = None, at: datetime | None = None) -> None:
    db.add(Activity(user_id=user_id, kind=kind, message=message, actor_id=actor_id,
                    course_id=course_id, created_at=at or now()))


# ---------------------------------------------------------------- completion rules
def requirements(course: Course) -> dict:
    """online → semua materi selesai; offline → hadir di kelas; blended → keduanya.
    Course Udemy/Coursera → dinyatakan selesai oleh platformnya (progres parsial tidak dihitung)."""
    if course.provider != INTERNAL:
        return {"materials": False, "attendance": False, "external": True}
    has_materials = len(course.materials) > 0
    return {
        "materials": course.delivery_mode in (ONLINE, BLENDED) and has_materials,
        "attendance": course.delivery_mode in (OFFLINE, BLENDED) or not has_materials,
        "external": False,
    }


def progress_pct(e: Enrollment) -> int:
    if e.status == COMPLETED:
        return 100
    req = requirements(e.course)
    if req["external"]:
        # Maks. 99% sampai platform menyatakan selesai.
        return min(e.external_progress, 99)
    parts = []
    if req["materials"]:
        total = len(e.course.materials)
        parts.append(len(e.progress) / total if total else 0)
    if req["attendance"]:
        parts.append(1.0 if e.attended else 0.0)
    return int(round(100 * sum(parts) / len(parts))) if parts else 0


def requirements_met(e: Enrollment) -> bool:
    req = requirements(e.course)
    if req["external"]:
        return e.external_completed
    if req["materials"] and len(e.progress) < len(e.course.materials):
        return False
    if req["attendance"] and not e.attended:
        return False
    return True


def next_certificate_no(db: Session, year: int) -> str:
    n = db.scalar(select(func.count()).select_from(Enrollment).where(Enrollment.certificate_no.like(f"NMA/{year}/%")))
    return f"NMA/{year}/{(n or 0) + 1:05d}"


def complete_enrollment(db: Session, e: Enrollment, at: datetime | None = None, actor_id: str | None = None) -> None:
    at = at or now()
    e.status = COMPLETED
    e.completed_at = at
    e.started_at = e.started_at or at
    e.hours_earned = e.course.duration_hours
    if e.course.has_certificate and not e.certificate_no:
        e.certificate_no = next_certificate_no(db, at.year)
    log(db, e.user_id, "completed",
        f"Menyelesaikan \"{e.course.title}\" (+{fmt_hours(e.hours_earned)} jam)", actor_id, e.course_id, at)
    if e.course.badge_name:
        log(db, e.user_id, "badge", f"Mendapat badge \"{e.course.badge_name}\"", actor_id, e.course_id, at)


def refresh_status(db: Session, e: Enrollment, actor_id: str | None = None) -> None:
    """Dipanggil setelah materi dicentang / absensi ditandai."""
    if e.status not in ACTIVE_STATUSES:
        return
    if requirements_met(e):
        complete_enrollment(db, e, actor_id=actor_id)
    elif e.progress or e.attended or e.external_progress > 0:
        if e.status != IN_PROGRESS:
            e.status = IN_PROGRESS
            e.started_at = e.started_at or now()


def fmt_hours(h: float) -> str:
    return f"{h:g}".replace(".", ",")


# ---------------------------------------------------------------- deadlines
def deadline_info(e: Enrollment, ref: date | None = None) -> dict:
    """overdue / due_soon (≤90 hari) / scheduled (>90 hari) / none."""
    ref = ref or today()
    if e.status not in ACTIVE_STATUSES or not e.due_date:
        return {"state": "none", "days_left": None, "urgency": None}
    days = (e.due_date - ref).days
    if days < 0:
        return {"state": "overdue", "days_left": days, "urgency": "overdue"}
    if days <= WARNING_WINDOW_DAYS:
        urgency = "critical" if days <= 14 else "soon" if days <= 30 else "upcoming"
        return {"state": "due_soon", "days_left": days, "urgency": urgency}
    return {"state": "scheduled", "days_left": days, "urgency": None}


# ---------------------------------------------------------------- hours
def hours_summary(db: Session, user: User, year: int | None = None) -> dict:
    year = year or today().year
    rows = db.scalars(
        select(Enrollment).where(Enrollment.user_id == user.id, Enrollment.status == COMPLETED)
    ).all()
    by_year: dict[int, float] = defaultdict(float)
    monthly = [0.0] * 12
    by_mode = defaultdict(float)
    courses_done = 0
    for e in rows:
        if not e.completed_at:
            continue
        by_year[e.completed_at.year] += e.hours_earned
        if e.completed_at.year == year:
            monthly[e.completed_at.month - 1] += e.hours_earned
            by_mode[e.course.delivery_mode] += e.hours_earned
            courses_done += 1

    active = db.scalars(
        select(Enrollment).where(Enrollment.user_id == user.id, Enrollment.status.in_(ACTIVE_STATUSES))
    ).all()
    planned = sum(e.course.duration_hours for e in active)

    earned = round(by_year.get(year, 0.0), 1)
    target = user.annual_target_hours or 40
    ref = today()
    if year == ref.year:
        elapsed = ref.timetuple().tm_yday / (366 if _leap(year) else 365)
    else:
        elapsed = 1.0 if year < ref.year else 0.0
    expected = round(target * elapsed, 1)
    if earned >= target:
        pace = "achieved"
    elif earned >= expected:
        pace = "on_track"
    elif earned >= expected * 0.6:
        pace = "behind"
    else:
        pace = "at_risk"
    return {
        "year": year,
        "earned": earned,
        "target": target,
        "remaining": round(max(target - earned, 0), 1),
        "percent": min(100, round(100 * earned / target)) if target else 100,
        "expected_to_date": expected,
        "pace": pace,
        "planned": round(planned, 1),
        "courses_completed": courses_done,
        "monthly": [round(m, 1) for m in monthly],
        "by_mode": {k: round(v, 1) for k, v in by_mode.items()},
        "by_year": [{"year": y, "hours": round(h, 1), "target": target, "achieved": h >= target}
                    for y, h in sorted(by_year.items())],
    }


def _leap(y: int) -> bool:
    return y % 4 == 0 and (y % 100 != 0 or y % 400 == 0)


# ---------------------------------------------------------------- serializers
def user_out(u: User | None, brief: bool = False) -> dict | None:
    if not u:
        return None
    out = {"id": u.id, "name": u.name, "email": u.email, "role": u.role, "job_title": u.job_title,
           "department": u.department}
    if brief:
        return out
    out.update({
        "counselor_id": u.counselor_id,
        "counselor_name": u.counselor.name if u.counselor else None,
        "annual_target_hours": u.annual_target_hours,
        "joined_at": u.joined_at.isoformat() if u.joined_at else None,
        "is_active": u.is_active,
    })
    return out


def material_out(m) -> dict:
    return {"id": m.id, "position": m.position, "title": m.title, "kind": m.kind, "url": m.url,
            "content": m.content, "duration_minutes": m.duration_minutes}


def course_out(c: Course, full: bool = False) -> dict:
    out = {
        "id": c.id, "code": c.code, "title": c.title, "summary": c.summary, "category": c.category,
        "delivery_mode": c.delivery_mode, "duration_hours": c.duration_hours, "level": c.level,
        "instructor": c.instructor, "skills": c.skills or [], "badge_name": c.badge_name,
        "has_certificate": c.has_certificate, "is_mandatory": c.is_mandatory,
        "is_published": c.is_published, "cover_color": c.cover_color,
        "provider": c.provider, "external_id": c.external_id, "external_url": c.external_url,
        "material_count": len(c.materials), "requirements": requirements(c),
    }
    if full:
        out["description"] = c.description
        out["materials"] = [material_out(m) for m in c.materials]
    return out


def enrollment_out(e: Enrollment, ref: date | None = None, with_user: bool = False) -> dict:
    out = {
        "id": e.id, "course": course_out(e.course), "source": e.source, "status": e.status,
        "assigned_by": user_out(e.assigned_by, brief=True),
        "due_date": e.due_date.isoformat() if e.due_date else None,
        "note": e.note, "attended": e.attended, "hours_earned": e.hours_earned,
        "certificate_no": e.certificate_no, "progress": progress_pct(e),
        "external": {"progress": e.external_progress, "completed": e.external_completed,
                     "certificate_url": e.external_certificate_url,
                     "last_activity": iso(e.external_last_activity), "synced_at": iso(e.external_synced_at)}
        if e.course.provider != INTERNAL else None,
        "completed_material_ids": [p.material_id for p in e.progress],
        "created_at": iso(e.created_at), "started_at": iso(e.started_at), "completed_at": iso(e.completed_at),
        "deadline": deadline_info(e, ref),
    }
    if with_user:
        out["user"] = user_out(e.user, brief=True)
    return out


def room_out(r: Room, viewer: User | None = None) -> dict:
    counts = defaultdict(int)
    mine = None
    for p in r.participants:
        counts[p.status] += 1
        if viewer and p.user_id == viewer.id:
            mine = p.status
    t = now()
    state = "upcoming" if t < r.start_at else "live" if t <= r.end_at else "finished"
    return {
        "id": r.id, "title": r.title, "course": course_out(r.course), "mode": r.mode, "platform": r.platform,
        "meeting_url": r.meeting_url, "meeting_code": r.meeting_code, "link_source": r.link_source,
        "location": r.location, "start_at": iso(r.start_at), "end_at": iso(r.end_at),
        "capacity": r.capacity, "facilitator": user_out(r.facilitator, brief=True),
        "created_by": user_out(r.created_by, brief=True), "notes": r.notes,
        "participant_count": len(r.participants), "attendance": dict(counts),
        "my_status": mine, "state": state,
        "duration_hours": round((r.end_at - r.start_at).total_seconds() / 3600, 1),
    }


def iso(d: datetime | None) -> str | None:
    return d.isoformat() if d else None


def badges_for(db: Session, user: User) -> list[dict]:
    """Badge course + badge pencapaian target tahunan."""
    done = db.scalars(
        select(Enrollment).where(Enrollment.user_id == user.id, Enrollment.status == COMPLETED)
        .order_by(Enrollment.completed_at.desc())
    ).all()
    out = []
    for e in done:
        if e.course.badge_name:
            out.append({"kind": "course", "name": e.course.badge_name, "course_title": e.course.title,
                        "category": e.course.category, "color": e.course.cover_color,
                        "earned_at": iso(e.completed_at), "enrollment_id": e.id,
                        "certificate_no": e.certificate_no})
    summary = hours_summary(db, user)
    for y in summary["by_year"]:
        if y["achieved"]:
            out.append({"kind": "target", "name": f"Target {user.annual_target_hours} Jam {y['year']}",
                        "course_title": f"{fmt_hours(y['hours'])} jam pelatihan di {y['year']}",
                        "category": "Pencapaian", "color": "#F59E0B", "earned_at": None,
                        "enrollment_id": None, "certificate_no": None})
    return out


def active_enrollment(db: Session, user_id: str, course_id: str) -> Enrollment | None:
    return db.scalar(select(Enrollment).where(
        Enrollment.user_id == user_id, Enrollment.course_id == course_id,
        Enrollment.status.in_(ACTIVE_STATUSES + ("suggested",)),
    ))


def mark_attendance(db: Session, room: Room, p: RoomParticipant, status: str, actor_id: str | None) -> None:
    p.status = status
    p.marked_at = now()
    e = db.scalar(select(Enrollment).where(
        Enrollment.user_id == p.user_id, Enrollment.course_id == room.course_id,
        Enrollment.status.in_(ACTIVE_STATUSES),
    ))
    if not e:
        return
    if status != "attended":
        # Koreksi absensi sebelum course selesai: cabut kehadiran bila tidak hadir di sesi lain.
        db.flush()
        e.attended = db.scalar(select(func.count()).select_from(RoomParticipant).join(Room).where(
            RoomParticipant.user_id == p.user_id, Room.course_id == room.course_id,
            RoomParticipant.status == "attended")) > 0
        return
    if not e.attended:
        e.attended = True
        log(db, p.user_id, "attended", f"Hadir di kelas \"{room.title}\"", actor_id, room.course_id)
        refresh_status(db, e, actor_id)
