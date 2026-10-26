"""
身份認證與安全模組 (JWT, 密碼 Hash, Google Token 驗證)
"""
import os
import time
import hashlib
import hmac
import jwt
from typing import Optional, Dict, Any
from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import user_db

JWT_SECRET = os.getenv("JWT_SECRET", "")
if len(JWT_SECRET) < 32:
    raise RuntimeError("JWT_SECRET must be configured with at least 32 random characters")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_SECONDS = 60 * 60 * 24 * 30  # 30 天

security_scheme = HTTPBearer(auto_error=False)

def hash_password(password: str) -> str:
    """使用 PBKDF2 HMAC SHA256 進行安全密碼哈希 (無原生編譯相依性問題)"""
    salt = os.urandom(16).hex()
    key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000)
    return f"{salt}${key.hex()}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not hashed_password or '$' not in hashed_password:
        return False
    try:
        salt, key_hex = hashed_password.split('$', 1)
        test_key = hashlib.pbkdf2_hmac('sha256', plain_password.encode('utf-8'), salt.encode('utf-8'), 100000)
        return hmac.compare_digest(test_key.hex(), key_hex)
    except Exception:
        return False

def create_access_token(user_id: int, email: str, username: str) -> str:
    from account_recovery import fingerprint
    user = user_db.get_user_by_id(user_id)
    payload = {
        "sub": str(user_id),
        "email": email,
        "username": username,
        "exp": int(time.time()) + JWT_EXPIRE_SECONDS,
        "iat": int(time.time())
    }
    payload['pwdv'] = fingerprint(user.get('password_hash') if user else '')
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except Exception:
        return None

def verify_google_id_token(id_token_str: str) -> Optional[Dict[str, Any]]:
    """驗證 Google ID Token，若成功回傳使用者資訊 (email, name, sub, picture)"""
    try:
        from google.oauth2 import id_token
        from google.auth.transport import requests as google_requests
        
        audience = os.getenv("GOOGLE_CLIENT_ID", "")
        if not audience:
            return None
        id_info = id_token.verify_oauth2_token(id_token_str, google_requests.Request(), audience)
        if not id_info.get("email_verified"):
            return None
        return {
            "email": id_info.get("email"),
            "name": id_info.get("name") or id_info.get("email", "").split('@')[0],
            "google_id": id_info.get("sub"),
            "avatar_url": id_info.get("picture", "")
        }
    except Exception:
        return None

async def get_current_user_optional(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme)
) -> Optional[Dict[str, Any]]:
    token = None
    if credentials:
        token = credentials.credentials
    elif "Authorization" in request.headers:
        auth_header = request.headers["Authorization"]
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    elif "token" in request.query_params:
        token = request.query_params["token"]

    if not token:
        return None

    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        return None

    user = user_db.get_user_by_id(int(payload["sub"]))
    if user:
        from account_recovery import session_allowed
        if not session_allowed(user, payload):
            return None
    return user

async def get_current_user(user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)) -> Dict[str, Any]:
    if not user:
        raise HTTPException(status_code=401, detail="尚未登入或登入憑證已過期")
    return user
