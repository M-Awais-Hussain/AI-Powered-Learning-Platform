"""
Precomputed Analytics Engine
Computes and stores analytics using MongoDB aggregation pipelines.
Results are cached in the `analytics` collection and Redis for ultra-fast reads.
"""
import time
from collections import defaultdict
from typing import Dict, Any, Optional
from bson import ObjectId

from ..database import (
    analytics_collection, submissions_collection, quizzes_collection,
    groups_collection, users_collection, materials_collection
)
from .redis_cache import redis_cache, make_cache_key, CACHE_TTL_DASHBOARD


def _safe_object_id(id_str: str) -> Optional[ObjectId]:
    """Safely convert string to ObjectId."""
    try:
        return ObjectId(id_str)
    except Exception:
        return None


def recompute_group_analytics(group_id: str) -> Dict[str, Any]:
    """
    Compute all analytics for a group using aggregation pipelines.
    Stores result in `analytics` collection and Redis cache.
    """
    group = groups_collection.find_one(
        {"_id": _safe_object_id(group_id)},
        {"name": 1, "member_ids": 1, "teacher_id": 1}
    )
    if not group:
        return {}

    member_ids = group.get("member_ids", [])
    total_students = len(member_ids)

    # Count materials and quizzes in single queries with projections
    total_materials = materials_collection.count_documents({"group_id": group_id})
    total_quizzes = quizzes_collection.count_documents({"group_id": group_id, "is_active": True})

    # ── Aggregation: Get all quiz IDs + submissions in one pipeline ──
    quiz_ids = [
        str(q["_id"])
        for q in quizzes_collection.find(
            {"group_id": group_id, "is_active": True},
            {"_id": 1, "settings.name": 1, "created_at": 1}
        )
    ]

    # Get submissions with projections (only needed fields)
    submissions = list(submissions_collection.find(
        {"quiz_id": {"$in": quiz_ids}},
        {"quiz_id": 1, "user_id": 1, "score": 1, "grade": 1,
         "answers": 1, "timestamp": 1, "submitted_at": 1}
    ))

    # Get quiz details for names
    quizzes = list(quizzes_collection.find(
        {"group_id": group_id, "is_active": True},
        {"_id": 1, "settings.name": 1, "created_at": 1, "questions": 1}
    ))
    quiz_map = {str(q["_id"]): q for q in quizzes}

    # ── Calculate average score ──
    scores = [s.get("score", 0) for s in submissions if s.get("score") is not None]
    avg_score = round(sum(scores) / len(scores), 1) if scores else 0

    # ── Average Score Over Time ──
    average_score_over_time = []
    quizzes_sorted = sorted(quizzes, key=lambda q: q.get("created_at", 0))
    for idx, quiz in enumerate(quizzes_sorted):
        qid = str(quiz["_id"])
        quiz_name = quiz.get("settings", {}).get("name", f"Quiz {idx + 1}")
        quiz_subs = [s for s in submissions if s.get("quiz_id") == qid and s.get("score") is not None]
        if quiz_subs:
            q_avg = sum(s["score"] for s in quiz_subs) / len(quiz_subs)
            average_score_over_time.append({"name": quiz_name, "score": round(q_avg, 1)})

    # ── Score Distribution ──
    distribution = {"90-100": 0, "80-89": 0, "70-79": 0, "60-69": 0, "Below 60": 0}
    student_scores = defaultdict(list)
    for s in submissions:
        if s.get("user_id") and s.get("score") is not None:
            student_scores[s["user_id"]].append(s["score"])

    for uid, s_list in student_scores.items():
        stu_avg = sum(s_list) / len(s_list)
        if stu_avg >= 90: distribution["90-100"] += 1
        elif stu_avg >= 80: distribution["80-89"] += 1
        elif stu_avg >= 70: distribution["70-79"] += 1
        elif stu_avg >= 60: distribution["60-69"] += 1
        else: distribution["Below 60"] += 1

    score_distribution = [{"range": k, "count": v} for k, v in distribution.items()]

    # ── Student Performance (Leaderboard) ──
    member_oids = [_safe_object_id(mid) for mid in member_ids if _safe_object_id(mid)]
    members = list(users_collection.find(
        {"_id": {"$in": member_oids}},
        {"_id": 1, "email": 1}
    ))
    uid_to_name = {str(u["_id"]): u.get("email", "Unknown") for u in members}

    student_performance = []
    for uid, s_list in student_scores.items():
        student_performance.append({
            "name": uid_to_name.get(uid, "Unknown Student"),
            "score": round(sum(s_list) / len(s_list), 1)
        })
    student_performance.sort(key=lambda x: x["score"], reverse=True)

    # ── Last Updated ──
    last_updated = int(time.time())
    if submissions:
        timestamps = [s.get("timestamp") or s.get("submitted_at") for s in submissions]
        timestamps = [t for t in timestamps if t]
        if timestamps:
            last_updated = int(max(timestamps))

    result = {
        "total_students": total_students,
        "total_materials": total_materials,
        "total_quizzes": total_quizzes,
        "average_score": avg_score,
        "averageScoreOverTime": average_score_over_time,
        "topicPerformance": [],  # Populated on-demand (requires LLM)
        "scoreDistribution": score_distribution,
        "studentPerformance": student_performance,
        "weakAreas": [],
        "last_updated": last_updated
    }

    # Store in analytics collection
    analytics_collection.update_one(
        {"entity_id": group_id, "entity_type": "group"},
        {"$set": {
            "entity_id": group_id,
            "entity_type": "group",
            "data": result,
            "updated_at": int(time.time())
        }},
        upsert=True
    )

    # Cache in Redis
    cache_key = make_cache_key("group_analytics", group_id)
    redis_cache.set(cache_key, result, CACHE_TTL_DASHBOARD)

    return result


