import os
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# Muat backend/.env bila ada (tanpa dependensi tambahan).
_env = Path(__file__).resolve().parent.parent / ".env"
if _env.is_file():
    for _line in _env.read_text().splitlines():
        if "=" in _line and not _line.lstrip().startswith("#"):
            _k, _v = _line.split("=", 1)
            if _v.strip():
                os.environ.setdefault(_k.strip(), _v.strip())

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = Path(os.environ.get("NOMINA_UPLOAD_DIR", BASE_DIR / "uploads"))
DATABASE_URL = os.environ.get("NOMINA_DB_URL", f"sqlite:///{BASE_DIR / 'nomina.db'}")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(engine, expire_on_commit=False)

TZ = ZoneInfo(os.environ.get("NOMINA_TZ", "Asia/Jakarta"))


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def now() -> datetime:
    """Current wall-clock time in WIB, stored naive (all datetimes in the DB are WIB)."""
    return datetime.now(TZ).replace(tzinfo=None, microsecond=0)


def today() -> date:
    return now().date()
