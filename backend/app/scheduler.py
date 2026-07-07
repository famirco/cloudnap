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
        # 1. Fetch live status of all AWS resources across all accounts
        from backend.app.models import AWSAccount
        accounts = db.query(AWSAccount).filter(AWSAccount.is_active == True).all()
        
        live_resources = []
        # Scan default host
        try:
            live_resources.extend(list_resources(account=None))
        except Exception as e:
            logger.error(f"Error scanning resources for default host: {e}")
            
        # Scan each active registered account
        for acc in accounts:
            try:
                live_resources.extend(list_resources(account=acc))
            except Exception as e:
                logger.error(f"Error scanning resources for account {acc.name}: {e}")

        live_status_map = {r["id"]: r["status"] for r in live_resources}
        live_cost_map = {r["id"]: r.get("cost_per_hour", 0.0) for r in live_resources}
        
        # 2. Fetch all managed resources from DB
        db_resources = db.query(Resource).all()
        now = utc_now()
        current_weekday = now.isoweekday() # 1=Monday, 7=Sunday
        current_time_str = now.strftime("%H:%M") # "HH:MM"
        
        import json
        live_items_map = {r["id"]: r for r in live_resources}
        
        for resource in db_resources:
            resource_id = resource.id
            
            # Check if this resource exists in the active AWS scan list
            if resource_id not in live_status_map:
                if resource.status != "offline":
                    resource.status = "offline"
                    db.add(resource)
                logger.warning(f"Resource {resource_id} not found in active AWS scan.")
                continue
                
            # Update DB cache with latest live status, type, cost, tags
            live_item = live_items_map[resource_id]
            resource.status = live_item.get("status", "unknown")
            resource.instance_type = live_item.get("instance_type", "unknown")
            resource.tags_json = json.dumps(live_item.get("tags", {}))
            resource.cost_per_hour = live_item.get("cost_per_hour", 0.05)
            db.add(resource)
            
            current_status = live_status_map[resource_id]
            
            # If the resource has no sleep schedules, no manual overrides, and no lease expiry, skip managing it
            if not resource.schedules and not resource.override and not resource.expiry_date:
                continue
                
            # Phase A: Calculate target state from sleep windows (default: running)
            target_state = "running"
            now_naive = now.replace(tzinfo=None) if now.tzinfo else now
            
            # Check lease expiry first (forces target_state to stopped)
            is_lease_expired = False
            if resource.expiry_date:
                r_exp = resource.expiry_date.replace(tzinfo=None) if resource.expiry_date.tzinfo else resource.expiry_date
                if now_naive >= r_exp:
                    target_state = "stopped"
                    is_lease_expired = True

            if not is_lease_expired:
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
            if override and not is_lease_expired:
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
                    start_resource(resource_id, resource.type, resource.region, account=resource.aws_account)
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
                    stop_resource(resource_id, resource.type, resource.region, account=resource.aws_account)
                    
                    msg = f"System automatically stopped resource {resource.name} ({resource_id}) because it is inside sleep window."
                    if is_lease_expired:
                        msg = f"Lease for resource {resource.name} ({resource_id}) expired on {resource.expiry_date.strftime('%Y-%m-%d %H:%M')} UTC. System automatically stopped it."
                        
                    sys_log = ActionLog(
                        resource_id=resource_id,
                        resource_name=resource.name,
                        action="SYSTEM_STOP",
                        message=msg
                    )
                    db.add(sys_log)
                    db.commit()
                    send_notifications(db, sys_log.message)

            # 3. Accumulate real-time cost savings if currently stopped
            if current_status == "stopped":
                cost_rate = resource.custom_cost_per_hour
                if cost_rate is None:
                    cost_rate = live_cost_map.get(resource_id, 0.0)
                
                # Default mock fallback to keep dashboard numbers active
                if cost_rate == 0.0:
                    cost_rate = 0.05
                    
                resource.total_hours_saved += 1.0 / 60.0
                resource.total_dollars_saved += (1.0 / 60.0) * cost_rate
                db.commit()

                        
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
