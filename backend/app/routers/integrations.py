import hmac
import os
import re

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import learning_providers as lp
from ..auth import current_user, require_roles
from ..db import get_db, now
from ..models import (
    ACTIVE_STATUSES, ADMIN, COMPLETED, COURSERA, NOT_STARTED, SRC_SELF, SUGGESTED, UDEMY, Course, Enrollment, User,
)
from ..services import active_enrollment, complete_enrollment, enrollment_out, log, refresh_status

router = APIRouter(tags=["integrations"])
PROVIDERS = (UDEMY, COURSERA)


def _check(provider: str):
    if provider not in PROVIDERS:
        raise HTTPException(404, "Platform tidak dikenal")


@router.get("/integrations/learning")
def learning_status(user: User = Depends(current_user), db: Session = Depends(get_db)):
    st = lp.status()
    for p in PROVIDERS:
        st[p]["courses"] = len(db.scalars(select(Course.id).where(Course.provider == p)).all())
    return st


class CatalogSyncIn(BaseModel):
    publish: bool = True


@router.post("/integrations/learning/{provider}/sync-catalog")
def sync_catalog(provider: str, body: CatalogSyncIn, admin: User = Depends(require_roles(ADMIN)),
                 db: Session = Depends(get_db)):
    """Impor/perbarui katalog platform ke katalog Nomina (kunci: provider + external_id)."""
    _check(provider)
    try:
        items = lp.fetch_catalog(provider)
    except lp.ProviderError as ex:
        raise HTTPException(502, str(ex))
    return {"provider": provider, "mode": lp.mode(provider), **upsert_catalog(db, provider, items, body.publish, admin)}


def upsert_catalog(db: Session, provider: str, items: list[dict], publish: bool, admin: User | None) -> dict:
    created = updated = 0
    prefix = "UDM" if provider == UDEMY else "CRS"
    for it in items:
        c = db.scalar(select(Course).where(Course.provider == provider, Course.external_id == it["external_id"]))
        fields = {k: it[k] for k in ("title", "summary", "description", "category", "duration_hours", "level",
                                     "instructor", "skills", "badge_name", "cover_color", "external_url")}
        if c:
            for k, v in fields.items():
                setattr(c, k, v)
            updated += 1
        else:
            code = it["external_id"] if it["external_id"].startswith(prefix) else f"{prefix}-{it['external_id']}"
            db.add(Course(code=code[:30], provider=provider, external_id=it["external_id"], delivery_mode="online",
                          has_certificate=False, is_published=publish, created_by_id=admin.id if admin else None,
                          **fields))
            created += 1
    db.commit()
    return {"created": created, "updated": updated}


def apply_external(db: Session, user: User, course: Course, progress: int, completed: bool,
                   completed_at=None, last_activity=None, certificate_url: str = "", actor_id: str | None = None):
    """Terapkan status dari platform. Jam baru masuk saat completed (durasi resmi course)."""
    e = active_enrollment(db, user.id, course.id)
    if not e:
        done = db.scalar(select(Enrollment).where(Enrollment.user_id == user.id, Enrollment.course_id == course.id,
                                                  Enrollment.status == COMPLETED))
        if done:
            return done  # sudah dihitung — jangan dobel
        e = Enrollment(user_id=user.id, course_id=course.id, source=SRC_SELF, status=NOT_STARTED)
        db.add(e)
        log(db, user.id, "enrolled", f"Mulai course \"{course.title}\" langsung di {lp.LABEL[course.provider]}",
            actor_id, course.id)
    if e.status == SUGGESTED:
        e.status = NOT_STARTED
    before = e.external_progress
    e.external_progress = max(0, min(100, int(progress)))
    e.external_last_activity = last_activity or e.external_last_activity or now()
    e.external_synced_at = now()
    if certificate_url:
        e.external_certificate_url = certificate_url
    if e.external_progress != before and not completed:
        log(db, user.id, "external_progress",
            f"Progres {lp.LABEL[course.provider]} \"{course.title}\": {e.external_progress}% (belum dihitung jam)",
            actor_id, course.id, last_activity)
    if completed and not e.external_completed:
        e.external_completed = True
        e.external_progress = 100
        db.flush()
        if e.status in ACTIVE_STATUSES:
            # Selesai di platform → jam penuh sesuai durasi resmi, badge terbit.
            complete_enrollment(db, e, at=completed_at, actor_id=actor_id)
    else:
        db.flush()
        refresh_status(db, e, actor_id)
    return e


