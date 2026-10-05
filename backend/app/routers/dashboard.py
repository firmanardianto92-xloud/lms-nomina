from collections import Counter, defaultdict
from datetime import timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..auth import current_user
from ..db import get_db, now, today
from ..models import (
    ACTIVE_STATUSES, ADMIN, COMPLETED, COUNSELEE, COUNSELOR, SUGGESTED, Activity, Course, Enrollment, Room,
    User,
)
from ..services import (
    WARNING_WINDOW_DAYS, badges_for, deadline_info, enrollment_out, hours_summary, room_out, user_out,
)

router = APIRouter(tags=["dashboard"])

CAL_PAST_DAYS = 45
CAL_FUTURE_DAYS = 200


def _learner_block(db: Session, u: User) -> dict:
    """Ringkasan belajar pribadi — dipakai counselee DAN counselor (counselor juga wajib 40 jam)."""
    ref = today()
    t = now()
    enrollments = db.scalars(select(Enrollment).where(Enrollment.user_id == u.id)).all()
    active = [e for e in enrollments if e.status in ACTIVE_STATUSES]
    rooms = db.scalars(
        select(Room).where(Room.participants.any(user_id=u.id)).order_by(Room.start_at)
    ).all()

    schedule = []
    for e in active:
        d = deadline_info(e, ref)
        if d["state"] in ("overdue", "due_soon"):
            schedule.append({"type": "deadline", "date": e.due_date.isoformat(), "state": d["state"],
                             "urgency": d["urgency"], "days_left": d["days_left"],
                             "enrollment": enrollment_out(e, ref)})
    for r in rooms:
        if r.end_at >= t and (r.start_at.date() - ref).days <= WARNING_WINDOW_DAYS:
            schedule.append({"type": "session", "date": r.start_at.isoformat(), "state": "session",
                             "urgency": None, "days_left": (r.start_at.date() - ref).days, "room": room_out(r, u)})
    schedule.sort(key=lambda x: x["date"])

    lo, hi = ref - timedelta(days=CAL_PAST_DAYS), ref + timedelta(days=CAL_FUTURE_DAYS)
    calendar = []
    for e in active:
        if e.due_date and lo <= e.due_date <= hi:
            calendar.append({"date": e.due_date.isoformat(), "kind": "deadline", "title": e.course.title,
                             "state": deadline_info(e, ref)["state"], "mode": e.course.delivery_mode,
                             "ref_id": e.id})
    for r in rooms:
        if lo <= r.start_at.date() <= hi:
            calendar.append({"date": r.start_at.date().isoformat(), "time": r.start_at.strftime("%H:%M"),
                             "kind": "session", "title": r.title, "state": "session", "mode": r.mode,
                             "platform": r.platform, "ref_id": r.id})

    def sort_key(e):
        return (e.due_date is None, e.due_date or ref)

    counts = Counter(deadline_info(e, ref)["state"] for e in active)
    year_done = [e for e in enrollments if e.status == COMPLETED and e.completed_at and e.completed_at.year == ref.year]
    return {
        "hours": hours_summary(db, u),
        "counts": {
            "overdue": counts.get("overdue", 0), "due_soon": counts.get("due_soon", 0),
            "in_progress": sum(1 for e in active if e.status == "in_progress"),
            "not_started": sum(1 for e in active if e.status == "not_started"),
            "suggested": sum(1 for e in enrollments if e.status == SUGGESTED),
            "completed_year": len(year_done),
            "certificates": sum(1 for e in enrollments if e.certificate_no),
        },
        "schedule": schedule,
        "calendar": calendar,
        "active": [enrollment_out(e, ref) for e in sorted(active, key=sort_key)],
        "suggestions": [enrollment_out(e, ref) for e in enrollments if e.status == SUGGESTED],
        "recent_badges": badges_for(db, u)[:6],
    }


def team_rows(db: Session, members: list[User]) -> list[dict]:
    ref = today()
    rows = []
    for m in members:
        h = hours_summary(db, m)
        es = db.scalars(select(Enrollment).where(Enrollment.user_id == m.id)).all()
        states = Counter(deadline_info(e, ref)["state"] for e in es)
        last = db.scalar(select(Activity.created_at).where(Activity.user_id == m.id)
                         .order_by(Activity.created_at.desc()).limit(1))
        rows.append({
            "user": user_out(m),
            "hours": {k: h[k] for k in ("earned", "target", "percent", "pace", "remaining", "planned")},
            "overdue": states.get("overdue", 0), "due_soon": states.get("due_soon", 0),
            "in_progress": sum(1 for e in es if e.status == "in_progress"),
            "completed_year": h["courses_completed"],
            "suggested": sum(1 for e in es if e.status == SUGGESTED),
            "last_activity": last.isoformat() if last else None,
        })
    return rows


