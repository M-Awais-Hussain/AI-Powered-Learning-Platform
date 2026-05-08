import bcrypt
import json
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from .database import users_collection
from bson import ObjectId
import os
from dotenv import load_dotenv

load_dotenv()

USER_CACHE_TTL = 300  # 5 minutes


def _get_redis():
    """Lazy import to avoid circular dependency with services package"""
    try:
        from .services.redis_cache import redis_cache
        return redis_cache
    except Exception:
        return None

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

# JWT Configuration - Load from environment
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production-use-strong-random-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a hashed password"""
    try:
        # Bcrypt has a 72-byte limit; we truncate to ensure consistency
        if len(plain_password) > 72:
            plain_password = plain_password[:72]
        
        # In case hashed_password is from passlib or stored as string, ensure it's bytes
        # BCrypt hashes always look like b'$2b$12$...'
        if isinstance(hashed_password, str):
            hashed_password = hashed_password.encode('utf-8')
            
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password)
    except Exception as e:
        print(f"Error verifying password: {e}")
        return False

def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt"""
    if len(password) > 72:
        password = password[:72]
    # 10 rounds is still secure but ~4x faster than 12
    salt = bcrypt.gensalt(rounds=10)
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create a JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def authenticate_user(email: str, password: str):
    """Authenticate a user by email and password"""
    user = users_collection.find_one({"email": email.lower()})
    
    if not user:
        return False
        
    # Enforce email verification
    if not user.get("is_verified", False):
        return {"error": "unverified"}
        
    is_valid = verify_password(password, user.get("password", ""))
    if not is_valid:
        return False
        
    # Pre-cache user session in Redis after successful auth
    _cache_user_session(user)
    return user


def _cache_user_session(user: dict):
    """Cache user session data in Redis to avoid DB lookups on every request"""
    try:
        rc = _get_redis()
        if not rc:
            return
        user_id = str(user["_id"])
        cache_data = {
            "_id": user_id,
            "email": user.get("email", ""),
            "role": user.get("role", ""),
        }
        rc.set(f"user_session:{user_id}", json.dumps(cache_data), ttl=USER_CACHE_TTL)
    except Exception:
        pass  # Non-critical — fallback to DB

async def get_current_user(token: str = Depends(oauth2_scheme)):
    """Get the current authenticated user from JWT token.
    Uses Redis cache to avoid MongoDB lookup on every request."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    # Try Redis cache first
    try:
        rc = _get_redis()
        if rc:
            cached = rc.get(f"user_session:{user_id}")
            if cached:
                user_data = json.loads(cached)
                user_data["_id"] = user_id  # Ensure consistent format
                return user_data
    except Exception:
        pass  # Redis down — fallback to DB
    
    # Fallback to MongoDB
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if user is None:
        raise credentials_exception
    
    # Cache for next time
    _cache_user_session(user)
    return user

async def get_current_active_user(current_user: dict = Depends(get_current_user)):
    """Get the current active user"""
    return current_user

def require_role(allowed_roles: list):
    """Dependency to require specific roles"""
    async def role_checker(current_user: dict = Depends(get_current_active_user)):
        if current_user.get("role") not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions"
            )
        return current_user
    return role_checker
