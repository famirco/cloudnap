import boto3
from botocore.exceptions import ClientError
from typing import List, Dict, Any
from backend.app.config import settings

# In-memory mock data to allow local offline development and testing
MOCK_RESOURCES: Dict[str, Dict[str, Any]] = {
    "i-0123456789abcdef0": {
        "id": "i-0123456789abcdef0",
        "name": "dev-api-server",
        "type": "ec2",
        "instance_type": "t3.medium",
        "status": "running",
        "region": "us-east-1",
        "cost_per_hour": 0.0416,
        "tags": {"Name": "dev-api-server", "CloudNap:Schedule": "office-hours"}
    },
    "i-0abcdef1234567890": {
        "id": "i-0abcdef1234567890",
        "name": "staging-frontend",
        "type": "ec2",
        "instance_type": "t3.micro",
        "status": "stopped",
        "region": "us-east-1",
        "cost_per_hour": 0.0104,
        "tags": {"Name": "staging-frontend", "CloudNap:Schedule": "office-hours"}
    },
    "i-0987654321fedcba0": {
        "id": "i-0987654321fedcba0",
        "name": "prod-analytics-worker",
        "type": "ec2",
        "instance_type": "t3.large",
        "status": "running",
        "region": "us-west-2",
        "cost_per_hour": 0.0832,
        "tags": {"Name": "prod-analytics-worker"}
    },
    "db-dev-postgres": {
        "id": "db-dev-postgres",
        "name": "db-dev-postgres",
        "type": "rds",
        "instance_type": "db.t3.medium",
        "status": "running",
        "region": "us-east-1",
        "cost_per_hour": 0.068,
        "tags": {"CloudNap:Schedule": "office-hours"}
    },
    "db-staging-mysql": {
        "id": "db-staging-mysql",
        "name": "db-staging-mysql",
        "type": "rds",
        "instance_type": "db.t3.micro",
        "status": "stopped",
        "region": "us-west-2",
        "cost_per_hour": 0.017,
        "tags": {}
    }
}

# Cost mapping reference for basic estimation
EC2_COSTS = {
    "t3.nano": 0.0052,
    "t3.micro": 0.0104,
    "t3.small": 0.0208,
    "t3.medium": 0.0416,
    "t3.large": 0.0832,
    "t3.xlarge": 0.1664,
    "t3.2xlarge": 0.3328,
}

RDS_COSTS = {
    "db.t3.micro": 0.017,
    "db.t3.small": 0.034,
    "db.t3.medium": 0.068,
    "db.t3.large": 0.136,
}

def get_regions() -> List[str]:
    """
    Get regions to scan. Defaults to ALLOWED_REGIONS.
    If empty, tries to describe regions using EC2 client or defaults to standard regions.
    """
    if settings.ALLOWED_REGIONS:
        return settings.ALLOWED_REGIONS
    
    if settings.MOCK_AWS:
        return ["us-east-1", "us-west-2"]
    
    try:
        ec2 = boto3.client("ec2", region_name=settings.AWS_DEFAULT_REGION)
        response = ec2.describe_regions()
        return [r["RegionName"] for r in response["Regions"]]
    except Exception:
        # Fallback to common regions if describe_regions fails
        return ["us-east-1", "us-west-2", "eu-west-1"]

def get_ec2_cost(instance_type: str) -> float:
    return EC2_COSTS.get(instance_type, 0.05)

def get_rds_cost(db_class: str) -> float:
    return RDS_COSTS.get(db_class, 0.10)

