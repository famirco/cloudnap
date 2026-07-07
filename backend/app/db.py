from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from backend.app.config import settings

# SQLite configuration
# check_same_thread=False is required for SQLite in multithreaded environments like FastAPI
DATABASE_URL = settings.DATABASE_URL
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)

if DATABASE_URL.startswith("sqlite"):
    from sqlalchemy import event
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()

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
    
    # 0. Migrate resources
    if "resources" in inspector.get_table_names():
        columns = [c["name"] for c in inspector.get_columns("resources")]
        if "expiry_date" not in columns or "total_dollars_saved" not in columns or "aws_account_id" not in columns or "status" not in columns or "tags_json" not in columns:
            try:
                from backend.app.models import Resource, ResourceSchedule, ResourceOverride
                ResourceOverride.__table__.drop(bind=engine, checkfirst=True)
                ResourceSchedule.__table__.drop(bind=engine, checkfirst=True)
                Resource.__table__.drop(bind=engine)
                print("Old resources table dropped for schema upgrade.")
            except Exception as e:
                print(f"Failed to drop old resources table: {e}")

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
    
    # Seed default mock accounts if MOCK_AWS is active
    if settings.MOCK_AWS:
        db = SessionLocal()
        try:
            from backend.app.models import AWSAccount
            if db.query(AWSAccount).count() == 0:
                acc1 = AWSAccount(id=1, name="Mock Staging Account", role_arn="arn:aws:iam::111111111111:role/CloudNapStagingRole", is_active=True)
                acc2 = AWSAccount(id=2, name="Mock Production Account", role_arn="arn:aws:iam::222222222222:role/CloudNapProductionRole", is_active=True)
                db.add(acc1)
                db.add(acc2)
                db.commit()
                print("Default mock accounts seeded successfully.")
        except Exception as e:
            print(f"Failed to seed mock accounts: {e}")
        finally:
            db.close()
