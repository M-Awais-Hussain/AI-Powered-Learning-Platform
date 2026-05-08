"""
Unified Dashboard Route
Single optimized endpoint that returns all dashboard data in one response.
Uses Redis cache → precomputed analytics → on-demand computation as fallback.
"""
from fastapi import APIRouter, Depends
from typing import Dict, Any

from ..auth import get_current_active_user
from ..services.redis_cache import redis_cache, make_cache_key, CACHE_TTL_DASHBOARD
from ..services.analytics_engine import (
    recompute_student_performance, recompute_teacher_analytics,
    recompute_group_analytics, get_precomputed
)
from ..crud import get_user_groups, get_teacher_groups

router = APIRouter(prefix="/api", tags=["Dashboard"])


@router.get("/dashboard")
async def get_dashboard(current_user: dict = Depends(get_current_active_user)) -> Dict[str, Any]:
    """
    Unified dashboard endpoint.
    Returns all analytics data for the current user in a single response.

    Flow: Redis Cache → Precomputed (MongoDB analytics collection) → Compute on demand

    Target latency: <200ms with cache hit, <2s on cold start.
    """
    user_id = str(current_user["_id"])
    role = current_user.get("role", "student")

    if role == "teacher":
        return await _teacher_dashboard(user_id)
    else:
        return await _student_dashboard(user_id)


async def _student_dashboard(student_id: str) -> Dict[str, Any]:
    """Build complete student dashboard response."""
    cache_key = make_cache_key("dashboard", "student", student_id)

    # 1. Try Redis cache
    cached = redis_cache.get(cache_key)
    if cached is not None:
        return cached

    # 2. Try precomputed performance from analytics collection
    performance = get_precomputed(student_id, "student_performance")

    # 3. If no precomputed data, compute now
    if performance is None:
        performance = recompute_student_performance(student_id)

    # 4. Get groups info
    groups = get_user_groups(student_id)
    group_list = []
    for g in groups:
        group_list.append({
            "id": str(g["_id"]),
            "name": g.get("name", "Unknown"),
            "code": g.get("code", ""),
            "member_count": len(g.get("member_ids", []))
        })

    result = {
        "role": "student",
        "performance": performance,
        "groups": group_list,
        "totalGroupsJoined": performance.get("totalGroupsJoined", 0),
        "totalQuizzesAttempted": performance.get("totalQuizzesAttempted", 0),
        "averageScore": performance.get("averageScore", 0),
    }

    # Cache the full dashboard response
    redis_cache.set(cache_key, result, CACHE_TTL_DASHBOARD)
    return result


async def _teacher_dashboard(teacher_id: str) -> Dict[str, Any]:
    """Build complete teacher dashboard response."""
    cache_key = make_cache_key("dashboard", "teacher", teacher_id)

    # 1. Try Redis cache
    cached = redis_cache.get(cache_key)
    if cached is not None:
        return cached

    # 2. Try precomputed from analytics collection
    teacher_data = get_precomputed(teacher_id, "teacher")

    # 3. If no precomputed data, compute now
    if teacher_data is None:
        teacher_data = recompute_teacher_analytics(teacher_id)

    # 4. Get groups summary
    groups = get_teacher_groups(teacher_id)
    group_list = []
    for g in groups:
        gid = str(g["_id"])
        # Try to get precomputed group analytics
        group_data = get_precomputed(gid, "group")
        group_list.append({
            "id": gid,
            "name": g.get("name", "Unknown"),
            "code": g.get("code", ""),
            "member_count": len(g.get("member_ids", [])),
            "average_score": group_data.get("average_score", 0) if group_data else 0,
            "total_quizzes": group_data.get("total_quizzes", 0) if group_data else 0,
            "total_materials": group_data.get("total_materials", 0) if group_data else 0,
        })

    result = {
        "role": "teacher",
        "analytics": teacher_data,
        "groups": group_list,
        "totalGroups": len(groups),
        "groupGrowthTrend": teacher_data.get("groupGrowthTrend", []),
    }

    # Cache the full dashboard response
    redis_cache.set(cache_key, result, CACHE_TTL_DASHBOARD)
    return result
