from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import current_user, ensure_can_view, require_roles
from ..db import get_db, now, today
from ..models import (
    ACTIVE_STATUSES, ADMIN, COMPLETED, COUNSELOR, DECLINED, NOT_STARTED, SRC_ASSIGNED, SRC_SELF,
    SRC_SUGGESTED, SUGGESTED, Course, Enrollment, MaterialProgress, Room, User,
)
from ..services import active_enrollment, course_out, enrollment_out, log, refresh_status, room_out

router = APIRouter(tags=["enrollments"])


def _get_owned(db: Session, enrollment_id: str, user: User) -> Enrollment:
    e = db.get(Enrollment, enrollment_id)
    if not e:
        raise HTTPException(404, "Data pelatihan tidak ditemukan")
    ensure_can_view(user, e.user)
    return e


@router.get("/enrollments")
def list_enrollments(user_id: str | None = None, status: str | None = None,
                     user: User = Depends(current_user), db: Session = Depends(get_db)):
    target = db.get(User, user_id) if user_id else user
    if not target:
        raise HTTPException(404, "Pengguna tidak ditemukan")
    ensure_can_view(user, target)
    stmt = select(Enrollment).where(Enrollment.user_id == target.id).order_by(Enrollment.created_at.desc())
    if status:
        stmt = stmt.where(Enrollment.status.in_(status.split(",")))
    ref = today()
    return [enrollment_out(e, ref) for e in db.scalars(stmt)]


