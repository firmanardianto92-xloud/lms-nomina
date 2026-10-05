from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..auth import current_user, require_roles
from ..db import get_db, now
from ..models import (
    ACTIVE_STATUSES, ADMIN, COUNSELEE, COUNSELOR, NOT_STARTED, OFFLINE, ONLINE, PLATFORMS, SRC_ASSIGNED,
    SRC_SELF, SUGGESTED, Course, Enrollment, Room, RoomParticipant, User,
)
from ..meetings import MeetingError, create_meeting, ics_for, provider_status
from ..services import active_enrollment, log, mark_attendance, room_out, user_out

router = APIRouter(tags=["rooms"])


def _is_manager(room: Room, user: User) -> bool:
    return user.role == ADMIN or user.id in (room.created_by_id, room.facilitator_id)


def _get(db: Session, room_id: str) -> Room:
    r = db.get(Room, room_id)
    if not r:
        raise HTTPException(404, "Kelas tidak ditemukan")
    return r


@router.get("/integrations/meetings")
def integrations(user: User = Depends(current_user)):
    return provider_status()


@router.get("/rooms")
def list_rooms(when: str = "upcoming", scope: str = "auto", user: User = Depends(current_user),
               db: Session = Depends(get_db)):
    stmt = select(Room)
    t = now()
    if when == "upcoming":
        stmt = stmt.where(Room.end_at >= t).order_by(Room.start_at)
    elif when == "past":
        stmt = stmt.where(Room.end_at < t).order_by(Room.start_at.desc())
    else:
        stmt = stmt.order_by(Room.start_at.desc())

    if user.role == COUNSELEE or scope == "mine":
        # Kelas yang diikuti + kelas terbuka untuk course yang sedang dijalani.
        active_courses = select(Enrollment.course_id).where(
            Enrollment.user_id == user.id, Enrollment.status.in_(ACTIVE_STATUSES))
        conds = [Room.participants.any(user_id=user.id), Room.facilitator_id == user.id,
                 Room.created_by_id == user.id]
        if when != "past":
            conds.append(Room.course_id.in_(active_courses))
        stmt = stmt.where(or_(*conds))
    return [{**room_out(r, user), "can_manage": _is_manager(r, user)} for r in db.scalars(stmt)]


class RoomIn(BaseModel):
    course_id: str
    title: str = ""
    mode: str = ONLINE
    platform: str = "zoom"
    auto_link: bool = True
    meeting_url: str = ""
    meeting_code: str = ""
    location: str = ""
    start_at: datetime
    end_at: datetime | None = None
    capacity: int = Field(default=30, ge=1, le=1000)
    facilitator_id: str | None = None
    notes: str = ""
    participant_ids: list[str] = []


def _apply_link(r: Room, body_platform: str, auto: bool, url: str, code: str):
    if r.mode == OFFLINE:
        r.platform, r.meeting_url, r.meeting_code, r.link_source = "offline", "", "", "manual"
        return
    if body_platform not in PLATFORMS or body_platform == "offline":
        raise HTTPException(400, "Platform online harus zoom, teams, gmeet, atau other")
    r.platform = body_platform
    if url.strip():
        r.meeting_url, r.meeting_code, r.link_source = url.strip(), code.strip(), "manual"
    elif auto and body_platform != "other":
        try:
            m = create_meeting(body_platform, r.title, r.start_at, r.end_at)
        except MeetingError as ex:
            raise HTTPException(502, str(ex))
        r.meeting_url, r.meeting_code, r.link_source = m["meeting_url"], m["meeting_code"], m["link_source"]
    else:
        raise HTTPException(400, "Isi link meeting atau aktifkan pembuatan link otomatis")


def _add_participants(db: Session, r: Room, user_ids: list[str], actor: User) -> list[dict]:
    existing = {p.user_id for p in r.participants}
    skipped = []
    for uid in dict.fromkeys(user_ids):
        if uid in existing:
            continue
        u = db.get(User, uid)
        if not u or u.role == ADMIN:
            skipped.append({"user_id": uid, "reason": "Pengguna tidak valid"})
            continue
        if actor.role == COUNSELOR and u.id != actor.id and u.counselor_id != actor.id:
            raise HTTPException(403, f"{u.name} bukan counselee Anda")
        if len(r.participants) >= r.capacity:
            skipped.append({"user_id": uid, "name": u.name, "reason": "Kapasitas kelas penuh"})
            continue
        r.participants.append(RoomParticipant(user_id=u.id))
        e = active_enrollment(db, u.id, r.course_id)
        if not e:
            db.add(Enrollment(user_id=u.id, course_id=r.course_id, source=SRC_ASSIGNED, assigned_by_id=actor.id,
                              status=NOT_STARTED, due_date=r.end_at.date()))
        elif e.status == SUGGESTED:
            e.status = NOT_STARTED
            e.due_date = e.due_date or r.end_at.date()
        log(db, u.id, "room_invited",
            f"Diundang ke kelas \"{r.title}\" ({r.start_at.strftime('%d/%m/%Y %H:%M')})", actor.id, r.course_id)
    return skipped


