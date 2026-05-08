from pydantic import BaseModel
from typing import Optional

class ProfileUpdate(BaseModel):
    """Schema for updating user profile"""
    username: Optional[str] = None
    email: Optional[str] = None
    display_name: Optional[str] = None
    profile_picture: Optional[str] = None
    bio: Optional[str] = None


class PasswordChange(BaseModel):
    """Schema for changing password"""
    current_password: str
    new_password: str


class LearningPreferences(BaseModel):
    """Schema for user learning preferences"""
    preferred_study_time: Optional[str] = None  # "morning", "afternoon", "evening", "night"
    session_duration: Optional[int] = None  # minutes
    difficulty_preference: Optional[str] = None  # "easy", "medium", "hard"
    notification_enabled: Optional[bool] = None
    daily_goal_quizzes: Optional[int] = None
