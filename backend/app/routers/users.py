from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import current_user, ensure_can_view, hash_password, require_roles
from ..db import get_db, today
from ..models import ADMIN, COUNSELEE, COUNSELOR, ROLES, Activity, Enrollment, User
from ..services import badges_for, enrollment_out, hours_summary, user_out

router = APIRouter(prefix="/users", tags=["users"])


@router.get("")
def list_users(role: str | None = None, counselor_id: str | None = None, q: str | None = None,
               user: User = Depends(current_user), db: Session = Depends(get_db)):
    stmt = select(User).order_by(User.name)
    if user.role == COUNSELOR:
        # Counselor hanya melihat counselee binaannya (plus admin/counselor lain untuk dropdown fasilitator)
        if role in (None, COUNSELEE):
            stmt = stmt.where(User.counselor_id == user.id)
    elif user.role != ADMIN:
        raise HTTPException(403, "Tidak boleh melihat daftar pengguna")
    if role:
        stmt = stmt.where(User.role == role)
    if counselor_id:
        stmt = stmt.where(User.counselor_id == counselor_id)
    if q:
        stmt = stmt.where(User.name.ilike(f"%{q}%") | User.email.ilike(f"%{q}%"))
    users = db.scalars(stmt).all()
    out = []
    for u in users:
        row = user_out(u)
        if u.role != ADMIN:
            h = hours_summary(db, u)
            row["hours"] = {k: h[k] for k in ("earned", "target", "percent", "pace")}
        out.append(row)
    return out


class UserIn(BaseModel):
    email: str
    name: str
    role: str
    password: str = Field(min_length=6)
    job_title: str = ""
    department: str = ""
    counselor_id: str | None = None
    annual_target_hours: int = 40
    joined_at: date | None = None


class UserPatch(BaseModel):
    name: str | None = None
    role: str | None = None
    job_title: str | None = None
    department: str | None = None
    counselor_id: str | None = None
    annual_target_hours: int | None = Field(default=None, ge=0, le=500)
    is_active: bool | None = None
    password: str | None = Field(default=None, min_length=6)


def _check_counselor(db: Session, counselor_id: str | None):
    if counselor_id:
        c = db.get(User, counselor_id)
        if not c or c.role not in (COUNSELOR, ADMIN):
            raise HTTPException(400, "Counselor tidak valid")


@router.post("", status_code=201)
def create_user(body: UserIn, admin: User = Depends(require_roles(ADMIN)), db: Session = Depends(get_db)):
    if body.role not in ROLES:
        raise HTTPException(400, "Role tidak valid")
    email = body.email.strip().lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(409, "Email sudah terdaftar")
    _check_counselor(db, body.counselor_id)
    u = User(email=email, name=body.name, role=body.role, password_hash=hash_password(body.password),
             job_title=body.job_title, department=body.department, counselor_id=body.counselor_id,
             annual_target_hours=body.annual_target_hours, joined_at=body.joined_at or today())
    db.add(u)
    db.commit()
    return user_out(u)


@router.patch("/{user_id}")
def update_user(user_id: str, body: UserPatch, admin: User = Depends(require_roles(ADMIN)),
                db: Session = Depends(get_db)):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "Pengguna tidak ditemukan")
    data = body.model_dump(exclude_unset=True)
    if "role" in data and data["role"] not in ROLES:
        raise HTTPException(400, "Role tidak valid")
    if "counselor_id" in data:
        if data["counselor_id"] == u.id:
            raise HTTPException(400, "Tidak bisa menjadi counselor untuk diri sendiri")
        _check_counselor(db, data["counselor_id"])
    if "password" in data:
        u.password_hash = hash_password(data.pop("password"))
    for k, v in data.items():
        setattr(u, k, v)
    db.commit()
    return user_out(u)


@router.get("/{user_id}/profile")
def profile(user_id: str, year: int | None = None, viewer: User = Depends(current_user),
            db: Session = Depends(get_db)):
    """Track record lengkap: ringkasan jam, semua enrollment, badge, timeline aktivitas."""
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "Pengguna tidak ditemukan")
    ensure_can_view(viewer, u)
    ref = today()
    enrollments = db.scalars(
        select(Enrollment).where(Enrollment.user_id == u.id).order_by(Enrollment.created_at.desc())
    ).all()
    acts = db.scalars(
        select(Activity).where(Activity.user_id == u.id).order_by(Activity.created_at.desc()).limit(60)
    ).all()
    actors = {a.actor_id for a in acts if a.actor_id}
    names = {x.id: x.name for x in db.scalars(select(User).where(User.id.in_(actors)))} if actors else {}
    return {
        "user": user_out(u),
        "hours": hours_summary(db, u, year),
        "enrollments": [enrollment_out(e, ref) for e in enrollments],
        "badges": badges_for(db, u),
        "activities": [{"id": a.id, "kind": a.kind, "message": a.message, "created_at": a.created_at.isoformat(),
                        "actor_name": names.get(a.actor_id)} for a in acts],
    }
