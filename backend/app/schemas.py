from pydantic import BaseModel, ConfigDict, Field
from typing import Optional, List
from datetime import datetime

# --- Resource Schedule (Sleep Windows) Schemas ---
class ResourceScheduleBase(BaseModel):
    schedule_type: str = Field("ONCE", description="ONCE, DAILY, WEEKLY")
    start_time: Optional[datetime] = Field(None, description="Sleep window start datetime (UTC) for ONCE")
    end_time: Optional[datetime] = Field(None, description="Sleep window end datetime (UTC) for ONCE")
    time_start: Optional[str] = Field(None, description="Sleep window start time HH:MM (UTC)")
    time_end: Optional[str] = Field(None, description="Sleep window end time HH:MM (UTC)")
    days_of_week: Optional[str] = Field(None, description="Comma-separated weekdays 1-7 (1=Mon, 7=Sun)")

class ResourceScheduleCreate(ResourceScheduleBase):
    pass

class ResourceScheduleOut(ResourceScheduleBase):
    id: int
    resource_id: str
    
    model_config = ConfigDict(from_attributes=True)


# --- Resource Override Schemas ---
class ResourceOverrideBase(BaseModel):
    override_type: str = Field(..., description="START or STOP")

class ResourceOverrideCreate(ResourceOverrideBase):
    pass

class ResourceOverrideOut(ResourceOverrideBase):
    id: int
    resource_id: str
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


# --- Resource Schemas ---
class ResourceBase(BaseModel):
    id: str
    name: str
    type: str
    region: str
    custom_cost_per_hour: Optional[float] = None

class ResourceOut(ResourceBase):
    last_scanned_at: datetime
    schedules: List[ResourceScheduleOut] = []
    override: Optional[ResourceOverrideOut] = None
    
    # Dynamic fields populated at runtime (fetched from AWS API / aws.py)
    status: Optional[str] = None 
    cost_per_hour: Optional[float] = None
    tags: Optional[dict] = None

    model_config = ConfigDict(from_attributes=True)


# --- Action Log Schemas ---
class ActionLogOut(BaseModel):
    id: int
    resource_id: Optional[str] = None
    resource_name: Optional[str] = None
    action: str
    message: str
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)

