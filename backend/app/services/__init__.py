"""
Services Package
Aggregates all backend services
"""
from .cloudinary_service import upload_to_cloudinary, delete_from_cloudinary, save_temp_file, cleanup_temp_file
from .student_analytics_service import get_student_quiz_records, generate_quiz_insights
from .redis_cache import redis_cache, make_cache_key, CACHE_TTL_ANALYTICS, CACHE_TTL_DASHBOARD, CACHE_TTL_INSIGHTS
from . import analytics_engine

__all__ = [
    'upload_to_cloudinary', 'delete_from_cloudinary', 'save_temp_file', 'cleanup_temp_file',
    'get_student_quiz_records', 'generate_quiz_insights',
    'redis_cache', 'make_cache_key', 'CACHE_TTL_ANALYTICS', 'CACHE_TTL_DASHBOARD', 'CACHE_TTL_INSIGHTS',
    'analytics_engine',
]