def recompute_student_performance(student_id: str) -> Dict[str, Any]:
    """
    Compute overall + per-group performance for a student.
    Uses projections and minimal queries.
    """
    groups = list(groups_collection.find(
        {"member_ids": student_id},
        {"_id": 1, "name": 1}
    ))
    group_ids = [str(g["_id"]) for g in groups]

    submissions = list(submissions_collection.find(
        {"user_id": student_id},
        {"quiz_id": 1, "score": 1, "grade": 1, "submitted_at": 1, "timestamp": 1}
    ))

    total_groups_joined = len(group_ids)
    total_quizzes_attempted = len(submissions)

    overall_scores = [s.get("score", 0) for s in submissions if s.get("score") is not None]
    average_score = round(sum(overall_scores) / len(overall_scores), 1) if overall_scores else 0

    # Batch fetch all quizzes for all groups in one query (avoid N+1)
    all_quizzes = list(quizzes_collection.find(
        {"group_id": {"$in": group_ids}},
        {"_id": 1, "group_id": 1, "is_active": 1}
    ))
    # Build group_id → [quiz_id_str] mapping
    group_quiz_map = defaultdict(list)
    for q in all_quizzes:
        group_quiz_map[q["group_id"]].append(str(q["_id"]))

    performance_across_groups = []
    quiz_attempts_per_group = []
    group_stats = []

    for group in groups:
        gid = str(group["_id"])
        group_name = group.get("name", "Unknown Group")
        group_quiz_ids = group_quiz_map.get(gid, [])

        group_submissions = [s for s in submissions if s.get("quiz_id") in group_quiz_ids]
        group_scores = [s.get("score", 0) for s in group_submissions if s.get("score") is not None]
        avg_group_score = round(sum(group_scores) / len(group_scores), 1) if group_scores else 0

        performance_across_groups.append({
            "groupName": group_name,
            "averageScore": avg_group_score
        })

        attempted_ids = set(s.get("quiz_id") for s in group_submissions)
        attempted = len(attempted_ids)
        total_active = sum(1 for q in all_quizzes if str(q["_id"]) in group_quiz_ids and q.get("is_active", True))
        missed = max(0, total_active - attempted)

        quiz_attempts_per_group.append({
            "groupName": group_name,
            "attempted": attempted,
            "missed": missed
        })

        completion_rate = round((attempted / total_active * 100), 1) if total_active > 0 else 0
        group_stats.append({
            "group_id": gid,
            "averageScore": avg_group_score,
            "completionRate": completion_rate
        })

    result = {
        "totalGroupsJoined": total_groups_joined,
        "totalQuizzesAttempted": total_quizzes_attempted,
        "averageScore": average_score,
        "performanceAcrossGroups": performance_across_groups,
        "quizAttemptsPerGroup": quiz_attempts_per_group,
        "groupStats": group_stats
    }

    # Store in analytics collection
    analytics_collection.update_one(
        {"entity_id": student_id, "entity_type": "student_performance"},
        {"$set": {
            "entity_id": student_id,
            "entity_type": "student_performance",
            "data": result,
            "updated_at": int(time.time())
        }},
        upsert=True
    )

    # Cache in Redis
    cache_key = make_cache_key("student_performance", student_id)
    redis_cache.set(cache_key, result, CACHE_TTL_DASHBOARD)

    return result


