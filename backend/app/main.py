import json
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from app.api.routes import router as api_router
from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from app.models.alert import SecurityAlert
from app.services.normalizer import parse_csv_content
from app.services.triage_pipeline import (
    DEFAULT_WORKSPACE_ID,
    SECONDARY_WORKSPACE_ID,
    ensure_default_workspaces,
    process_batch_alerts,
)

FRONTEND_DIST_DIR = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"


def seed_initial_data_if_empty():
    db = SessionLocal()
    try:
        ensure_default_workspaces(db)
        ws1_count = (
            db.query(SecurityAlert)
            .filter(SecurityAlert.workspace_id == DEFAULT_WORKSPACE_ID)
            .count()
        )
        if ws1_count == 0:
            records = []
            wazuh_path = settings.DATASETS_DIR / "sample_wazuh_alerts.json"
            csv_path = settings.DATASETS_DIR / "sample_security_logs.csv"
            if wazuh_path.exists():
                records.extend(json.loads(wazuh_path.read_text(encoding="utf-8")))
            if csv_path.exists():
                records.extend(parse_csv_content(csv_path.read_bytes()))
            if records:
                process_batch_alerts(
                    db,
                    records,
                    workspace_id=DEFAULT_WORKSPACE_ID,
                    source_type="Standard Dataset",
                    filename="sample_wazuh_alerts.json + sample_security_logs.csv",
                )

        ws2_count = (
            db.query(SecurityAlert)
            .filter(SecurityAlert.workspace_id == SECONDARY_WORKSPACE_ID)
            .count()
        )
        if ws2_count == 0:
            csv_path = settings.DATASETS_DIR / "sample_security_logs.csv"
            if csv_path.exists():
                csv_records = parse_csv_content(csv_path.read_bytes())
                if csv_records:
                    process_batch_alerts(
                        db,
                        csv_records[:3],
                        workspace_id=SECONDARY_WORKSPACE_ID,
                        source_type="CSV Upload",
                        filename="testing_workspace_logs.csv",
                    )
    except Exception as exc:
        print(f"[SentinelAI] Seed warning: {exc}")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    seed_initial_data_if_empty()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "แพลตฟอร์มปัญญาประดิษฐ์สำหรับวิเคราะห์ คัดกรอง และจัดลำดับความสำคัญของการแจ้งเตือนภัยคุกคามทางไซเบอร์ "
        "(AI-Powered SOC Alert Triage and Threat Prioritization Platform)"
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "SentinelAI Backend",
        "version": settings.APP_VERSION,
        "ai_provider": settings.AI_PROVIDER,
        "ioc_mode": settings.IOC_MODE,
    }


@app.get("/app.bundle.js", include_in_schema=False)
def serve_frontend_bundle():
    bundle_path = FRONTEND_DIST_DIR / "app.bundle.js"
    if bundle_path.exists():
        return FileResponse(bundle_path, media_type="application/javascript")
    return {"detail": "Frontend bundle not built yet."}


@app.get("/", include_in_schema=False)
def serve_frontend_index():
    index_path = FRONTEND_DIST_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path, media_type="text/html")
    return {"message": "SentinelAI API is running. Visit /docs for Swagger UI."}
