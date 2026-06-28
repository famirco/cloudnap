from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone

from backend.app.db import get_db
from backend.app.models import Resource, ResourceOverride, ResourceSchedule, ActionLog, Setting
from backend.app.schemas import ResourceOut, ResourceOverrideCreate, ResourceOverrideOut, ResourceScheduleCreate, ResourceScheduleOut, ActionLogOut, SettingItem, SettingsUpdate, IntegrationTestPayload, SetExpiryPayload
from backend.app.notifier import send_notifications
from backend.app.aws import list_resources, start_resource, stop_resource
from backend.app.routes.auth import verify_auth

router = APIRouter(prefix="/instances", dependencies=[Depends(verify_auth)], tags=["Instances"])

@router.get("", response_model=List[ResourceOut])
def get_instances(db: Session = Depends(get_db)):
    """
    Auto-discovers instances from AWS, syncs them to SQLite database,
    and returns a merged list of resources containing both AWS live states and DB mappings.
    """
    try:
        # 1. Fetch live resource states from AWS
        live_list = list_resources()
        live_ids = {item["id"] for item in live_list}
        
        # 2. Sync to DB
        # Add new or update existing
        for item in live_list:
            db_res = db.query(Resource).filter(Resource.id == item["id"]).first()
            if not db_res:
                db_res = Resource(
                    id=item["id"],
                    name=item["name"],
                    type=item["type"],
                    region=item["region"],
                    custom_cost_per_hour=None
                )
                db.add(db_res)
            else:
                db_res.name = item["name"]
                db_res.type = item["type"]
                db_res.region = item["region"]
        
        # Delete DB resources that are no longer present in AWS active scan
        db.query(Resource).filter(~Resource.id.in_(live_ids)).delete(synchronize_session=False)
        db.commit()
        
        # 3. Retrieve all resources from DB with eager loaded relationships
        db_resources = db.query(Resource).all()
        
        # 4. Map AWS live details to DB resources
        live_map = {item["id"]: item for item in live_list}
        results = []
        
        for res in db_resources:
            aws_info = live_map.get(res.id)
            if not aws_info:
                continue
                
            # Serialize model
            res_schema = ResourceOut.model_validate(res)
            
            # Inject live AWS states
            res_schema.status = aws_info["status"]
            res_schema.tags = aws_info["tags"]
            # Cost per hour can be customized in DB, else use default AWS type mapping
            res_schema.cost_per_hour = res.custom_cost_per_hour if res.custom_cost_per_hour is not None else aws_info["cost_per_hour"]
            
            results.append(res_schema)
            
        return results
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to scan and sync instances: {e}"
        )

def check_overlap(existing_schedules: List[ResourceSchedule], start_time: datetime, end_time: datetime):
    """
    Check if a new sleep window overlaps with any of the existing ones.
    Overlap condition: (start1 < end2 AND start2 < end1).
    """
    new_start = start_time.replace(tzinfo=None) if start_time.tzinfo else start_time
    new_end = end_time.replace(tzinfo=None) if end_time.tzinfo else end_time

    for sched in existing_schedules:
        ex_start = sched.start_time.replace(tzinfo=None) if sched.start_time.tzinfo else sched.start_time
        ex_end = sched.end_time.replace(tzinfo=None) if sched.end_time.tzinfo else sched.end_time
        if new_start < ex_end and ex_start < new_end:
            return f"Overlaps with existing sleep window from {ex_start.strftime('%Y-%m-%d %H:%M')} to {ex_end.strftime('%Y-%m-%d %H:%M')} UTC"
    return None

