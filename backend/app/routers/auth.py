from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import COOKIE, SESSION_DAYS, current_user, make_token, verify_password
from ..db import get_db
from ..models import User
from ..services import user_out

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginIn(BaseModel):
    email: str
    password: str


@router.post("/login")
def login(body: LoginIn, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.strip().lower()))
    if not user or not user.is_active or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "Email atau kata sandi salah")
    response.set_cookie(COOKIE, make_token(user.id), httponly=True, samesite="lax", path="/",
                        max_age=SESSION_DAYS * 86400)
    return user_out(user)


@router.get("/me")
def me(user: User = Depends(current_user)):
    return user_out(user)


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE, path="/")
    return {"ok": True}
