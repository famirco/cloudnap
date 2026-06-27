from fastapi import APIRouter, Header, HTTPException, Depends, status
from typing import Optional
from backend.app.config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])

def verify_auth(authorization: Optional[str] = Header(None)):
    """
    Dependency that checks if Bearer token matches the APP_PASSWORD settings.
    If APP_PASSWORD is not configured, authentication is bypassed.
    """
    if settings.APP_PASSWORD:
        if not authorization:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authorization header missing"
            )
        
        expected_token = f"Bearer {settings.APP_PASSWORD}"
        if authorization != expected_token:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials"
            )
    return True

@router.get("/status")
def get_auth_status(authorization: Optional[str] = Header(None)):
    """
    Check if authentication is enabled and whether the provided token is valid.
    """
    is_enabled = settings.APP_PASSWORD is not None
    is_valid = False
    
    if is_enabled and authorization:
        expected_token = f"Bearer {settings.APP_PASSWORD}"
        is_valid = (authorization == expected_token)
    elif not is_enabled:
        is_valid = True

    return {
        "auth_required": is_enabled,
        "authenticated": is_valid
    }
