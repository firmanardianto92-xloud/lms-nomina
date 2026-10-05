import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .db import get_db
from .models import ADMIN, COUNSELOR, User

SECRET = os.environ.get("NOMINA_SECRET", "dev-secret-nomina-ganti-sebelum-production")
COOKIE = "nomina_session"
SESSION_DAYS = 7


def hash_password(password: str, rounds: int = 12) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds)).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except ValueError:
        return False


def make_token(user_id: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)
    return jwt.encode({"sub": user_id, "exp": exp}, SECRET, algorithm="HS256")


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(COOKIE)
    if not token:
        raise HTTPException(401, "Belum masuk")
    try:
        user_id = jwt.decode(token, SECRET, algorithms=["HS256"])["sub"]
    except jwt.PyJWTError:
        raise HTTPException(401, "Sesi tidak valid")
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(401, "Sesi tidak valid")
    return user


def require_roles(*roles: str):
    def dep(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(403, "Anda tidak memiliki akses untuk aksi ini")
        return user

    return dep


def can_view_user(viewer: User, target: User) -> bool:
    """Admin melihat semua; counselor melihat dirinya + counselee binaannya; counselee hanya dirinya."""
    if viewer.role == ADMIN or viewer.id == target.id:
        return True
    return viewer.role == COUNSELOR and target.counselor_id == viewer.id


def ensure_can_view(viewer: User, target: User) -> None:
    if not can_view_user(viewer, target):
        raise HTTPException(403, "Anda tidak boleh melihat data pengguna ini")