def list_resources() -> List[Dict[str, Any]]:
    """
    Scan EC2 and RDS instances across target regions and return uniform representation.
    """
    if settings.MOCK_AWS:
        return list(MOCK_RESOURCES.values())
    
    resources = []
    regions = get_regions()
    
    for region in regions:
        # 1. EC2 Scan
        try:
            ec2 = boto3.client("ec2", region_name=region)
            paginator = ec2.get_paginator("describe_instances")
            for page in paginator.paginate():
                for reservation in page.get("Reservations", []):
                    for instance in reservation.get("Instances", []):
                        instance_id = instance["InstanceId"]
                        tags = {t["Key"]: t["Value"] for t in instance.get("Tags", [])}
                        name = tags.get("Name", instance_id)
                        status = instance["State"]["Name"] # running, stopped, stopping, pending, shutting-down, terminated
                        
                        # Normalize status to standard values: running, stopped, starting, stopping
                        normalized_status = status
                        if status == "pending":
                            normalized_status = "starting"
                        elif status == "shutting-down" or status == "terminated":
                            continue # Ignore terminated instances
                        
                        instance_type = instance["InstanceType"]
                        resources.append({
                            "id": instance_id,
                            "name": name,
                            "type": "ec2",
                            "instance_type": instance_type,
                            "status": normalized_status,
                            "region": region,
                            "cost_per_hour": get_ec2_cost(instance_type),
                            "tags": tags
                        })
        except ClientError as e:
            print(f"Error scanning EC2 in region {region}: {e}")
            
        # 2. RDS Scan
        try:
            rds = boto3.client("rds", region_name=region)
            paginator = rds.get_paginator("describe_db_instances")
            for page in paginator.paginate():
                for db_instance in page.get("DBInstances", []):
                    db_id = db_instance["DBInstanceIdentifier"]
                    status = db_instance["DBInstanceStatus"] # available, stopped, starting, stopping, backing-up, modifying, etc.
                    
                    # Normalize status
                    normalized_status = status
                    if status == "available":
                        normalized_status = "running"
                    elif status == "stopped":
                        normalized_status = "stopped"
                    elif status == "starting":
                        normalized_status = "starting"
                    elif status == "stopping":
                        normalized_status = "stopping"
                    else:
                        normalized_status = "running" # Default other active states as running
                    
                    # RDS tags can be retrieved or described.
                    # Boto3 describe_db_instances does not always return tags directly depending on version, 
                    # so we read them from TagList list if present.
                    tags = {t["Key"]: t["Value"] for t in db_instance.get("TagList", [])}
                    db_class = db_instance["DBInstanceClass"]
                    
                    resources.append({
                        "id": db_id,
                        "name": db_id,
                        "type": "rds",
                        "instance_type": db_class,
                        "status": normalized_status,
                        "region": region,
                        "cost_per_hour": get_rds_cost(db_class),
                        "tags": tags
                    })
        except ClientError as e:
            print(f"Error scanning RDS in region {region}: {e}")
            
    return resources

def start_resource(resource_id: str, resource_type: str, region: str) -> bool:
    """
    Start the specified EC2 or RDS resource. Returns True if command succeeded.
    """
    if settings.MOCK_AWS:
        if resource_id in MOCK_RESOURCES:
            MOCK_RESOURCES[resource_id]["status"] = "running"
            return True
        return False

    try:
        if resource_type == "ec2":
            ec2 = boto3.client("ec2", region_name=region)
            ec2.start_instances(InstanceIds=[resource_id])
            return True
        elif resource_type == "rds":
            rds = boto3.client("rds", region_name=region)
            rds.start_db_instance(DBInstanceIdentifier=resource_id)
            return True
    except ClientError as e:
        print(f"Failed to start {resource_type} instance {resource_id} in {region}: {e}")
        return False
    return False

def stop_resource(resource_id: str, resource_type: str, region: str) -> bool:
    """
    Stop the specified EC2 or RDS resource. Returns True if command succeeded.
    """
    if settings.MOCK_AWS:
        if resource_id in MOCK_RESOURCES:
            MOCK_RESOURCES[resource_id]["status"] = "stopped"
            return True
        return False

    try:
        if resource_type == "ec2":
            ec2 = boto3.client("ec2", region_name=region)
            ec2.stop_instances(InstanceIds=[resource_id])
            return True
        elif resource_type == "rds":
            rds = boto3.client("rds", region_name=region)
            rds.stop_db_instance(DBInstanceIdentifier=resource_id)
            return True
    except ClientError as e:
        print(f"Failed to stop {resource_type} instance {resource_id} in {region}: {e}")
        return False
    return False