@router.get("/enrollments/{enrollment_id}")
def get_enrollment(enrollment_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    e = _get_owned(db, enrollment_id, user)
    rooms = db.scalars(
        select(Room).where(Room.course_id == e.course_id, Room.end_at >= now()).order_by(Room.start_at)
    ).all()
    past = db.scalars(
        select(Room).where(Room.course_id == e.course_id, Room.end_at < now(),
                           Room.participants.any(user_id=e.user_id)).order_by(Room.start_at.desc())
    ).all()
    out = enrollment_out(e)
    out["course"] = course_out(e.course, full=True)
    out["user"] = {"id": e.user.id, "name": e.user.name}
    out["rooms"] = [room_out(r, e.user) for r in rooms]
    out["past_rooms"] = [room_out(r, e.user) for r in past]
    return out


class SelfEnrollIn(BaseModel):
    course_id: str
    due_date: date | None = None


@router.post("/enrollments", status_code=201)
def self_enroll(body: SelfEnrollIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    if user.role == ADMIN:
        raise HTTPException(400, "Admin tidak mengikuti course")
    c = db.get(Course, body.course_id)
    if not c or not c.is_published:
        raise HTTPException(404, "Course tidak ditemukan")
    existing = active_enrollment(db, user.id, c.id)
    if existing:
        if existing.status == SUGGESTED:
            existing.status = NOT_STARTED
            existing.due_date = existing.due_date or body.due_date
            db.commit()
            return enrollment_out(existing)
        raise HTTPException(409, "Anda sudah terdaftar di course ini")
    e = Enrollment(user_id=user.id, course_id=c.id, source=SRC_SELF, status=NOT_STARTED, due_date=body.due_date)
    db.add(e)
    log(db, user.id, "enrolled", f"Mendaftar course \"{c.title}\" secara mandiri", user.id, c.id)
    db.commit()
    return enrollment_out(e)


class AssignIn(BaseModel):
    user_ids: list[str]
    course_id: str
    kind: str = "assigned"  # assigned (wajib) | suggested (rekomendasi)
    due_date: date | None = None
    note: str = ""


@router.post("/assignments", status_code=201)
def assign(body: AssignIn, actor: User = Depends(require_roles(ADMIN, COUNSELOR)), db: Session = Depends(get_db)):
    """Counselor meng-assign / menyarankan course ke counselee binaannya; admin ke siapa pun."""
    if body.kind not in (SRC_ASSIGNED, SRC_SUGGESTED):
        raise HTTPException(400, "Jenis harus 'assigned' atau 'suggested'")
    if body.kind == SRC_ASSIGNED and not body.due_date:
        raise HTTPException(400, "Course wajib harus memiliki tenggat (due date)")
    if body.due_date and body.due_date < today():
        raise HTTPException(400, "Tenggat tidak boleh di masa lalu")
    c = db.get(Course, body.course_id)
    if not c or not c.is_published:
        raise HTTPException(404, "Course tidak ditemukan")
    created, skipped = [], []
    for uid in dict.fromkeys(body.user_ids):
        u = db.get(User, uid)
        if not u or u.role == ADMIN:
            skipped.append({"user_id": uid, "reason": "Pengguna tidak valid"})
            continue
        if actor.role == COUNSELOR and u.counselor_id != actor.id:
            raise HTTPException(403, f"{u.name} bukan counselee Anda")
        existing = active_enrollment(db, u.id, c.id)
        if existing:
            if existing.status == SUGGESTED and body.kind == SRC_ASSIGNED:
                # Rekomendasi dinaikkan menjadi penugasan wajib.
                existing.status, existing.source = NOT_STARTED, SRC_ASSIGNED
                existing.due_date, existing.assigned_by_id = body.due_date, actor.id
                existing.note = body.note or existing.note
                created.append(existing)
                continue
            skipped.append({"user_id": uid, "name": u.name, "reason": "Sudah terdaftar di course ini"})
            continue
        e = Enrollment(
            user_id=u.id, course_id=c.id, source=body.kind, assigned_by_id=actor.id, note=body.note,
            status=SUGGESTED if body.kind == SRC_SUGGESTED else NOT_STARTED, due_date=body.due_date,
        )
        db.add(e)
        verb = "menyarankan" if body.kind == SRC_SUGGESTED else "menugaskan"
        due = f" (tenggat {body.due_date.strftime('%d/%m/%Y')})" if body.due_date else ""
        log(db, u.id, body.kind, f"{actor.name} {verb} course \"{c.title}\"{due}", actor.id, c.id)
        created.append(e)
    db.commit()
    return {"created": [enrollment_out(e, with_user=True) for e in created], "skipped": skipped}


def _ensure_owner(e: Enrollment, user: User):
    if e.user_id != user.id:
        raise HTTPException(403, "Hanya peserta yang dapat melakukan aksi ini")


@router.post("/enrollments/{enrollment_id}/accept")
def accept(enrollment_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    e = _get_owned(db, enrollment_id, user)
    _ensure_owner(e, user)
    if e.status != SUGGESTED:
        raise HTTPException(400, "Course ini bukan rekomendasi yang menunggu")
    e.status = NOT_STARTED
    log(db, user.id, "accepted", f"Menerima rekomendasi course \"{e.course.title}\"", user.id, e.course_id)
    db.commit()
    return enrollment_out(e)


@router.post("/enrollments/{enrollment_id}/decline")
def decline(enrollment_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    e = _get_owned(db, enrollment_id, user)
    _ensure_owner(e, user)
    if e.status != SUGGESTED:
        raise HTTPException(400, "Course wajib tidak dapat ditolak")
    e.status = DECLINED
    log(db, user.id, "declined", f"Menolak rekomendasi course \"{e.course.title}\"", user.id, e.course_id)
    db.commit()
    return enrollment_out(e)


class MaterialToggle(BaseModel):
    done: bool = True


@router.post("/enrollments/{enrollment_id}/materials/{material_id}")
def toggle_material(enrollment_id: str, material_id: str, body: MaterialToggle,
                    user: User = Depends(current_user), db: Session = Depends(get_db)):
    e = _get_owned(db, enrollment_id, user)
    _ensure_owner(e, user)
    if e.status not in ACTIVE_STATUSES:
        raise HTTPException(400, "Course belum aktif atau sudah selesai")
    if material_id not in {m.id for m in e.course.materials}:
        raise HTTPException(404, "Materi tidak ditemukan di course ini")
    existing = next((p for p in e.progress if p.material_id == material_id), None)
    if body.done and not existing:
        e.progress.append(MaterialProgress(material_id=material_id))
        if not e.started_at:
            log(db, user.id, "started", f"Mulai mengikuti \"{e.course.title}\"", user.id, e.course_id)
    elif not body.done and existing:
        e.progress.remove(existing)
    db.flush()
    refresh_status(db, e, user.id)
    db.commit()
    return enrollment_out(e)


class EnrollmentPatch(BaseModel):
    due_date: date | None = None
    note: str | None = None


def _ensure_manager(e: Enrollment, actor: User):
    if actor.role == ADMIN:
        return
    if actor.role == COUNSELOR and e.user.counselor_id == actor.id:
        return
    raise HTTPException(403, "Hanya counselor/admin yang dapat mengubah penugasan ini")


@router.patch("/enrollments/{enrollment_id}")
def update_enrollment(enrollment_id: str, body: EnrollmentPatch, actor: User = Depends(current_user),
                      db: Session = Depends(get_db)):
    e = _get_owned(db, enrollment_id, actor)
    if e.user_id == actor.id and e.source == SRC_SELF:
        pass  # peserta boleh mengatur target tanggal untuk course mandiri
    else:
        _ensure_manager(e, actor)
    data = body.model_dump(exclude_unset=True)
    if "due_date" in data:
        e.due_date = data["due_date"]
    if "note" in data:
        e.note = data["note"] or ""
    db.commit()
    return enrollment_out(e)


@router.delete("/enrollments/{enrollment_id}")
def cancel_enrollment(enrollment_id: str, actor: User = Depends(current_user), db: Session = Depends(get_db)):
    e = _get_owned(db, enrollment_id, actor)
    if e.status == COMPLETED:
        raise HTTPException(400, "Course yang sudah selesai tidak dapat dibatalkan")
    if not (e.user_id == actor.id and e.source == SRC_SELF):
        _ensure_manager(e, actor)
    log(db, e.user_id, "cancelled", f"Penugasan \"{e.course.title}\" dibatalkan oleh {actor.name}",
        actor.id, e.course_id)
    db.delete(e)
    db.commit()
    return {"ok": True}
