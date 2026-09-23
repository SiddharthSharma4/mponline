from pydantic_settings import BaseSettings
from pydantic import ConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    PROJECT_NAME: str = "EvalOS Backend"
    API_V1_STR: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = "postgresql://evalos:evalos_password@localhost:5432/evalos_db"
    
    # Redis & Celery
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # MinIO / S3
    S3_ENDPOINT: str = "http://localhost:9000"
    S3_ACCESS_KEY: str = "evalos_admin"
    S3_SECRET_KEY: str = "evalos_password"
    S3_BUCKET: str = "evalos-documents"
    
    # Free / lite single-process mode (see DEPLOY_FREE.md). Off by default: the
    # Postgres + Redis + MinIO + Celery stack behaves exactly as before.
    EVALOS_LITE: bool = False
    STORAGE_BACKEND: str = "s3"            # "s3" (MinIO/S3) or "local" (filesystem)
    LOCAL_STORAGE_DIR: str = "./data/uploads"
    FRONTEND_DIST_DIR: str = ""            # if set and present, FastAPI serves the built frontend

    # Auth (Placeholder for Phase 21)
    SECRET_KEY: str = "super_secret_dev_key"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8

    model_config = ConfigDict(case_sensitive=True, env_file=".env")

@lru_cache()
def get_settings() -> Settings:
    return Settings()
