from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List, Optional, Union
import json

class Settings(BaseSettings):
    # Enable AWS mock mode for offline local development and testing
    MOCK_AWS: bool = True
    
    # AWS configuration
    AWS_DEFAULT_REGION: str = "us-east-1"
    ALLOWED_REGIONS: Union[List[str], str] = []  # If empty, describes instances in standard regions
    
    @field_validator("ALLOWED_REGIONS", mode="before")
    @classmethod
    def parse_regions(cls, v):
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [r.strip() for r in v.split(",") if r.strip()]
        return v
    
    # Database and Authentication settings
    DATABASE_URL: str = "sqlite:///./cloudnap.db"
    APP_PASSWORD: Optional[str] = None

    class Config:
        env_file = ".env"

settings = Settings()
