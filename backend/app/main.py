import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .db import Base, SessionLocal, engine
from .models import User
from .routers import auth, certificates, courses, dashboard, enrollments, integrations, rooms, users

FRONTEND_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    # Database kosong → isi otomatis dengan data sampel (bisa dimatikan NOMINA_AUTO_SEED=0).
    if os.environ.get("NOMINA_AUTO_SEED", "1") == "1":
        with SessionLocal() as db:
            empty = db.query(User).first() is None
        if empty:
            from .seed import seed
            seed()
    yield


app = FastAPI(title="Nomina Academy LMS", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(","),
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

api = APIRouter(prefix="/api")


@api.get("/health")
def health():
    return {"status": "ok", "app": "Nomina Academy LMS"}


for r in (auth, users, courses, enrollments, rooms, dashboard, certificates, integrations):
    api.include_router(r.router)
app.include_router(api)

# Produksi: sajikan hasil build frontend dari origin yang sama.
if FRONTEND_DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        file = FRONTEND_DIST / path
        if path and file.is_file() and FRONTEND_DIST in file.resolve().parents:
            return FileResponse(file)
        return FileResponse(FRONTEND_DIST / "index.html")
