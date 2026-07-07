import boto3
from botocore.exceptions import ClientError
from typing import List, Dict, Any, Optional
from backend.app.config import settings
from backend.app.crypto import decrypt_value

def get_aws_session(account: Any = None) -> boto3.Session:
    """
    Constructs a boto3 Session for a given AWSAccount DB object.
    If no account is provided, returns the default session.
    """
    if not account:
        return boto3.Session()

    if account.role_arn:
        # Cross-Account AssumeRole using STS
        sts_client = boto3.client("sts", region_name=settings.AWS_DEFAULT_REGION or "us-east-1")
        assume_role_kwargs = {
            "RoleArn": account.role_arn,
            "RoleSessionName": "CloudNapSession",
        }
        if account.external_id:
            assume_role_kwargs["ExternalId"] = account.external_id
            
        try:
            assumed_role_object = sts_client.assume_role(**assume_role_kwargs)
            credentials = assumed_role_object["Credentials"]
            return boto3.Session(
                aws_access_key_id=credentials["AccessKeyId"],
                aws_secret_access_key=credentials["SecretAccessKey"],
                aws_session_token=credentials["SessionToken"],
            )
        except Exception as e:
            print(f"Error assuming role {account.role_arn}: {e}")
            raise e

    elif account.access_key_id and account.secret_access_key:
        # Static credentials decrypted at rest
        decrypted_access_key = decrypt_value(account.access_key_id)
        decrypted_secret_key = decrypt_value(account.secret_access_key)
        return boto3.Session(
            aws_access_key_id=decrypted_access_key,
            aws_secret_access_key=decrypted_secret_key,
        )

    return boto3.Session()

