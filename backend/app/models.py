import uuid
from datetime import date, datetime

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base, now


def new_id() -> str:
    return uuid.uuid4().hex[:12]


# Roles
ADMIN = "admin"
COUNSELOR = "counselor"
COUNSELEE = "counselee"
ROLES = (ADMIN, COUNSELOR, COUNSELEE)

# Delivery modes
ONLINE = "online"
OFFLINE = "offline"
BLENDED = "blended"
MODES = (ONLINE, OFFLINE, BLENDED)

# Enrollment status
SUGGESTED = "suggested"
NOT_STARTED = "not_started"
IN_PROGRESS = "in_progress"
COMPLETED = "completed"
DECLINED = "declined"
ACTIVE_STATUSES = (NOT_STARTED, IN_PROGRESS)

# Enrollment source
SRC_ASSIGNED = "assigned"   # wajib, ditugaskan counselor/admin
SRC_SUGGESTED = "suggested"  # rekomendasi counselor, perlu diterima
SRC_SELF = "self"           # daftar mandiri dari katalog

PLATFORMS = ("zoom", "teams", "gmeet", "other", "offline")


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(20), index=True)
    job_title: Mapped[str] = mapped_column(String(120), default="")
    department: Mapped[str] = mapped_column(String(120), default="")
    counselor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    annual_target_hours: Mapped[int] = mapped_column(Integer, default=40)
    joined_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

    counselor: Mapped["User | None"] = relationship(remote_side="User.id", foreign_keys=[counselor_id])


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    code: Mapped[str] = mapped_column(String(30), unique=True)
    title: Mapped[str] = mapped_column(String(200))
    summary: Mapped[str] = mapped_column(String(300), default="")
    description: Mapped[str] = mapped_column(Text, default="")
    category: Mapped[str] = mapped_column(String(80), default="Umum")
    delivery_mode: Mapped[str] = mapped_column(String(20), default=ONLINE)
    duration_hours: Mapped[float] = mapped_column(Float, default=1)
    level: Mapped[str] = mapped_column(String(30), default="Dasar")
    instructor: Mapped[str] = mapped_column(String(120), default="")
    skills: Mapped[list] = mapped_column(JSON, default=list)
    badge_name: Mapped[str] = mapped_column(String(120), default="")
    has_certificate: Mapped[bool] = mapped_column(Boolean, default=True)
    is_mandatory: Mapped[bool] = mapped_column(Boolean, default=False)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True)
    cover_color: Mapped[str] = mapped_column(String(20), default="#0A84FF")
    created_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

    materials: Mapped[list["CourseMaterial"]] = relationship(
        back_populates="course", order_by="CourseMaterial.position", cascade="all, delete-orphan"
    )


class CourseMaterial(Base):
    __tablename__ = "course_materials"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), index=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    title: Mapped[str] = mapped_column(String(200))
    kind: Mapped[str] = mapped_column(String(20), default="article")  # article|video|pdf|slide|link|file
    url: Mapped[str] = mapped_column(String(500), default="")
    content: Mapped[str] = mapped_column(Text, default="")
    duration_minutes: Mapped[int] = mapped_column(Integer, default=15)

    course: Mapped[Course] = relationship(back_populates="materials")


class Enrollment(Base):
    __tablename__ = "enrollments"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), index=True)
    source: Mapped[str] = mapped_column(String(20), default=SRC_SELF)
    assigned_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default=NOT_STARTED, index=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    note: Mapped[str] = mapped_column(String(500), default="")
    attended: Mapped[bool] = mapped_column(Boolean, default=False)
    hours_earned: Mapped[float] = mapped_column(Float, default=0)
    certificate_no: Mapped[str | None] = mapped_column(String(40), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    user: Mapped[User] = relationship(foreign_keys=[user_id])
    course: Mapped[Course] = relationship()
    assigned_by: Mapped[User | None] = relationship(foreign_keys=[assigned_by_id])
    progress: Mapped[list["MaterialProgress"]] = relationship(cascade="all, delete-orphan")


class MaterialProgress(Base):
    __tablename__ = "material_progress"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    enrollment_id: Mapped[str] = mapped_column(ForeignKey("enrollments.id"), index=True)
    material_id: Mapped[str] = mapped_column(ForeignKey("course_materials.id"))
    completed_at: Mapped[datetime] = mapped_column(DateTime, default=now)


class Room(Base):
    """Kelas/sesi pelatihan — online (Zoom/Teams/Meet) atau offline (ruang fisik)."""

    __tablename__ = "rooms"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    course_id: Mapped[str] = mapped_column(ForeignKey("courses.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    mode: Mapped[str] = mapped_column(String(20), default=ONLINE)  # online|offline
    platform: Mapped[str] = mapped_column(String(20), default="zoom")
    meeting_url: Mapped[str] = mapped_column(String(500), default="")
    meeting_code: Mapped[str] = mapped_column(String(120), default="")
    link_source: Mapped[str] = mapped_column(String(20), default="manual")  # api|manual|demo
    location: Mapped[str] = mapped_column(String(300), default="")
    start_at: Mapped[datetime] = mapped_column(DateTime)
    end_at: Mapped[datetime] = mapped_column(DateTime)
    capacity: Mapped[int] = mapped_column(Integer, default=30)
    facilitator_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_by_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now)

    course: Mapped[Course] = relationship()
    facilitator: Mapped[User | None] = relationship(foreign_keys=[facilitator_id])
    created_by: Mapped[User | None] = relationship(foreign_keys=[created_by_id])
    participants: Mapped[list["RoomParticipant"]] = relationship(cascade="all, delete-orphan")


class RoomParticipant(Base):
    __tablename__ = "room_participants"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    room_id: Mapped[str] = mapped_column(ForeignKey("rooms.id"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="registered")  # registered|attended|absent
    marked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    user: Mapped[User] = relationship()


class Activity(Base):
    """Jejak rekam (timeline) aktivitas pengguna."""

    __tablename__ = "activities"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    actor_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    kind: Mapped[str] = mapped_column(String(30))
    message: Mapped[str] = mapped_column(String(400))
    course_id: Mapped[str | None] = mapped_column(ForeignKey("courses.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now, index=True)
