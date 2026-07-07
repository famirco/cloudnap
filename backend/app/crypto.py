import os
import base64
from cryptography.fernet import Fernet
from backend.app.config import settings

def _get_fernet() -> Fernet:
    # Use ENCRYPTION_KEY if set, otherwise derive from APP_PASSWORD as fallback
    key_str = os.getenv("ENCRYPTION_KEY")
    if not key_str:
        # Fallback key derivation (must be 32 URL-safe base64-encoded bytes)
        import hashlib
        fallback_pass = settings.APP_PASSWORD or "cloudnap-default-fallback-key"
        key_bytes = hashlib.sha256(fallback_pass.encode()).digest()
        key_str = base64.urlsafe_b64encode(key_bytes).decode()
    
    try:
        # Ensure it is a valid Fernet key
        return Fernet(key_str.encode())
    except Exception:
        import hashlib
        key_bytes = hashlib.sha256(b"emergency-fallback").digest()
        return Fernet(base64.urlsafe_b64encode(key_bytes))

def encrypt_value(value: str) -> str:
    if not value:
        return ""
    f = _get_fernet()
    return f.encrypt(value.encode()).decode()

def decrypt_value(encrypted_value: str) -> str:
    if not encrypted_value:
        return ""
    try:
        f = _get_fernet()
        return f.decrypt(encrypted_value.encode()).decode()
    except Exception:
        return ""