def team_alerts(db: Session, members: list[User]) -> list[dict]:
    ref = today()
    ids = [m.id for m in members]
    if not ids:
        return []
    es = db.scalars(select(Enrollment).where(Enrollment.user_id.in_(ids), Enrollment.status.in_(ACTIVE_STATUSES))).all()
    out = []
    for e in es:
        d = deadline_info(e, ref)
        if d["state"] in ("overdue", "due_soon"):
            out.append(enrollment_out(e, ref, with_user=True))
    out.sort(key=lambda x: x["due_date"])
    return out


def _admin_block(db: Session) -> dict:
    ref = today()
    learners = db.scalars(select(User).where(User.role.in_((COUNSELEE, COUNSELOR)), User.is_active.is_(True))).all()
    summaries = {u.id: hours_summary(db, u) for u in learners}
    pace = Counter(s["pace"] for s in summaries.values())
    monthly = [0.0] * 12
    for s in summaries.values():
        for i, v in enumerate(s["monthly"]):
            monthly[i] += v
    dept = defaultdict(lambda: {"people": 0, "hours": 0.0, "achieved": 0})
    for u in learners:
        d = dept[u.department or "Lainnya"]
        d["people"] += 1
        d["hours"] += summaries[u.id]["earned"]
        d["achieved"] += summaries[u.id]["earned"] >= summaries[u.id]["target"]
    year_completed = db.scalars(select(Enrollment).where(Enrollment.status == COMPLETED)).all()
    year_completed = [e for e in year_completed if e.completed_at and e.completed_at.year == ref.year]
    top = Counter(e.course_id for e in year_completed).most_common(6)
    courses = {c.id: c for c in db.scalars(select(Course))}
    rooms = db.scalars(select(Room).where(Room.end_at >= now()).order_by(Room.start_at).limit(6)).all()
    total_hours = sum(s["earned"] for s in summaries.values())
    alerts = team_alerts(db, learners)
    return {
        "totals": {
            "learners": len(learners),
            "counselors": sum(1 for u in learners if u.role == COUNSELOR),
            "courses": sum(1 for c in courses.values() if c.is_published),
            "hours_ytd": round(total_hours, 1),
            "avg_hours": round(total_hours / len(learners), 1) if learners else 0,
            "certificates_ytd": sum(1 for e in year_completed if e.certificate_no),
            "overdue": sum(1 for a in alerts if a["deadline"]["state"] == "overdue"),
            "due_soon": sum(1 for a in alerts if a["deadline"]["state"] == "due_soon"),
            "upcoming_rooms": db.scalar(select(func.count()).select_from(Room).where(Room.end_at >= now())),
        },
        "pace": {k: pace.get(k, 0) for k in ("achieved", "on_track", "behind", "at_risk")},
        "monthly": [round(v, 1) for v in monthly],
        "departments": sorted(
            [{"department": k, **v, "hours": round(v["hours"], 1),
              "avg": round(v["hours"] / v["people"], 1)} for k, v in dept.items()],
            key=lambda x: -x["avg"]),
        "top_courses": [
            {"course": {"id": cid, "title": courses[cid].title, "delivery_mode": courses[cid].delivery_mode},
             "completions": n} for cid, n in top],
        "upcoming_rooms": [room_out(r) for r in rooms],
        "alerts": alerts[:12],
    }


@router.get("/dashboard")
def dashboard(user: User = Depends(current_user), db: Session = Depends(get_db)):
    out = {"user": user_out(user), "today": today().isoformat(), "warning_window_days": WARNING_WINDOW_DAYS}
    if user.role == ADMIN:
        out["admin"] = _admin_block(db)
        return out
    out["learner"] = _learner_block(db, user)
    if user.role == COUNSELOR:
        members = db.scalars(select(User).where(User.counselor_id == user.id).order_by(User.name)).all()
        out["team"] = {"members": team_rows(db, members), "alerts": team_alerts(db, members)}
    return out


@router.get("/team")
def team(user: User = Depends(current_user), db: Session = Depends(get_db)):
    if user.role == ADMIN:
        members = db.scalars(select(User).where(User.role.in_((COUNSELEE, COUNSELOR))).order_by(User.name)).all()
    elif user.role == COUNSELOR:
        members = db.scalars(select(User).where(User.counselor_id == user.id).order_by(User.name)).all()
    else:
        return {"members": [], "alerts": []}
    return {"members": team_rows(db, members), "alerts": team_alerts(db, members)}