@router.post("/{instance_id}/schedules", response_model=ResourceScheduleOut, status_code=status.HTTP_201_CREATED)
def add_instance_active_window(instance_id: str, payload: ResourceScheduleCreate, db: Session = Depends(get_db)):
    """
    Add a sleep scheduling window to a resource.
    """
    res = db.query(Resource).filter(Resource.id == instance_id).first()
    if not res:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")
    
    if payload.schedule_type == "ONCE":
        if not payload.start_time or not payload.end_time:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="start_time and end_time are required for ONCE schedules.")
        
        # Strip timezone for storing in SQLite
        start_dt = payload.start_time.replace(tzinfo=None) if payload.start_time.tzinfo else payload.start_time
        end_dt = payload.end_time.replace(tzinfo=None) if payload.end_time.tzinfo else payload.end_time
        
        if end_dt <= start_dt:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="End time must be after start time."
            )

        # Validate overlap only with existing ONCE schedules
        once_schedules = [s for s in res.schedules if s.schedule_type == "ONCE"]
        overlap_error = check_overlap(once_schedules, start_dt, end_dt)
        if overlap_error:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Sleep window conflict: {overlap_error}."
            )
            
        sched = ResourceSchedule(
            resource_id=instance_id,
            schedule_type="ONCE",
            start_time=start_dt,
            end_time=end_dt
        )
        log_msg = f"User scheduled a sleep window from {start_dt.strftime('%Y-%m-%d %H:%M')} to {end_dt.strftime('%Y-%m-%d %H:%M')} UTC."
    
    elif payload.schedule_type in ("DAILY", "WEEKLY"):
        if not payload.time_start or not payload.time_end:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="time_start and time_end are required for recurring schedules.")
        
        import re
        time_pattern = re.compile(r"^\d{2}:\d{2}$")
        if not time_pattern.match(payload.time_start) or not time_pattern.match(payload.time_end):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Time fields must be in HH:MM format.")
            
        sh, sm = map(int, payload.time_start.split(":"))
        eh, em = map(int, payload.time_end.split(":"))
        if sh < 0 or sh > 23 or sm < 0 or sm > 59 or eh < 0 or eh > 23 or em < 0 or em > 59:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid hours or minutes.")
            
        days = payload.days_of_week if payload.schedule_type == "WEEKLY" else "1,2,3,4,5,6,7"
        if payload.schedule_type == "WEEKLY" and not days:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="days_of_week is required for WEEKLY schedules.")
            
        sched = ResourceSchedule(
            resource_id=instance_id,
            schedule_type=payload.schedule_type,
            time_start=payload.time_start,
            time_end=payload.time_end,
            days_of_week=days
        )
        log_msg = f"User scheduled a recurring {payload.schedule_type.lower()} sleep window from {payload.time_start} to {payload.time_end} UTC."
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid schedule type.")
        
    db.add(sched)
    
    # Log user action
    user_log = ActionLog(
        resource_id=instance_id,
        resource_name=res.name,
        action="SET_SCHEDULE",
        message=log_msg
    )
    db.add(user_log)
    
    db.commit()
    db.refresh(sched)
    send_notifications(db, log_msg)
    return sched

