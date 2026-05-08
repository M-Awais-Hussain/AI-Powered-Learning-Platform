"""
Authentication routes
Handles user registration, login, current user info, and email verification
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from datetime import timedelta
from typing import Dict

from ..schemas import UserRegistration, UserLogin, Token, ForgotPassword, ResetPassword
from ..crud import (
    create_user, get_user_by_email, 
    verify_user_email, generate_password_reset_token, update_user_password
)
from ..auth import (
    authenticate_user, create_access_token, get_current_active_user
)
from ..services.email_service import send_verification_email, send_password_reset_email

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/signup", response_model=Dict)
async def signup(user_data: UserRegistration, request: Request):
    """Register a new user and send verification email"""
    if get_user_by_email(user_data.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    if user_data.role not in ["teacher", "student"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role must be 'teacher' or 'student'"
        )
    
    # Store user and generate token
    result = create_user(
        email=user_data.email, 
        full_name=user_data.full_name, 
        password=user_data.password, 
        role=user_data.role
    )
    
    # Try to determine base URL, fallback to localhost:3000
    base_url = "http://localhost:3000"
    if request.headers.get("origin"):
        base_url = request.headers.get("origin")
    
    # Send verification email asynchronously without blocking the response
    import asyncio
    asyncio.create_task(send_verification_email(
        user_data.email, 
        user_data.full_name, 
        result["verification_token"],
        base_url
    ))
    
    return {"user_id": result["user_id"], "message": "User created. Please verify your email."}


@router.post("/login", response_model=Token)
async def login(form_data: UserLogin):
    """Login and get JWT token"""
    user = authenticate_user(form_data.email, form_data.password)
    
    if isinstance(user, dict) and user.get("error") == "unverified":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Please check your inbox.",
        )
        
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=30)
    access_token = create_access_token(
        data={"sub": str(user["_id"])}, expires_delta=access_token_expires
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": str(user["_id"]),
        "role": user["role"],
        "email": user.get("email", ""),
        "full_name": user.get("full_name", "")
    }


@router.get("/me")
async def get_current_user_info(current_user: dict = Depends(get_current_active_user)):
    """Get current authenticated user information"""
    return {
        "user_id": str(current_user["_id"]),
        "email": current_user.get("email", ""),
        "role": current_user.get("role"),
        "full_name": current_user.get("full_name", "")
    }


@router.get("/verify-email/{token}")
async def verify_email(token: str):
    """Verify user's email address using token"""
    success = verify_user_email(token)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token"
        )
    return {"message": "Email successfully verified"}


@router.post("/forgot-password")
async def forgot_password(data: ForgotPassword, request: Request):
    """Generate and send a password reset link to user's email"""
    token = generate_password_reset_token(data.email)
    
    # Don't reveal if email exists or not for security, just return success
    if token:
        base_url = "http://localhost:3000"
        if request.headers.get("origin"):
            base_url = request.headers.get("origin")
            
        import asyncio
        asyncio.create_task(send_password_reset_email(data.email, token, base_url))
        
    return {"message": "If an account exists with that email, a password reset link has been sent."}


@router.post("/reset-password")
async def reset_password(data: ResetPassword):
    """Set new password using reset token"""
    if len(data.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters"
        )
        
    success = update_user_password(data.token, data.new_password)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
        
    return {"message": "Password has been successfully updated."}
