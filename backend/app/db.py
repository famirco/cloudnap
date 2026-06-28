from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from backend.app.config import settings

# SQLite configuration
# check_same_thread=False is required for SQLite in multithreaded environments like FastAPI
DATABASE_URL = settings.DATABASE_URL
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """
    FastAPI dependency that yields a database session and closes it after the request.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """
    Create all tables defined by SQLAlchemy models.
    Automatically handles schema upgrades/migrations for resource_overrides and resource_schedules.
    """
    from sqlalchemy import inspect
    inspector = inspect(engine)
    
    # 1. Migrate resource_overrides
    if "resource_overrides" in inspector.get_table_names():
        columns = [c["name"] for c in inspector.get_columns("resource_overrides")]
        if "expire_at" in columns:
            try:
                from backend.app.models import ResourceOverride
                ResourceOverride.__table__.drop(bind=engine)
                print("Old resource_overrides table dropped for schema upgrade.")
            except Exception as e:
                print(f"Failed to drop old resource_overrides table: {e}")
                
    # 2. Migrate resource_schedules
    if "resource_schedules" in inspector.get_table_names():
        columns = [c["name"] for c in inspector.get_columns("resource_schedules")]
        if "days" in columns or "start_day" in columns or "schedule_type" not in columns:
            try:
                from backend.app.models import ResourceSchedule
                ResourceSchedule.__table__.drop(bind=engine)
                print("Old resource_schedules table dropped for schema upgrade.")
            except Exception as e:
                print(f"Failed to drop old resource_schedules table: {e}")
                
    Base.metadata.create_all(bind=engine)
