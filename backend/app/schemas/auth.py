from pydantic import BaseModel, EmailStr, Field

class UserRegistration(BaseModel):
    """Schema for user registration"""
    email: str = Field(..., description="User's email address")
    full_name: str = Field(..., description="User's full name")
    password: str = Field(..., min_length=8, description="Must have uppercase and number")
    role: str  # "teacher" or "student"

class UserLogin(BaseModel):
    """Schema for user login using email."""
    email: str 
    password: str

class Token(BaseModel):
    """Schema for JWT token response"""
    access_token: str
    token_type: str
    user_id: str
    role: str
    email: str
    full_name: str = ""

class ForgotPassword(BaseModel):
    """Schema for requesting password reset"""
    email: str

class ResetPassword(BaseModel):
    """Schema for setting new password"""
    token: str
    new_password: str
