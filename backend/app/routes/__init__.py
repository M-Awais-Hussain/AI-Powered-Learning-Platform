"""
Routes package
Contains all API route modules for the Learning Platform
"""
from fastapi import APIRouter

from .auth import router as auth_router
from .profile import router as profile_router
from .groups import router as groups_router
from .materials import router as materials_router
from .chat import router as chat_router
from .quizzes import router as quizzes_router
from .analytics import router as analytics_router
from .notifications import router as notifications_router
from .notes import router as notes_router
from .dashboard import router as dashboard_router

# Create main API router that aggregates all routes
api_router = APIRouter()

# Include all route modules
api_router.include_router(auth_router)
api_router.include_router(profile_router)
api_router.include_router(groups_router)
api_router.include_router(materials_router)
api_router.include_router(chat_router)
api_router.include_router(quizzes_router)
api_router.include_router(analytics_router)
api_router.include_router(notifications_router)
api_router.include_router(notes_router)
api_router.include_router(dashboard_router)

# Export individual routers for direct access if needed
__all__ = [
    'api_router',
    'auth_router',
    'profile_router',
    'groups_router',
    'materials_router',
    'chat_router',
    'quizzes_router',
    'analytics_router',
    'notifications_router',
    'notes_router',
    'dashboard_router'
]
