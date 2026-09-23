from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

from core.config import get_settings

settings = get_settings()

app = FastAPI(title="EvalOS Backend API", version="1.0.0")

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class DocumentResponse(BaseModel):
    id: str
    filename: str
    status: str
    pageCount: Optional[int] = None

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "EvalOS API"}

from api.v1.api import api_router

app.include_router(api_router, prefix=settings.API_V1_STR)


@app.on_event("startup")
def provision_golden_path_assessment():
    """
    Ensure the real golden-path assessment (Q01-Q06) exists in PostgreSQL on
    boot, so the examiner workspace always has a real assessment to load
    instead of showing "ASSESSMENT NOT AVAILABLE" on a fresh database. This
    writes through the normal DB session (see core/seed_data.py) -- nothing
    is fabricated at request time.
    """
    import logging
    from core.database import SessionLocal
    from core.seed_data import ensure_golden_path_assessment

    logger = logging.getLogger(__name__)

    if settings.EVALOS_LITE:
        # Lite mode uses SQLite, where the Alembic migrations (ALTER ... ADD CONSTRAINT) can't run;
        # create the same tables directly from the models. Never used with Postgres.
        from core.database import engine
        from models import Base
        Base.metadata.create_all(bind=engine)
        logger.info("EVALOS_LITE: tables created from models")

    db = SessionLocal()
    try:
        assessment = ensure_golden_path_assessment(db)
        logger.info(f"Golden-path assessment ready: {assessment.title} ({assessment.id})")
    except Exception as e:
        # Don't crash the API if the DB isn't reachable yet at boot; the
        # /api/v1/assessments/active endpoint will honestly report
        # UNAVAILABLE until this succeeds (e.g. on next restart or via
        # `python seed.py` once the DB is up).
        logger.error(f"Could not provision golden-path assessment on startup: {e}")
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Free / lite deployment: serve the built frontend from the same origin, so a single
# container gives one public URL and the browser needs no separate API host (no CORS,
# no VITE_API_URL juggling). Registered LAST so /api/v1, /health and /docs win.
# Only active when FRONTEND_DIST_DIR points at an existing build.
# ---------------------------------------------------------------------------
import os as _os
if settings.FRONTEND_DIST_DIR and _os.path.isdir(settings.FRONTEND_DIST_DIR):
    from fastapi.staticfiles import StaticFiles
    app.mount("/", StaticFiles(directory=settings.FRONTEND_DIST_DIR, html=True), name="frontend")
