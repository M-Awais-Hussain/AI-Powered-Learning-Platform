"""
Pydantic schemas for request/response validation
Re-exporting from modular schema files
"""

from .auth import UserRegistration, UserLogin, Token, ForgotPassword, ResetPassword
from .groups import GroupCreate, GroupJoin, GroupLeave
from .chat import ChatRequest
from .quizzes import QuizCreate, QuizSubmission, QuizUpdate
from .notes import NoteCreate
from .profile import ProfileUpdate, PasswordChange, LearningPreferences