@router.post("/rooms", status_code=201)
def create_room(body: RoomIn, actor: User = Depends(require_roles(ADMIN, COUNSELOR)), db: Session = Depends(get_db)):
    c = db.get(Course, body.course_id)
    if not c:
        raise HTTPException(404, "Course tidak ditemukan")
    if body.mode not in (ONLINE, OFFLINE):
        raise HTTPException(400, "Mode kelas harus online atau offline")
    end = body.end_at or body.start_at + timedelta(hours=c.duration_hours)
    if end <= body.start_at:
        raise HTTPException(400, "Waktu selesai harus setelah waktu mulai")
    if body.mode == OFFLINE and not body.location.strip():
        raise HTTPException(400, "Lokasi wajib diisi untuk kelas offline")
    fac = db.get(User, body.facilitator_id) if body.facilitator_id else actor
    if not fac or fac.role not in (ADMIN, COUNSELOR):
        raise HTTPException(400, "Fasilitator harus admin atau counselor")
    r = Room(course_id=c.id, title=body.title.strip() or c.title, mode=body.mode, location=body.location.strip(),
             start_at=body.start_at.replace(tzinfo=None), end_at=end.replace(tzinfo=None), capacity=body.capacity,
             facilitator_id=fac.id, created_by_id=actor.id, notes=body.notes)
    _apply_link(r, body.platform, body.auto_link, body.meeting_url, body.meeting_code)
    db.add(r)
    db.flush()
    skipped = _add_participants(db, r, body.participant_ids, actor)
    db.commit()
    return {**room_out(r, actor), "can_manage": True, "skipped": skipped}


