from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from core.config import get_settings

settings = get_settings()

if settings.DATABASE_URL.startswith("sqlite"):
    # Lite mode: models declare postgresql.UUID; let SQLite store it as CHAR(32).
    from sqlalchemy.ext.compiler import compiles
    from sqlalchemy.dialects.postgresql import UUID as _PG_UUID

    @compiles(_PG_UUID, "sqlite")
    def _render_uuid_for_sqlite(type_, compiler, **kw):
        return "CHAR(32)"

_connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    settings.DATABASE_URL, 
    pool_pre_ping=True,
    connect_args=_connect_args,
    # In production, we'd adjust pool size and max overflow
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
