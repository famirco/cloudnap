import logging
from datetime import datetime, timedelta, timezone
from apscheduler.schedulers.background import BackgroundScheduler

from backend.app.db import SessionLocal
from backend.app.models import Resource, ResourceSchedule, ResourceOverride, ActionLog
from backend.app.aws import list_resources, start_resource, stop_resource
from backend.app.notifier import send_notifications

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cloudnap.scheduler")

scheduler = BackgroundScheduler()

def utc_now() -> datetime:
    """
    Get current timezone-naive UTC datetime (ignoring TZ offsets for SQLite compatibility).
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)

def check_resources_job():
    """
    The background task that runs every minute to evaluate if the current time 
    is within any active window for each resource. Enforces target state.
    """
    logger.info("Executing background state-based check_resources_job...")
    db = SessionLocal()
    try:
        # 1. Fetch live status of all AWS resources
        live_resources = list_resources()
        live_status_map = {r["id"]: r["status"] for r in live_resources}
        
        # 2. Fetch all managed resources from DB
        db_resources = db.query(Resource).all()
        now = utc_now()
        current_weekday = now.isoweekday() # 1=Monday, 7=Sunday
        current_time_str = now.strftime("%H:%M") # "HH:MM"
        
        for resource in db_resources:
            resource_id = resource.id
            
            # Check if this resource exists in the active scan list
            if resource_id not in live_status_map:
                logger.warning(f"Resource {resource_id} not found in active AWS scan.")
                continue
                
            current_status = live_status_map[resource_id]
            
            # If the resource has no sleep schedules and no manual overrides, skip managing it
            if not resource.schedules and not resource.override:
                continue
                
            # Phase A: Calculate target state from sleep windows (default: running)
            target_state = "running"
            now_naive = now.replace(tzinfo=None) if now.tzinfo else now
            
            for sched in resource.schedules:
                if not sched.schedule_type or sched.schedule_type == "ONCE":
                    s_dt = sched.start_time.replace(tzinfo=None) if sched.start_time.tzinfo else sched.start_time
                    e_dt = sched.end_time.replace(tzinfo=None) if sched.end_time.tzinfo else sched.end_time
                    
                    # Inside sleep window -> target is stopped
                    if s_dt <= now_naive < e_dt:
                        target_state = "stopped"
                        break
                else:
                    # DAILY or WEEKLY
                    current_weekday = now.isoweekday() # 1=Monday, 7=Sunday
                    yesterday_weekday = 7 if current_weekday == 1 else current_weekday - 1
                    current_time_str = now.strftime("%H:%M")
                    
                    days_list = [int(d) for d in (sched.days_of_week or "").split(",") if d.strip().isdigit()]
                    t_start = sched.time_start
                    t_end = sched.time_end
                    
                    if t_start and t_end:
                        is_active = False
                        if t_start <= t_end:
                            # Same day window
                            if current_weekday in days_list and t_start <= current_time_str < t_end:
                                is_active = True
                        else:
                            # Midnight spanning window
                            if current_weekday in days_list and current_time_str >= t_start:
                                is_active = True
                            elif yesterday_weekday in days_list and current_time_str < t_end:
                                is_active = True
                                
                        if is_active:
                            target_state = "stopped"
                            break
            
            # Phase B: Evaluate active manual overrides
            override = resource.override
            if override:
                # Override is active - it dictates target state
                if override.override_type == "START":
                    target_state = "running"
                elif override.override_type == "STOP":
                    target_state = "stopped"
            
            # Phase C: Enforce target state
            if target_state == "running":
                # Start if currently stopped (ignore starting/stopping transitions)
                if current_status == "stopped":
                    logger.info(f"State evaluation - target is RUNNING: Starting resource {resource_id}")
                    start_resource(resource_id, resource.type, resource.region)
                    sys_log = ActionLog(
                        resource_id=resource_id,
                        resource_name=resource.name,
                        action="SYSTEM_START",
                        message=f"System automatically started resource {resource.name} ({resource_id}) because it is outside sleep window."
                    )
                    db.add(sys_log)
                    db.commit()
                    send_notifications(db, sys_log.message)
            elif target_state == "stopped":
                # Stop if currently running (ignore starting/stopping transitions)
                if current_status == "running":
                    logger.info(f"State evaluation - target is STOPPED: Stopping resource {resource_id}")
                    stop_resource(resource_id, resource.type, resource.region)
                    sys_log = ActionLog(
                        resource_id=resource_id,
                        resource_name=resource.name,
                        action="SYSTEM_STOP",
                        message=f"System automatically stopped resource {resource.name} ({resource_id}) because it is inside sleep window."
                    )
                    db.add(sys_log)
                    db.commit()
                    send_notifications(db, sys_log.message)
                        
    except Exception as e:
        logger.error(f"Error in check_resources_job: {e}")
    finally:
        db.close()

def start_scheduler():
    """
    Initialize and start the background scheduler.
    """
    if not scheduler.get_job("check_resources_job_id"):
        scheduler.add_job(
            check_resources_job,
            "interval",
            minutes=1,
            id="check_resources_job_id"
        )
    if not scheduler.running:
        scheduler.start()
        logger.info("Background scheduler started successfully.")

def stop_scheduler():
    """
    Shut down the background scheduler.
    """
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Background scheduler stopped.")
