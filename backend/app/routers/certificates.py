from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import current_user, ensure_can_view
from ..db import get_db
from ..models import COMPLETED, Enrollment, User
from ..services import badges_for, enrollment_out, hours_summary, user_out

router = APIRouter(tags=["certificates"])


@router.get("/certificates")
def list_certificates(user_id: str | None = None, user: User = Depends(current_user), db: Session = Depends(get_db)):
    target = db.get(User, user_id) if user_id else user
    if not target:
        raise HTTPException(404, "Pengguna tidak ditemukan")
    ensure_can_view(user, target)
    done = db.scalars(select(Enrollment).where(
        Enrollment.user_id == target.id, Enrollment.status == COMPLETED,
    ).order_by(Enrollment.completed_at.desc())).all()
    return {
        "user": user_out(target),
        "certificates": [enrollment_out(e) for e in done if e.certificate_no],
        "badges": badges_for(db, target),
        "hours": hours_summary(db, target),
    }


@router.get("/certificates/{enrollment_id}")
def get_certificate(enrollment_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    e = db.get(Enrollment, enrollment_id)
    if not e or not e.certificate_no:
        raise HTTPException(404, "Sertifikat tidak ditemukan")
    ensure_can_view(user, e.user)
    return {**enrollment_out(e), "user": user_out(e.user)}
