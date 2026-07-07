"""Hermes Switch Manager — FastAPI Application.

AI-powered network switch configuration management with:
- Multi-vendor SSH config backup
- AI chat assistant (Hermes agent) with tool calling
- IRIS-style workflow engine
- Containerlab topology integration
- Security auditing (CVE, ACL, AAA, compliance)
- Real-time device health metrics
- Immutable audit trail
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from config import settings
from database import init_db
from routers import switches, configs, chat, workflows, dashboard, security, containerlab, templates
from services.template_engine import seed_builtin_templates

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle: init DB on startup."""
    logger.info(f"Starting {settings.APP_NAME} v{settings.VERSION}")
    init_db()
    logger.info("Database tables created/verified")
    # Seed built-in config templates
    seed_builtin_templates()
    yield
    logger.info("Shutting down")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description="AI-powered network switch configuration management",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(switches.router)
app.include_router(configs.router)
app.include_router(chat.router)
app.include_router(workflows.router)
app.include_router(dashboard.router)
app.include_router(security.router)
app.include_router(containerlab.router)
app.include_router(templates.router)


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "version": settings.VERSION,
    }


@app.get("/")
def root():
    """API root."""
    return {
        "app": settings.APP_NAME,
        "version": settings.VERSION,
        "docs": "/docs",
        "features": [
            "Switch Management",
            "Config Backup & Diff",
            "Hermes AI Chat Assistant",
            "Workflow Engine",
            "Security Auditing",
            "Containerlab Integration",
            "Device Health Monitoring",
            "Audit Trail",
        ]
    }