def get_aws_client(service_name: str, region_name: str, account: Any = None):
    session = get_aws_session(account)
    return session.client(service_name, region_name=region_name)


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
    },
    "i-03333333333333333": {
        "id": "i-03333333333333333",
        "name": "staging-worker-1",
        "type": "ec2",
        "instance_type": "t3.micro",
        "status": "running",
        "region": "us-east-1",
        "cost_per_hour": 0.0104,
        "tags": {"Name": "staging-worker-1"}
    },
    "i-04444444444444444": {
        "id": "i-04444444444444444",
        "name": "staging-worker-2",
        "type": "ec2",
        "instance_type": "t3.micro",
        "status": "stopped",
        "region": "us-east-1",
        "cost_per_hour": 0.0104,
        "tags": {"Name": "staging-worker-2"}
    },
    "db-staging-replica": {
        "id": "db-staging-replica",
        "name": "db-staging-replica",
        "type": "rds",
        "instance_type": "db.t3.micro",
        "status": "running",
        "region": "us-east-1",
        "cost_per_hour": 0.017,
        "tags": {}
    },
    "i-05555555555555555": {
        "id": "i-05555555555555555",
        "name": "prod-web-server-1",
        "type": "ec2",
        "instance_type": "t3.medium",
        "status": "running",
        "region": "us-west-2",
        "cost_per_hour": 0.0416,
        "tags": {"Name": "prod-web-server-1"}
    },
    "i-06666666666666666": {
        "id": "i-06666666666666666",
        "name": "prod-web-server-2",
        "type": "ec2",
        "instance_type": "t3.medium",
        "status": "running",
        "region": "us-west-2",
        "cost_per_hour": 0.0416,
        "tags": {"Name": "prod-web-server-2"}
    },
    "i-07777777777777777": {
        "id": "i-07777777777777777",
        "name": "prod-payment-service",
        "type": "ec2",
        "instance_type": "t3.small",
        "status": "stopped",
        "region": "us-west-2",
        "cost_per_hour": 0.0208,
        "tags": {"Name": "prod-payment-service"}
    },
    "db-prod-main": {
        "id": "db-prod-main",
        "name": "db-prod-main",
        "type": "rds",
        "instance_type": "db.t3.medium",
        "status": "running",
        "region": "us-west-2",
        "cost_per_hour": 0.068,
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

import json

REGION_TO_LOCATION = {
    "us-east-1": "US East (N. Virginia)",
    "us-east-2": "US East (Ohio)",
    "us-west-1": "US West (N. California)",
    "us-west-2": "US West (Oregon)",
    "ca-central-1": "Canada (Central)",
    "eu-west-1": "Europe (Ireland)",
    "eu-west-2": "Europe (London)",
    "eu-west-3": "Europe (Paris)",
    "eu-central-1": "Europe (Frankfurt)",
    "ap-southeast-1": "Asia Pacific (Singapore)",
    "ap-southeast-2": "Asia Pacific (Sydney)",
    "ap-northeast-1": "Asia Pacific (Tokyo)",
    "ap-northeast-2": "Asia Pacific (Seoul)",
    "ap-south-1": "Asia Pacific (Mumbai)",
    "sa-east-1": "South America (Sao Paulo)"
}

PRICING_CACHE = {}

def get_live_aws_price(service_code: str, instance_type: str, region_code: str, account: Any = None) -> float:
    """
    Fetch exact hourly cost of an EC2/RDS instance from AWS Pricing API.
    Caches results in memory to avoid repetitive API requests.
    Falls back to local static lookup if pricing API is unavailable or fails.
    """
    if settings.MOCK_AWS:
        # Avoid external calls during offline mock development
        if service_code == "AmazonEC2":
            return EC2_COSTS.get(instance_type, 0.05)
        return RDS_COSTS.get(instance_type, 0.10)

    cache_key = f"{service_code}:{instance_type}:{region_code}"
    if cache_key in PRICING_CACHE:
        return PRICING_CACHE[cache_key]

    location = REGION_TO_LOCATION.get(region_code, "US East (N. Virginia)")
    
    try:
        # The Pricing API endpoint must be queried in us-east-1 or ap-south-1
        client = get_aws_client('pricing', region_name='us-east-1', account=account)
        
        filters = [
            {"Field": "instanceType", "Value": instance_type, "Type": "TERM_MATCH"},
            {"Field": "location", "Value": location, "Type": "TERM_MATCH"},
            {"Field": "tenancy", "Value": "Shared", "Type": "TERM_MATCH"}
        ]
        
        if service_code == "AmazonEC2":
            filters.extend([
                {"Field": "operatingSystem", "Value": "Linux", "Type": "TERM_MATCH"},
                {"Field": "capacitystatus", "Value": "Used", "Type": "TERM_MATCH"},
                {"Field": "preInstalledSw", "Value": "NA", "Type": "TERM_MATCH"}
            ])
        elif service_code == "AmazonRDS":
            filters.extend([
                {"Field": "databaseEngine", "Value": "PostgreSQL", "Type": "TERM_MATCH"}
            ])

        response = client.get_products(ServiceCode=service_code, Filters=filters)
        price_list = response.get('PriceList', [])
        
        if price_list:
            for item in price_list:
                data = json.loads(item)
                terms = data.get('terms', {}).get('OnDemand', {})
                for term_key in terms:
                    price_dimensions = terms[term_key].get('priceDimensions', {})
                    for dim_key in price_dimensions:
                        price_str = price_dimensions[dim_key]['pricePerUnit']['USD']
                        price = float(price_str)
                        if price > 0.0:
                            PRICING_CACHE[cache_key] = price
                            return price
    except Exception as e:
        print(f"AWS Pricing API lookup failed for {cache_key}: {e}")

    # Fallback to local static estimation if API lookup failed
    if service_code == "AmazonEC2":
        fallback_price = EC2_COSTS.get(instance_type, 0.05)
    else:
        fallback_price = RDS_COSTS.get(instance_type, 0.10)

    PRICING_CACHE[cache_key] = fallback_price
    return fallback_price


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

def list_resources(account: Any = None) -> List[Dict[str, Any]]:
    """
    Scan EC2 and RDS instances across target regions and return uniform representation.
    """
    if settings.MOCK_AWS:
        results = []
        for key, res in MOCK_RESOURCES.items():
            res_copy = res.copy()
            if account:
                res_copy["aws_account_name"] = account.name
                # Map specific resources based on account ID to prevent duplicates
                if account.id == 1:
                    if res["id"] in [
                        "i-0123456789abcdef0", "i-0abcdef1234567890", "db-dev-postgres",
                        "i-03333333333333333", "i-04444444444444444", "db-staging-replica"
                    ]:
                        results.append(res_copy)
                elif account.id == 2:
                    if res["id"] in [
                        "i-0987654321fedcba0", "db-staging-mysql", "i-05555555555555555",
                        "i-06666666666666666", "i-07777777777777777", "db-prod-main"
                    ]:
                        results.append(res_copy)
                else:
                    # Other mock accounts get empty list to avoid duplicates
                    pass
            else:
                res_copy["aws_account_name"] = "Default Host"
                results.append(res_copy)
        return results
    
    resources = []
    regions = get_regions()
    
    for region in regions:
        # 1. EC2 Scan
        try:
            ec2 = get_aws_client("ec2", region_name=region, account=account)
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
                            "cost_per_hour": get_live_aws_price("AmazonEC2", instance_type, region, account=account),
                            "tags": tags
                        })
        except ClientError as e:
            print(f"Error scanning EC2 in region {region} for account {account.name if account else 'default'}: {e}")
            
        # 2. RDS Scan
        try:
            rds = get_aws_client("rds", region_name=region, account=account)
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
                    
                    tags = {t["Key"]: t["Value"] for t in db_instance.get("TagList", [])}
                    db_class = db_instance["DBInstanceClass"]
                    
                    resources.append({
                        "id": db_id,
                        "name": db_id,
                        "type": "rds",
                        "instance_type": db_class,
                        "status": normalized_status,
                        "region": region,
                        "cost_per_hour": get_live_aws_price("AmazonRDS", db_class, region, account=account),
                        "tags": tags
                    })
        except ClientError as e:
            print(f"Error scanning RDS in region {region} for account {account.name if account else 'default'}: {e}")
            
    return resources

