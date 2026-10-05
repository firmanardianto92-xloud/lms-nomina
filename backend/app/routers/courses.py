import re
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..auth import current_user, require_roles
from ..db import UPLOAD_DIR, get_db
from ..models import ADMIN, MODES, PROVIDERS, Course, CourseMaterial, Enrollment, MaterialProgress, User
from ..services import course_out, material_out

router = APIRouter(tags=["courses"])

MAX_UPLOAD_MB = 50
ALLOWED_EXT = {".pdf", ".ppt", ".pptx", ".doc", ".docx", ".xls", ".xlsx", ".mp4", ".webm", ".mp3",
               ".png", ".jpg", ".jpeg", ".zip", ".txt"}


@router.get("/courses")
def list_courses(mode: str | None = None, category: str | None = None, q: str | None = None,
                 provider: str | None = None, include_drafts: bool = False,
                 user: User = Depends(current_user), db: Session = Depends(get_db)):
    stmt = select(Course).order_by(Course.category, Course.title)
    if not (include_drafts and user.role == ADMIN):
        stmt = stmt.where(Course.is_published.is_(True))
    if mode:
        stmt = stmt.where(Course.delivery_mode == mode)
    if category:
        stmt = stmt.where(Course.category == category)
    if provider:
        stmt = stmt.where(Course.provider == provider)
    if q:
        stmt = stmt.where(Course.title.ilike(f"%{q}%") | Course.code.ilike(f"%{q}%"))
    courses = db.scalars(stmt).all()
    counts = dict(db.execute(select(Enrollment.course_id, func.count()).group_by(Enrollment.course_id)).all())
    return [{**course_out(c), "enrollment_count": counts.get(c.id, 0)} for c in courses]


@router.get("/courses/{course_id}")
def get_course(course_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    c = db.get(Course, course_id)
    if not c or (not c.is_published and user.role != ADMIN):
        raise HTTPException(404, "Course tidak ditemukan")
    return course_out(c, full=True)


class MaterialIn(BaseModel):
    title: str
    kind: str = "article"
    url: str = ""
    content: str = ""
    duration_minutes: int = Field(default=15, ge=0, le=1440)


class CourseIn(BaseModel):
    code: str
    title: str
    summary: str = ""
    description: str = ""
    category: str = "Umum"
    delivery_mode: str = "online"
    duration_hours: float = Field(gt=0, le=500)
    level: str = "Dasar"
    instructor: str = ""
    skills: list[str] = []
    badge_name: str = ""
    has_certificate: bool = True
    is_mandatory: bool = False
    is_published: bool = True
    cover_color: str = "#0A84FF"
    provider: str = "internal"
    external_id: str | None = None
    external_url: str = ""
    materials: list[MaterialIn] | None = None


def _validate(body: CourseIn):
    if body.delivery_mode not in MODES:
        raise HTTPException(400, "Mode harus online, offline, atau blended")
    if body.provider not in PROVIDERS:
        raise HTTPException(400, "Sumber course harus internal, udemy, atau coursera")
    if body.provider != "internal" and not body.external_url.strip():
        raise HTTPException(400, "Course Udemy/Coursera wajib punya link course")


@router.post("/courses", status_code=201)
def create_course(body: CourseIn, admin: User = Depends(require_roles(ADMIN)), db: Session = Depends(get_db)):
    _validate(body)
    if db.scalar(select(Course).where(Course.code == body.code)):
        raise HTTPException(409, "Kode course sudah dipakai")
    data = body.model_dump(exclude={"materials"})
    c = Course(**data, created_by_id=admin.id)
    for i, m in enumerate(body.materials or []):
        c.materials.append(CourseMaterial(position=i, **m.model_dump()))
    db.add(c)
    db.commit()
    return course_out(c, full=True)


@router.put("/courses/{course_id}")
def update_course(course_id: str, body: CourseIn, admin: User = Depends(require_roles(ADMIN)),
                  db: Session = Depends(get_db)):
    _validate(body)
    c = db.get(Course, course_id)
    if not c:
        raise HTTPException(404, "Course tidak ditemukan")
    if db.scalar(select(Course).where(Course.code == body.code, Course.id != course_id)):
        raise HTTPException(409, "Kode course sudah dipakai")
    for k, v in body.model_dump(exclude={"materials"}).items():
        setattr(c, k, v)
    db.commit()
    return course_out(c, full=True)


@router.delete("/courses/{course_id}")
def delete_course(course_id: str, admin: User = Depends(require_roles(ADMIN)), db: Session = Depends(get_db)):
    c = db.get(Course, course_id)
    if not c:
        raise HTTPException(404, "Course tidak ditemukan")
    used = db.scalar(select(func.count()).select_from(Enrollment).where(Enrollment.course_id == course_id))
    if used:
        # Ada riwayat peserta → jangan hapus jejak rekam, cukup arsipkan.
        c.is_published = False
        db.commit()
        return {"ok": True, "archived": True}
    db.delete(c)
    db.commit()
    return {"ok": True, "archived": False}


@router.post("/courses/{course_id}/materials", status_code=201)
def add_material(course_id: str, body: MaterialIn, admin: User = Depends(require_roles(ADMIN)),
                 db: Session = Depends(get_db)):
    c = db.get(Course, course_id)
    if not c:
        raise HTTPException(404, "Course tidak ditemukan")
    m = CourseMaterial(course_id=c.id, position=len(c.materials), **body.model_dump())
    db.add(m)
    db.commit()
    return material_out(m)


@router.put("/materials/{material_id}")
def update_material(material_id: str, body: MaterialIn, admin: User = Depends(require_roles(ADMIN)),
                    db: Session = Depends(get_db)):
    m = db.get(CourseMaterial, material_id)
    if not m:
        raise HTTPException(404, "Materi tidak ditemukan")
    for k, v in body.model_dump().items():
        setattr(m, k, v)
    db.commit()
    return material_out(m)


@router.delete("/materials/{material_id}")
def delete_material(material_id: str, admin: User = Depends(require_roles(ADMIN)), db: Session = Depends(get_db)):
    m = db.get(CourseMaterial, material_id)
    if not m:
        raise HTTPException(404, "Materi tidak ditemukan")
    for p in db.scalars(select(MaterialProgress).where(MaterialProgress.material_id == material_id)):
        db.delete(p)
    db.delete(m)
    db.commit()
    return {"ok": True}


@router.post("/uploads", status_code=201)
async def upload(file: UploadFile = File(...), admin: User = Depends(require_roles(ADMIN))):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(400, f"Tipe file {ext or '?'} tidak diizinkan")
    data = await file.read()
    if len(data) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(413, f"Ukuran maksimal {MAX_UPLOAD_MB} MB")
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    stem = re.sub(r"[^A-Za-z0-9_-]+", "-", Path(file.filename).stem)[:60].strip("-") or "file"
    name = f"{uuid.uuid4().hex[:8]}-{stem}{ext}"
    (UPLOAD_DIR / name).write_bytes(data)
    return {"url": f"/api/files/{name}", "filename": file.filename, "size": len(data)}


@router.get("/files/{name}")
def get_file(name: str, user: User = Depends(current_user)):
    path = (UPLOAD_DIR / name).resolve()
    if path.parent != UPLOAD_DIR.resolve() or not path.is_file():
        raise HTTPException(404, "File tidak ditemukan")
    return FileResponse(path)