def recompute_teacher_analytics(teacher_id: str) -> Dict[str, Any]:
    """
    Compute cross-group analytics for a teacher using batch queries.
    """
    groups = list(groups_collection.find(
        {"teacher_id": teacher_id},
        {"_id": 1, "name": 1}
    ))

    if not groups:
        return {
            "summary": "No groups or data available",
            "groupGrowthTrend": []
        }

    group_ids = [str(g["_id"]) for g in groups]

    # Batch fetch all quizzes across all groups
    all_quizzes = list(quizzes_collection.find(
        {"group_id": {"$in": group_ids}},
        {"_id": 1, "group_id": 1, "created_at": 1}
    ))
    all_quiz_ids = [str(q["_id"]) for q in all_quizzes]

    # Batch fetch all submissions in one query
    all_submissions = list(submissions_collection.find(
        {"quiz_id": {"$in": all_quiz_ids}},
        {"quiz_id": 1, "score": 1}
    ))

    # Build growth trend
    group_name_map = {str(g["_id"]): g.get("name", "Unknown") for g in groups}
    quiz_group_map = {str(q["_id"]): q["group_id"] for q in all_quizzes}
    quiz_time_map = {str(q["_id"]): q.get("created_at", 0) for q in all_quizzes}

    # Group submissions by quiz
    sub_by_quiz = defaultdict(list)
    for s in all_submissions:
        if s.get("score") is not None:
            sub_by_quiz[s["quiz_id"]].append(s["score"])

    # Build growth data
    group_growth_data = defaultdict(dict)
    all_quiz_times = set()

    for qid, scores_list in sub_by_quiz.items():
        gid = quiz_group_map.get(qid)
        if gid:
            created_at = quiz_time_map.get(qid, 0)
            avg_q_score = round(sum(scores_list) / len(scores_list), 1)
            group_name = group_name_map.get(gid, "Unknown")
            group_growth_data[created_at][group_name] = avg_q_score
            all_quiz_times.add(created_at)

    group_growth_trend = []
    for idx, t in enumerate(sorted(all_quiz_times)):
        data_point = {"quizIndex": f"Quiz {idx + 1}", "timestamp": t}
        data_point.update(group_growth_data[t])
        group_growth_trend.append(data_point)

    result = {
        "summary": f"Analytics across {len(groups)} groups",
        "groupGrowthTrend": group_growth_trend
    }

    # Store in analytics collection
    analytics_collection.update_one(
        {"entity_id": teacher_id, "entity_type": "teacher"},
        {"$set": {
            "entity_id": teacher_id,
            "entity_type": "teacher",
            "data": result,
            "updated_at": int(time.time())
        }},
        upsert=True
    )

    # Cache in Redis
    cache_key = make_cache_key("teacher_analytics", teacher_id)
    redis_cache.set(cache_key, result, CACHE_TTL_DASHBOARD)

    return result


def get_precomputed(entity_id: str, entity_type: str) -> Optional[Dict[str, Any]]:
    """
    Retrieve precomputed analytics from Redis cache first, then MongoDB.
    Returns None if no precomputed data exists.
    """
    # Try Redis first
    cache_key = make_cache_key(f"{entity_type}_analytics", entity_id)
    if entity_type == "student_performance":
        cache_key = make_cache_key("student_performance", entity_id)
    elif entity_type == "teacher":
        cache_key = make_cache_key("teacher_analytics", entity_id)
    elif entity_type == "group":
        cache_key = make_cache_key("group_analytics", entity_id)

    cached = redis_cache.get(cache_key)
    if cached is not None:
        return cached

    # Try MongoDB analytics collection
    doc = analytics_collection.find_one(
        {"entity_id": entity_id, "entity_type": entity_type},
        {"data": 1, "updated_at": 1}
    )
    if doc and "data" in doc:
        # Re-cache in Redis for next time
        redis_cache.set(cache_key, doc["data"], CACHE_TTL_DASHBOARD)
        return doc["data"]

    return None


def invalidate_analytics(entity_id: str, entity_type: str):
    """Invalidate cached analytics for an entity."""
    if entity_type == "group":
        redis_cache.delete(make_cache_key("group_analytics", entity_id))
    elif entity_type == "student_performance":
        redis_cache.delete(make_cache_key("student_performance", entity_id))
    elif entity_type == "teacher":
        redis_cache.delete(make_cache_key("teacher_analytics", entity_id))

    # Also remove from MongoDB analytics collection
    analytics_collection.delete_one({"entity_id": entity_id, "entity_type": entity_type})
