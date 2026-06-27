import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.app.db import init_db
from backend.app.scheduler import start_scheduler, stop_scheduler
from backend.app.routes import auth, instances

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cloudnap.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Handle app startup and shutdown lifecycles:
    - Create SQLite tables.
    - Start background job scheduler.
    """
    logger.info("Initializing SQLite database...")
    init_db()
    
    logger.info("Starting background scheduler...")
    start_scheduler()
    
    yield
    
    logger.info("Stopping background scheduler...")
    stop_scheduler()

app = FastAPI(
    title="CloudNap API",
    description="Backend API for managing AWS instance schedules and overrides",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Configuration
# React application usually runs on port 5173 during development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Can restrict this to settings or config if needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(auth.router, prefix="/api")
app.include_router(instances.router, prefix="/api")

# Static files and single page app routing fallback
# Checks if React frontend static build assets are present
frontend_dist_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend", "dist")

if os.path.exists(frontend_dist_path):
    logger.info(f"Mounting static files from: {frontend_dist_path}")
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist_path, "assets")), name="assets")
    
    @app.get("/{catchall:path}")
    async def serve_frontend(catchall: str):
        # Prevent static files fallback from hijacking API endpoints
        if catchall.startswith("api"):
            return None
        
        # Check if the requested file exists, otherwise return index.html for React Router
        file_path = os.path.join(frontend_dist_path, catchall)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
            
        return FileResponse(os.path.join(frontend_dist_path, "index.html"))
else:
    logger.warning(f"Frontend dist folder not found at {frontend_dist_path}. API only mode.")
    
    @app.get("/")
    def read_root():
        return {
            "message": "CloudNap API is running. Build frontend using 'npm run build' to serve UI statically."
        }
