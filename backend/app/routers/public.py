"""Data untuk landing page publik (tanpa login).

Hanya data yang aman dilihat sebelum login: jumlah agregat, katalog yang dipublikasikan, dan
sorotan penyelesaian course dengan nama yang dipendekkan (nama depan + inisial).
"""

from collections import Counter

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db, today
from ..models import ADMIN, COMPLETED, Course, Enrollment, User
from ..services import course_out

router = APIRouter(prefix="/public", tags=["public"])


def short_name(name: str) -> str:
    parts = name.split()
    return parts[0] if len(parts) == 1 else f"{parts[0]} {parts[-1][0]}."


@router.get("/landing")
def landing(db: Session = Depends(get_db)):
    year = today().year
    courses = db.scalars(select(Course).where(Course.is_published.is_(True))).all()
    done = db.scalars(
        select(Enrollment).where(Enrollment.status == COMPLETED).order_by(Enrollment.completed_at.desc())
    ).all()
    done_year = [e for e in done if e.completed_at and e.completed_at.year == year]
    learners = db.scalar(select(func.count()).select_from(User).where(User.role != ADMIN, User.is_active.is_(True)))

    counts = Counter(e.course_id for e in done)
    featured = sorted(courses, key=lambda c: -counts.get(c.id, 0))[:6]

    highlights, seen = [], set()
    for e in done:
        if e.user_id in seen or not e.course.badge_name:
            continue
        seen.add(e.user_id)
        highlights.append({
            "name": short_name(e.user.name), "job_title": e.user.job_title, "department": e.user.department,
            "course_title": e.course.title, "badge": e.course.badge_name, "mode": e.course.delivery_mode,
            "provider": e.course.provider, "hours": e.hours_earned,
        })
        if len(highlights) == 12:
            break

    return {
        "stats": {
            "courses": len(courses),
            "learners": learners,
            "hours_year": round(sum(e.hours_earned for e in done_year)),
            "completions_year": len(done_year),
            "year": year,
        },
        "modes": dict(Counter(c.delivery_mode for c in courses)),
        "providers": dict(Counter(c.provider for c in courses)),
        "featured": [{**course_out(c), "completions": counts.get(c.id, 0)} for c in featured],
        "highlights": highlights,
    }
