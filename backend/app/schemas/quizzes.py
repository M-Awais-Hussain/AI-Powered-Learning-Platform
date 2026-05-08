from pydantic import BaseModel
from typing import List, Optional

class QuizCreate(BaseModel):
    """Schema for creating a new quiz"""
    group_id: str
    settings: dict  # title, description, subject, difficulty, question_type, question_count
    material_ids: List[str] = []
    start_time: Optional[int] = None  # Unix timestamp
    end_time: Optional[int] = None  # Unix timestamp
    duration_minutes: Optional[int] = None  # Duration in minutes


class QuizSubmission(BaseModel):
    """Schema for submitting quiz answers"""
    answers: List[dict]  # [{question_id, selected_answer}]
    completed: bool = True


class QuizUpdate(BaseModel):
    """Schema for updating an existing quiz"""
    settings: Optional[dict] = None  # title, description, subject, difficulty, question_type, question_count
    start_time: Optional[int] = None  # Unix timestamp
    end_time: Optional[int] = None  # Unix timestamp  
    duration_minutes: Optional[int] = None  # Duration in minutes
    regenerate_content: bool = False  # If True, regenerate questions with new settings