@router.get("/rooms/{room_id}")
def get_room(room_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    r = _get(db, room_id)
    manage = _is_manager(r, user)
    out = {**room_out(r, user), "can_manage": manage}
    if manage or user.role in (ADMIN, COUNSELOR):
        visible = r.participants
        if user.role == COUNSELOR and not manage:
            visible = [p for p in r.participants if p.user.counselor_id == user.id or p.user_id == user.id]
        out["participants"] = [{"user": user_out(p.user, brief=True), "status": p.status,
                                "marked_at": p.marked_at.isoformat() if p.marked_at else None}
                               for p in sorted(visible, key=lambda p: p.user.name)]
    elif not out["my_status"]:
        # Counselee hanya boleh melihat kelas yang relevan dengan course aktifnya.
        if not active_enrollment(db, user.id, r.course_id):
            raise HTTPException(403, "Kelas ini bukan untuk Anda")
    return out


class RoomPatch(BaseModel):
    title: str | None = None
    platform: str | None = None
    meeting_url: str | None = None
    meeting_code: str | None = None
    location: str | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    capacity: int | None = Field(default=None, ge=1, le=1000)
    notes: str | None = None


@router.patch("/rooms/{room_id}")
def update_room(room_id: str, body: RoomPatch, user: User = Depends(current_user), db: Session = Depends(get_db)):
    r = _get(db, room_id)
    if not _is_manager(r, user):
        raise HTTPException(403, "Hanya penyelenggara yang dapat mengubah kelas")
    data = body.model_dump(exclude_unset=True)
    for k in ("start_at", "end_at"):
        if data.get(k):
            data[k] = data[k].replace(tzinfo=None)
    for k, v in data.items():
        if v is not None:
            setattr(r, k, v)
    if "meeting_url" in data and data["meeting_url"]:
        r.link_source = "manual"
    if r.end_at <= r.start_at:
        raise HTTPException(400, "Waktu selesai harus setelah waktu mulai")
    db.commit()
    return {**room_out(r, user), "can_manage": True}


@router.post("/rooms/{room_id}/link")
def regenerate_link(room_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    r = _get(db, room_id)
    if not _is_manager(r, user):
        raise HTTPException(403, "Hanya penyelenggara yang dapat membuat ulang link")
    if r.mode != ONLINE or r.platform not in ("zoom", "teams", "gmeet"):
        raise HTTPException(400, "Link otomatis hanya untuk kelas online Zoom/Teams/Meet")
    _apply_link(r, r.platform, True, "", "")
    db.commit()
    return {**room_out(r, user), "can_manage": True}


@router.delete("/rooms/{room_id}")
def delete_room(room_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    r = _get(db, room_id)
    if not _is_manager(r, user):
        raise HTTPException(403, "Hanya penyelenggara yang dapat menghapus kelas")
    if any(p.status == "attended" for p in r.participants):
        raise HTTPException(400, "Kelas yang sudah memiliki absensi tidak dapat dihapus")
    db.delete(r)
    db.commit()
    return {"ok": True}


class IdsIn(BaseModel):
    user_ids: list[str]


@router.post("/rooms/{room_id}/participants")
def add_participants(room_id: str, body: IdsIn, user: User = Depends(require_roles(ADMIN, COUNSELOR)),
                     db: Session = Depends(get_db)):
    r = _get(db, room_id)
    if user.role != ADMIN and not _is_manager(r, user):
        # Counselor lain boleh mendaftarkan counselee-nya ke kelas yang ada.
        if any(db.get(User, uid) is None or db.get(User, uid).counselor_id != user.id for uid in body.user_ids):
            raise HTTPException(403, "Hanya boleh mendaftarkan counselee Anda sendiri")
    skipped = _add_participants(db, r, body.user_ids, user)
    db.commit()
    return {"ok": True, "skipped": skipped}


@router.delete("/rooms/{room_id}/participants/{user_id}")
def remove_participant(room_id: str, user_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    r = _get(db, room_id)
    if not (_is_manager(r, user) or user.id == user_id):
        raise HTTPException(403, "Tidak boleh menghapus peserta ini")
    p = next((p for p in r.participants if p.user_id == user_id), None)
    if not p:
        raise HTTPException(404, "Peserta tidak ada di kelas ini")
    if p.status == "attended":
        raise HTTPException(400, "Peserta sudah tercatat hadir")
    r.participants.remove(p)
    db.commit()
    return {"ok": True}


@router.post("/rooms/{room_id}/register")
def register(room_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    r = _get(db, room_id)
    if user.role == ADMIN:
        raise HTTPException(400, "Admin tidak mendaftar sebagai peserta")
    if r.end_at < now():
        raise HTTPException(400, "Kelas sudah selesai")
    if any(p.user_id == user.id for p in r.participants):
        raise HTTPException(409, "Anda sudah terdaftar di kelas ini")
    if len(r.participants) >= r.capacity:
        raise HTTPException(400, "Kapasitas kelas penuh")
    r.participants.append(RoomParticipant(user_id=user.id))
    e = active_enrollment(db, user.id, r.course_id)
    if not e:
        db.add(Enrollment(user_id=user.id, course_id=r.course_id, source=SRC_SELF, status=NOT_STARTED,
                          due_date=r.end_at.date()))
    elif e.status == SUGGESTED:
        e.status = NOT_STARTED
    log(db, user.id, "room_registered", f"Mendaftar kelas \"{r.title}\" ({r.start_at.strftime('%d/%m/%Y %H:%M')})",
        user.id, r.course_id)
    db.commit()
    return {**room_out(r, user), "can_manage": _is_manager(r, user)}


class AttendanceIn(BaseModel):
    user_id: str
    status: str  # attended | absent | registered


@router.post("/rooms/{room_id}/attendance")
def attendance(room_id: str, body: AttendanceIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    r = _get(db, room_id)
    if not _is_manager(r, user):
        raise HTTPException(403, "Hanya penyelenggara yang dapat mengisi absensi")
    if body.status not in ("attended", "absent", "registered"):
        raise HTTPException(400, "Status absensi tidak valid")
    if r.start_at > now():
        raise HTTPException(400, "Absensi baru bisa diisi setelah kelas dimulai")
    p = next((p for p in r.participants if p.user_id == body.user_id), None)
    if not p:
        raise HTTPException(404, "Peserta tidak ada di kelas ini")
    mark_attendance(db, r, p, body.status, user.id)
    db.commit()
    return {"ok": True, "status": p.status}


@router.get("/rooms/{room_id}/ics")
def room_ics(room_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    r = _get(db, room_id)
    where = r.meeting_url if r.mode == ONLINE else r.location
    desc = f"{r.course.title}\n{r.notes}\n{where}\n{r.meeting_code}".strip()
    body = ics_for(r.id, r.title, r.start_at, r.end_at, where, desc)
    return Response(body, media_type="text/calendar",
                    headers={"Content-Disposition": f'attachment; filename="kelas-{r.id}.ics"'})