def start_resource(resource_id: str, resource_type: str, region: str, account: Any = None) -> bool:
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
            ec2 = get_aws_client("ec2", region_name=region, account=account)
            ec2.start_instances(InstanceIds=[resource_id])
            return True
        elif resource_type == "rds":
            rds = get_aws_client("rds", region_name=region, account=account)
            try:
                db_info = rds.describe_db_instances(DBInstanceIdentifier=resource_id)["DBInstances"][0]
                cluster_id = db_info.get("DBClusterIdentifier")
                if cluster_id:
                    try:
                        rds.start_db_cluster(DBClusterIdentifier=cluster_id)
                    except ClientError as ce:
                        if "InvalidDBClusterState" not in str(ce):
                            raise ce
                    return True
            except Exception:
                pass
            rds.start_db_instance(DBInstanceIdentifier=resource_id)
            return True
    except ClientError as e:
        print(f"Failed to start {resource_type} instance {resource_id} in {region} for account {account.name if account else 'default'}: {e}")
        return False
    return False

def stop_resource(resource_id: str, resource_type: str, region: str, account: Any = None) -> bool:
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
            ec2 = get_aws_client("ec2", region_name=region, account=account)
            ec2.stop_instances(InstanceIds=[resource_id])
            return True
        elif resource_type == "rds":
            rds = get_aws_client("rds", region_name=region, account=account)
            try:
                db_info = rds.describe_db_instances(DBInstanceIdentifier=resource_id)["DBInstances"][0]
                cluster_id = db_info.get("DBClusterIdentifier")
                if cluster_id:
                    try:
                        rds.stop_db_cluster(DBClusterIdentifier=cluster_id)
                    except ClientError as ce:
                        if "InvalidDBClusterState" not in str(ce):
                            raise ce
                    return True
            except Exception:
                pass
            rds.stop_db_instance(DBInstanceIdentifier=resource_id)
            return True
    except ClientError as e:
        print(f"Failed to stop {resource_type} instance {resource_id} in {region} for account {account.name if account else 'default'}: {e}")
        return False
    return False