@router.delete("/{instance_id}/schedules/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_instance_active_window(instance_id: str, schedule_id: int, db: Session = Depends(get_db)):
    """
    Delete an active scheduling window from a resource.
    """
    sched = db.query(ResourceSchedule).filter(
        ResourceSchedule.id == schedule_id,
        ResourceSchedule.resource_id == instance_id
    ).first()
    
    if not sched:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active window schedule not found")
        
    res = db.query(Resource).filter(Resource.id == instance_id).first()
    res_name = res.name if res else instance_id
    
    if sched.schedule_type == "ONCE":
        log_msg = f"User deleted the sleep window scheduled from {sched.start_time.strftime('%Y-%m-%d %H:%M')} to {sched.end_time.strftime('%Y-%m-%d %H:%M')} UTC."
    else:
        log_msg = f"User deleted the recurring {sched.schedule_type.lower()} sleep window scheduled from {sched.time_start} to {sched.time_end} UTC."
        
    # Log user action
    user_log = ActionLog(
        resource_id=instance_id,
        resource_name=res_name,
        action="DELETE_SCHEDULE",
        message=log_msg
    )
    db.add(user_log)
    
    db.delete(sched)
    db.commit()
    send_notifications(db, log_msg)
    return

@router.post("/{instance_id}/override", response_model=ResourceOverrideOut)
def apply_instance_override(instance_id: str, payload: ResourceOverrideCreate, db: Session = Depends(get_db)):
    """
    Create or update a manual persistent override for a resource (START or STOP hold).
    Triggers AWS actions immediately.
    """
    res = db.query(Resource).filter(Resource.id == instance_id).first()
    if not res:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")
        
    # Check if override exists, if so update it
    override = db.query(ResourceOverride).filter(ResourceOverride.resource_id == instance_id).first()
    if not override:
        override = ResourceOverride(
            resource_id=instance_id,
            override_type=payload.override_type
        )
        db.add(override)
    else:
        override.override_type = payload.override_type
        
    # Log user action
    user_log = ActionLog(
        resource_id=instance_id,
        resource_name=res.name,
        action="APPLY_OVERRIDE",
        message=f"User applied a manual override to hold the resource state to {payload.override_type}."
    )
    db.add(user_log)
        
    db.commit()
    db.refresh(override)
    send_notifications(db, user_log.message)
    
    # Trigger AWS action immediately to improve user experience feedback
    if payload.override_type == "START":
        start_resource(res.id, res.type, res.region)
    elif payload.override_type == "STOP":
        stop_resource(res.id, res.type, res.region)
        
    return override

@router.delete("/{instance_id}/override", status_code=status.HTTP_204_NO_CONTENT)
def remove_instance_override(instance_id: str, db: Session = Depends(get_db)):
    """
    Remove an override from a resource. The scheduler will resume standard schedule checking on the next tick.
    """
    override = db.query(ResourceOverride).filter(ResourceOverride.resource_id == instance_id).first()
    if not override:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active override found for this instance")
        
    res = db.query(Resource).filter(Resource.id == instance_id).first()
    res_name = res.name if res else instance_id
    
    # Log user action
    user_log = ActionLog(
        resource_id=instance_id,
        resource_name=res_name,
        action="REMOVE_OVERRIDE",
        message="User removed the manual override, returning state control to the scheduler."
    )
    db.add(user_log)
    
    db.delete(override)
    db.commit()
    send_notifications(db, user_log.message)
    return


@router.get("/logs", response_model=List[ActionLogOut])
def get_action_logs(db: Session = Depends(get_db)):
    """
    Retrieve all audit/action logs sorted by timestamp descending.
    """
    return db.query(ActionLog).order_by(ActionLog.timestamp.desc()).all()


@router.get("/settings", response_model=List[SettingItem])
def get_settings(db: Session = Depends(get_db)):
    """
    Retrieve all settings.
    """
    return db.query(Setting).all()


@router.post("/settings", status_code=status.HTTP_200_OK)
def update_settings(payload: SettingsUpdate, db: Session = Depends(get_db)):
    """
    Create or update multiple settings.
    """
    for item in payload.settings:
        setting = db.query(Setting).filter(Setting.key == item.key).first()
        if not setting:
            setting = Setting(key=item.key, value=item.value)
            db.add(setting)
        else:
            setting.value = item.value
    db.commit()
    return {"message": "Settings updated successfully"}


@router.post("/settings/test", status_code=status.HTTP_200_OK)
def test_notification_connection(payload: IntegrationTestPayload):
    """
    Test sending a message to Slack or Telegram using user-provided config.
    """
    import httpx
    msg = "🔔 *CloudNap Connection Test*:\nThis is a test notification from your CloudNap Instance Scheduler. Connection successful!"
    
    if payload.integration_type == "slack":
        if not payload.slack_webhook_url:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Slack Webhook URL is required.")
        try:
            body = {"text": msg}
            if payload.slack_channel:
                body["channel"] = payload.slack_channel
            response = httpx.post(payload.slack_webhook_url, json=body, timeout=5.0)
            if response.status_code != 200:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Slack returned status {response.status_code}: {response.text}")
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Slack request failed: {str(e)}")
            
    elif payload.integration_type == "telegram":
        if not payload.telegram_bot_token or not payload.telegram_chat_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Telegram Bot Token and Chat ID are required.")
        try:
            url = f"https://api.telegram.org/bot{payload.telegram_bot_token}/sendMessage"
            body = {
                "chat_id": payload.telegram_chat_id,
                "text": msg,
                "parse_mode": "Markdown"
            }
            response = httpx.post(url, json=body, timeout=5.0)
            if response.status_code != 200:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Telegram returned status {response.status_code}: {response.text}")
        except Exception as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Telegram request failed: {str(e)}")
            
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid integration type.")
        
    return {"message": "Test notification sent successfully."}


@router.post("/{instance_id}/expiry", response_model=ResourceOut)
def set_instance_expiry(instance_id: str, payload: SetExpiryPayload, db: Session = Depends(get_db)):
    """
    Set or clear lease expiry datetime on a resource.
    """
    res = db.query(Resource).filter(Resource.id == instance_id).first()
    if not res:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")
        
    exp_dt = payload.expiry_date
    if exp_dt:
        # Strip timezone for storing in SQLite
        exp_dt = exp_dt.replace(tzinfo=None) if exp_dt.tzinfo else exp_dt
        res.expiry_date = exp_dt
        log_msg = f"User set lease expiry for resource {res.name} ({instance_id}) to {exp_dt.strftime('%Y-%m-%d %H:%M')} UTC."
        action = "SET_LEASE"
    else:
        res.expiry_date = None
        log_msg = f"User cleared lease expiry for resource {res.name} ({instance_id})."
        action = "CLEAR_LEASE"
        
    user_log = ActionLog(
        resource_id=instance_id,
        resource_name=res.name,
        action=action,
        message=log_msg
    )
    db.add(user_log)
    db.commit()
    db.refresh(res)
    
    send_notifications(db, log_msg)
    return res