@router.post("/integrations/learning/sync-progress")
def sync_progress(admin: User = Depends(require_roles(ADMIN)), db: Session = Depends(get_db)):
    result = {}
    for p in PROVIDERS:
        try:
            rows = lp.fetch_progress(p)
        except lp.ProviderError as ex:
            result[p] = {"error": str(ex)}
            continue
        if rows is None:
            result[p] = {"mode": "sample", "applied": 0,
                         "note": "Mode contoh: progres disimulasikan peserta dari halaman belajar."}
            continue
        applied = skipped = 0
        for r in rows:
            u = db.scalar(select(User).where(User.email == r["email"].lower()))
            c = db.scalar(select(Course).where(Course.provider == p, Course.external_id == r["external_id"]))
            if not u or not c:
                skipped += 1
                continue
            apply_external(db, u, c, r["progress"], r["completed"], lp.parse_dt(r["completed_at"]),
                           lp.parse_dt(r["last_activity"]), r.get("certificate_url", ""), admin.id)
            applied += 1
        db.commit()
        result[p] = {"mode": "api", "applied": applied, "skipped": skipped}
    return result


class SimIn(BaseModel):
    progress: int | None = Field(default=None, ge=0, le=100)
    complete: bool = False


@router.post("/enrollments/{enrollment_id}/external-sim")
def simulate(enrollment_id: str, body: SimIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Mode contoh saja: mensimulasikan aktivitas peserta di Udemy/Coursera."""
    e = db.get(Enrollment, enrollment_id)
    if not e:
        raise HTTPException(404, "Data pelatihan tidak ditemukan")
    if e.user_id != user.id and user.role != ADMIN:
        raise HTTPException(403, "Hanya peserta yang dapat mensimulasikan progresnya")
    if e.course.provider not in PROVIDERS:
        raise HTTPException(400, "Bukan course Udemy/Coursera")
    if lp.mode(e.course.provider) != "sample":
        raise HTTPException(400, "Integrasi API aktif — progres hanya dari platform")
    if e.status not in ACTIVE_STATUSES:
        raise HTTPException(400, "Course belum aktif atau sudah selesai")
    progress = 100 if body.complete else (body.progress if body.progress is not None else e.external_progress)
    cert = f"{e.course.external_url}#sertifikat-contoh" if body.complete else ""
    e = apply_external(db, e.user, e.course, progress, body.complete, last_activity=now(), certificate_url=cert,
                       actor_id=user.id)
    db.commit()
    return enrollment_out(e)


@router.post("/integrations/udemy/xapi")
def udemy_xapi(statement: dict, x_nomina_webhook_secret: str = Header(default=""), db: Session = Depends(get_db)):
    """Webhook xAPI Udemy Business (real-time). Diamankan dengan shared secret di header."""
    secret = os.environ.get("UDEMY_XAPI_SECRET", "")
    if not secret or not hmac.compare_digest(secret, x_nomina_webhook_secret):
        raise HTTPException(401, "Secret webhook tidak valid")
    stmts = statement.get("statements") if isinstance(statement.get("statements"), list) else [statement]
    applied = 0
    for st in stmts:
        email = str((st.get("actor") or {}).get("mbox", "")).removeprefix("mailto:").lower()
        verb = str((st.get("verb") or {}).get("id", ""))
        m = re.search(r"course[s]?/([\w-]+)", str((st.get("object") or {}).get("id", "")))
        u = db.scalar(select(User).where(User.email == email)) if email else None
        c = db.scalar(select(Course).where(Course.provider == UDEMY, Course.external_id == m.group(1))) if m else None
        if not u or not c:
            continue
        scaled = ((st.get("result") or {}).get("score") or {}).get("scaled")
        done = verb.endswith("/completed")
        pct = 100 if done else int(round(float(scaled) * 100)) if scaled is not None else 0
        e = active_enrollment(db, u.id, c.id)
        apply_external(db, u, c, max(pct, e.external_progress if e else 0), done,
                       lp.parse_dt(st.get("timestamp")), lp.parse_dt(st.get("timestamp")))
        applied += 1
    db.commit()
    return {"applied": applied}
