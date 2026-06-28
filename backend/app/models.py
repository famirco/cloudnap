from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from backend.app.db import Base

class Resource(Base):
    __tablename__ = "resources"

    # AWS Resource ID (e.g. EC2 instance ID 'i-xxx' or RDS DB Instance ID 'db-xxx')
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)       # "ec2", "rds", or "ecs"
    region = Column(String, nullable=False)
    
    # Custom savings calculation override
    custom_cost_per_hour = Column(Float, nullable=True)
    
    last_scanned_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    # A resource can have multiple scheduled active windows (one-to-many)
    schedules = relationship("ResourceSchedule", back_populates="resource", cascade="all, delete-orphan")
    # A resource can have at most one active override, so it's a 1-to-1 mapping
    override = relationship("ResourceOverride", back_populates="resource", uselist=False, cascade="all, delete-orphan")


class ResourceSchedule(Base):
    __tablename__ = "resource_schedules"

    id = Column(Integer, primary_key=True, index=True)
    resource_id = Column(String, ForeignKey("resources.id", ondelete="CASCADE"), nullable=False)
    
    # One-time window columns
    start_time = Column(DateTime, nullable=True) # Sleep window start datetime (UTC)
    end_time = Column(DateTime, nullable=True)   # Sleep window end datetime (UTC)

    # Recurring window columns
    schedule_type = Column(String, default="ONCE", nullable=False) # "ONCE", "DAILY", "WEEKLY"
    time_start = Column(String, nullable=True)   # "HH:MM" (UTC)
    time_end = Column(String, nullable=True)     # "HH:MM" (UTC)
    days_of_week = Column(String, nullable=True) # "1,2,3,4,5,6,7" (1=Monday, 7=Sunday)

    # Relationships
    resource = relationship("Resource", back_populates="schedules")


class ResourceOverride(Base):
    __tablename__ = "resource_overrides"

    id = Column(Integer, primary_key=True, index=True)
    # Unique constraint ensures only one override exists per resource
    resource_id = Column(String, ForeignKey("resources.id", ondelete="CASCADE"), nullable=False, unique=True)
    
    override_type = Column(String, nullable=False)  # "START" or "STOP"
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    resource = relationship("Resource", back_populates="override")


class ActionLog(Base):
    __tablename__ = "action_logs"

    id = Column(Integer, primary_key=True, index=True)
    resource_id = Column(String, nullable=True, index=True)
    resource_name = Column(String, nullable=True, index=True)
    action = Column(String, nullable=False)  # e.g., "SET_SCHEDULE", "DELETE_SCHEDULE", "APPLY_OVERRIDE", "REMOVE_OVERRIDE", "SYSTEM_START", "SYSTEM_STOP"
    message = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)

