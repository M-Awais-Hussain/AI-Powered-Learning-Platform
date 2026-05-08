"""
Analytics routes
Handles student analytics, group analytics, teacher dashboards, and performance metrics.
All endpoints use Redis caching (Upstash) with TTL-based expiration.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from bson import ObjectId
from typing import Optional, Dict, Any
from collections import defaultdict
import time
from functools import wraps

from ..database import (
    groups_collection, users_collection, materials_collection,
    quizzes_collection, submissions_collection
)
from ..crud import (
    is_user_in_group, get_teacher_groups, get_group_submissions, get_user_groups,
    get_quiz_title
)
from ..auth import get_current_active_user
from ..agents.topic_analyzer import analyze_topics_agent
from ..agents.base import llm
from ..agents.workflow import agent_workflow
from ..services import student_analytics_service
from ..services.redis_cache import redis_cache, make_cache_key, CACHE_TTL_ANALYTICS, CACHE_TTL_INSIGHTS
from ..services.analytics_engine import (
    get_precomputed, recompute_group_analytics, recompute_student_performance
)

router = APIRouter(prefix="/analytics", tags=["Analytics"])


def get_cached(key: str, ttl: int) -> Optional[Any]:
    """Redis cache-first lookup."""
    return redis_cache.get(key)

def set_cache(key: str, data: Any, ttl: int = CACHE_TTL_ANALYTICS) -> None:
    """Store in Redis with TTL."""
    redis_cache.set(key, data, ttl)


@router.get("/student/{student_id}")
async def get_student_analytics(
    student_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get analytics for a student"""
    if str(current_user["_id"]) != student_id and current_user["role"] != "teacher":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    submissions = list(submissions_collection.find({"user_id": student_id}))
    
    # Calculate course progress
    course_progress = []
    if submissions:
        categories = {}
        for sub in submissions:
            if sub.get("grade") and "score" in sub["grade"]:
                cat = sub.get("category", "General")
                if cat not in categories:
                    categories[cat] = []
                categories[cat].append(sub["grade"]["score"])
        
        for cat, scores in categories.items():
            avg_score = sum(scores) / len(scores)
            course_progress.append({
                "name": f"{cat} Course",
                "progress": int(avg_score),
                "topic": cat
            })
    else:
        course_progress = [
            {"name": "Math", "progress": 0, "topic": "Getting Started"},
            {"name": "History", "progress": 0, "topic": "Getting Started"},
            {"name": "Science", "progress": 0, "topic": "Getting Started"},
            {"name": "Language", "progress": 0, "topic": "Getting Started"}
        ]
    
    # Calculate weak areas
    weak_areas = []
    if submissions:
        topic_scores = {}
        for sub in submissions:
            if sub.get("grade") and "detailed_feedback" in sub["grade"]:
                for feedback in sub["grade"]["detailed_feedback"]:
                    topic = feedback.get("topic", "General")
                    if topic not in topic_scores:
                        topic_scores[topic] = []
                    topic_scores[topic].append(feedback.get("points_awarded", 0))
        
        for topic, scores in topic_scores.items():
            avg = sum(scores) / len(scores) if scores else 0
            if avg < 70:
                weak_areas.append({"topic": topic, "average_score": avg})
    
    return {
        "courseProgress": course_progress,
        "weakAreas": weak_areas,
        "totalQuizzes": len(submissions),
        "averageScore": sum([s.get("grade", {}).get("score", 0) for s in submissions]) / len(submissions) if submissions else 0
    }


@router.get("/{group_id}")
async def get_group_analytics(
    group_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get comprehensive analytics for a specific group.
    
    Uses 3-tier strategy:
    1. Redis cache (instant, <50ms)
    2. Precomputed analytics from MongoDB analytics collection (fast, <200ms) 
    3. On-demand computation WITHOUT LLM (fast fallback, <500ms)
    
    Topic performance (LLM-dependent) is computed separately and cached independently.
    """
    user_id = str(current_user["_id"])
    
    group = groups_collection.find_one(
        {"_id": ObjectId(group_id)},
        {"member_ids": 1, "teacher_id": 1}
    )
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    if not is_user_in_group(user_id, group_id):
        raise HTTPException(status_code=403, detail="Not authorized to access this group")
    
    # ── Tier 1: Redis cache ──
    cache_key = f"group_analytics_{group_id}"
    cached_data = get_cached(cache_key, CACHE_TTL_ANALYTICS)
    if cached_data:
        return cached_data
    
    # ── Tier 2: Precomputed analytics from MongoDB ──
    precomputed = get_precomputed(group_id, "group")
    if precomputed:
        # Check if topic performance was already computed and cached separately
        topic_cache_key = f"group_topics_{group_id}"
        cached_topics = get_cached(topic_cache_key, CACHE_TTL_ANALYTICS)
        if cached_topics:
            precomputed["topicPerformance"] = cached_topics.get("topicPerformance", [])
            precomputed["weakAreas"] = cached_topics.get("weakAreas", [])
        
        set_cache(cache_key, precomputed, CACHE_TTL_ANALYTICS)
        return precomputed
    
    # ── Tier 3: Fast computation (NO LLM — that's deferred) ──
    result = recompute_group_analytics(group_id)
    
    # Try to add topic performance from a separate cached LLM analysis
    topic_cache_key = f"group_topics_{group_id}"
    cached_topics = get_cached(topic_cache_key, CACHE_TTL_ANALYTICS)
    if cached_topics:
        result["topicPerformance"] = cached_topics.get("topicPerformance", [])
        result["weakAreas"] = cached_topics.get("weakAreas", [])
    
    set_cache(cache_key, result, CACHE_TTL_ANALYTICS)
    return result


@router.get("/{group_id}/topics")
async def get_group_topic_performance(
    group_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Compute topic performance using LLM analysis (expensive, cached separately).
    Called lazily by the frontend after the main dashboard loads.
    """
    user_id = str(current_user["_id"])
    
    if not is_user_in_group(user_id, group_id):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    topic_cache_key = f"group_topics_{group_id}"
    cached = get_cached(topic_cache_key, CACHE_TTL_ANALYTICS)
    if cached:
        return cached
    
    # Get quizzes and submissions
    quizzes = list(quizzes_collection.find(
        {"group_id": group_id, "is_active": True},
        {"_id": 1, "questions": 1}
    ))
    quiz_ids = [str(q["_id"]) for q in quizzes]
    submissions = list(submissions_collection.find(
        {"quiz_id": {"$in": quiz_ids}},
        {"quiz_id": 1, "score": 1, "grade": 1, "answers": 1}
    ))
    
    # Build question list for LLM
    all_questions = []
    q_to_quiz = {}
    for quiz in quizzes:
        qz_id = str(quiz["_id"])
        for q in quiz.get("questions", []):
            unique_id = f"{qz_id}_{q.get('id')}"
            all_questions.append({
                "id": unique_id,
                "question": q.get("question", ""),
                "answer": str(q.get("correct_answer", "")),
                "explanation": q.get("explanation", "")
            })
            q_to_quiz[unique_id] = qz_id
    
    if not all_questions:
        result = {"topicPerformance": [], "weakAreas": []}
        set_cache(topic_cache_key, result, CACHE_TTL_ANALYTICS)
        return result
    
    # LLM topic analysis (expensive but now cached independently)
    llm_analysis = analyze_topics_agent(all_questions)
    q_to_topic = llm_analysis.get("mapping", {})
    
    topic_scores = defaultdict(list)
    for s in submissions:
        quiz_id = s.get("quiz_id")
        grade = s.get("grade", {})
        detailed = grade.get("detailed_feedback", [])
        score = s.get("score")
        student_answers = s.get("answers", {})
        
        if score is None:
            continue

        ans_map = {}
        if isinstance(student_answers, list):
            for a in student_answers:
                qid = str(a.get("question_id"))
                ans_map[qid] = a
        elif isinstance(student_answers, dict):
            ans_map = {str(k): {"selected_answer": v} for k, v in student_answers.items()}

        if detailed:
            for d in detailed:
                q_id = d.get("question_id")
                unique_q_id = f"{quiz_id}_{q_id}"
                topic = q_to_topic.get(unique_q_id)
                if topic:
                    topic_scores[topic].append(100 if d.get("correct") else 0)
        else:
            quiz_obj = next((q for q in quizzes if str(q["_id"]) == quiz_id), None)
            if quiz_obj:
                for q in quiz_obj.get("questions", []):
                    q_id = str(q.get("id"))
                    unique_q_id = f"{quiz_id}_{q_id}"
                    topic = q_to_topic.get(unique_q_id)
                    if topic:
                        ans_obj = ans_map.get(q_id, {})
                        if "correct" in ans_obj:
                            topic_scores[topic].append(100 if ans_obj["correct"] else 0)
                        else:
                            st_ans = ans_obj.get("selected_answer")
                            correct_ans = q.get("correct_answer")
                            if st_ans is not None:
                                is_correct = str(st_ans).strip().lower() == str(correct_ans).strip().lower()
                                topic_scores[topic].append(100 if is_correct else 0)
                            else:
                                topic_scores[topic].append(0)

    topic_performance = []
    for topic, s_list in topic_scores.items():
        topic_performance.append({
            "topic": topic,
            "score": round(sum(s_list) / len(s_list), 1)
        })
    topic_performance.sort(key=lambda x: x["score"], reverse=True)

    weak_areas = [
        {"name": tp["topic"], "value": tp["score"], "topic": tp["topic"], "average_score": tp["score"]}
        for tp in topic_performance if tp["score"] < 70
    ]

    result = {
        "topicPerformance": topic_performance,
        "weakAreas": weak_areas
    }
    set_cache(topic_cache_key, result, CACHE_TTL_ANALYTICS)
    return result


@router.get("/teacher/{teacher_id}")
async def get_teacher_analytics(
    teacher_id: str,
    group_id: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_active_user)
):
    """Get analytics for a teacher (all groups or specific group)"""
    if str(current_user["_id"]) != teacher_id and current_user["role"] != "teacher":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if group_id:
        group = groups_collection.find_one({"_id": ObjectId(group_id), "teacher_id": teacher_id})
        if not group:
            raise HTTPException(status_code=404, detail="Group not found")
        groups = [group]
    else:
        groups = get_teacher_groups(teacher_id)
    
    if not groups:
        return {
            "studentProgress": [],
            "weakAreas": [],
            "classPerformance": [],
            "summary": "No groups or data available"
        }
    
    # Aggregate data from all groups
    all_submissions = []
    for group in groups:
        if group:
            submissions = get_group_submissions(str(group["_id"]))
            all_submissions.extend(submissions)
    
    if not all_submissions:
        return {
            "studentProgress": [],
            "weakAreas": [],
            "classPerformance": [],
            "summary": "No quiz submissions yet"
        }
    
    if group_id:
        result = agent_workflow.invoke({"group_id": group_id, "node": "teacher_dashboard"})
        return result["output"]
    else:

            
        # Original Data Aggregation (No longer needed for these 4 graphs)
        # --- Growth Trend (This section remains as it's still used) ---
        group_growth_data = defaultdict(dict)
        all_quiz_times = set()
        
        for group in groups:
            group_id_str = str(group["_id"])
            group_name = group.get("name", "Unknown Group")
            
            group_quizzes = list(quizzes_collection.find({"group_id": group_id_str}))
            group_quiz_ids = [str(q["_id"]) for q in group_quizzes]
            group_submissions = [s for s in all_submissions if str(s.get("quiz_id")) in group_quiz_ids]
            
            submissions_by_quiz = defaultdict(list)
            for sub in group_submissions:
                if sub.get("score") is not None and "quiz_id" in sub:
                    submissions_by_quiz[str(sub["quiz_id"])].append(sub["score"])
            
            for q_id, scores_list in submissions_by_quiz.items():
                quiz = next((q for q in group_quizzes if str(q["_id"]) == q_id), None)
                if quiz:
                    created_at = quiz.get("created_at", 0)
                    avg_q_score = round(sum(scores_list) / len(scores_list), 1)
                    group_growth_data[created_at][group_name] = avg_q_score
                    all_quiz_times.add(created_at)
        
        # Standardizing Growth Trend format for Recharts (LineChart)
        group_growth_trend = []
        sorted_times = sorted(list(all_quiz_times))
        for idx, t in enumerate(sorted_times):
            data_point = {"quizIndex": f"Quiz {idx + 1}", "timestamp": t}
            # Add each group's score if they took a quiz at this time
            for group_name, score in group_growth_data[t].items():
                data_point[group_name] = score
            group_growth_trend.append(data_point)

        return {
            "summary": f"Analytics across {len(groups)} groups",
            "groupGrowthTrend": group_growth_trend
        }

@router.get("/teacher/{teacher_id}/insight")
async def get_teacher_performance_insight(
    teacher_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Generate an AI insight comparing group performances for a teacher."""
    if str(current_user["_id"]) != teacher_id and current_user["role"] != "teacher":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    cache_key = f"teacher_insight_{teacher_id}"
    cached_data = get_cached(cache_key, CACHE_TTL_INSIGHTS)
    if cached_data:
        return cached_data
    
    if llm is None:
        return {"insight": "AI Insights are currently unavailable (missing API configuration)."}
        
    groups = get_teacher_groups(teacher_id)
    if not groups:
        return {"insight": "You haven't created any groups yet. Create a group to get started!"}
        
    all_submissions = []
    for group in groups:
        if group:
            submissions = get_group_submissions(str(group["_id"]))
            all_submissions.extend(submissions)
            
    if not all_submissions:
        return {"insight": "Your students haven't submitted any quizzes yet. Check back later for insights!"}

    performance_summary = []
    for group in groups:
        group_id_str = str(group["_id"])
        group_name = group.get("name", "Unknown Group")
        
        group_quizzes = list(quizzes_collection.find({"group_id": group_id_str}))
        group_quiz_ids = [str(q["_id"]) for q in group_quizzes]
        group_submissions = [s for s in all_submissions if str(s.get("quiz_id")) in group_quiz_ids]
        
        group_scores = [s.get("score", 0) for s in group_submissions if s.get("score") is not None]
        avg_group_score = round(sum(group_scores) / len(group_scores), 1) if group_scores else 0
        
        performance_summary.append(f"- {group_name}: Average Score {avg_group_score}%, {len(group_submissions)} total quiz submissions.")

    groups_text = "\n".join(performance_summary)
    
    prompt = (
        "You are an analytical AI assistant for a teacher. "
        "Here is the performance summary across all the teacher's groups/classes:\n"
        f"{groups_text}\n\n"
        "Please provide a very brief (2-3 sentences max) analytical insight. "
        "Compare the groups against each other, highlight which group is doing the best, and point out which group might need more attention or is struggling. "
        "Keep the tone professional yet encouraging for the teacher. Do not use markdown like bolding or lists, just a plain paragraph."
    )
    
    try:
        response = llm.invoke(prompt)
        result = {"insight": response.content.strip()}
        set_cache(cache_key, result, CACHE_TTL_INSIGHTS)
        return result
    except Exception as e:
        print(f"Error generating insight: {e}")
        return {"insight": "Your classes are making progress! Monitor performance trends to see where students need the most help."}


# ==================== STUDENT PERFORMANCE SUMMARY ENDPOINT ====================

@router.get("/performance/{student_id}")
async def get_student_performance(
    student_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Overall and per-group performance summary for a student."""
    if str(current_user["_id"]) != student_id and current_user["role"] != "teacher":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    cache_key = f"student_performance_{student_id}"
    cached_data = get_cached(cache_key, CACHE_TTL_ANALYTICS)
    if cached_data:
        return cached_data
    
    groups = get_user_groups(student_id)
    group_ids = [str(g["_id"]) for g in groups]
    submissions = list(submissions_collection.find({"user_id": student_id}))
    
    total_groups_joined = len(group_ids)
    total_quizzes_attempted = len(submissions)
    
    overall_scores = [s.get("score", 0) for s in submissions if s.get("score") is not None]
    average_score = round(sum(overall_scores) / len(overall_scores), 1) if overall_scores else 0
    
    performance_across_groups = []
    quiz_attempts_per_group = []
    group_stats = []
    
    for group in groups:
        group_id_str = str(group["_id"])
        group_name = group.get("name", "Unknown Group")
        
        # Find quizzes for this group
        group_quizzes = list(quizzes_collection.find({"group_id": group_id_str}))
        group_quiz_ids = [str(q["_id"]) for q in group_quizzes]
        
        # Filter submissions for quizzes belonging to this group
        group_submissions = [s for s in submissions if str(s.get("quiz_id")) in group_quiz_ids]
        
        # Performance Across Groups
        group_scores = [s.get("score", 0) for s in group_submissions if s.get("score") is not None]
        avg_group_score = round(sum(group_scores) / len(group_scores), 1) if group_scores else 0
        
        performance_across_groups.append({
            "groupName": group_name,
            "averageScore": avg_group_score
        })
        
        # Quiz Attempts per Group (unique quizzes attempted)
        attempted_ids = set(str(s.get("quiz_id")) for s in group_submissions)
        attempted = len(attempted_ids)
        
        # Find total active quizzes in this group
        total_active_quizzes = sum(1 for q in group_quizzes if q.get("is_active", True))
        missed = max(0, total_active_quizzes - attempted)
        
        quiz_attempts_per_group.append({
            "groupName": group_name,
            "attempted": attempted,
            "missed": missed
        })

        # Calculate completion rate for groupStats
        completion_rate = round((attempted / total_active_quizzes * 100), 1) if total_active_quizzes > 0 else 0
        
        group_stats.append({
            "group_id": group_id_str,
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
    set_cache(cache_key, result)
    return result

@router.get("/performance/{student_id}/insight")
async def get_student_performance_insight(
    student_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Generate an AI insight based on student performance data."""
    if str(current_user["_id"]) != student_id and current_user["role"] != "teacher":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    cache_key = f"student_insight_{student_id}"
    cached_data = get_cached(cache_key, CACHE_TTL_INSIGHTS)
    if cached_data:
        return cached_data
    
    # Check if LLM is correctly loaded (requires GROQ_API_KEY)
    if llm is None:
        return {"insight": "AI Insights are currently unavailable (missing API configuration)."}
        
    # Get the raw performance data internally
    groups = get_user_groups(student_id)
    submissions = list(submissions_collection.find({"user_id": student_id}))
    
    overall_scores = [s.get("score", 0) for s in submissions if s.get("score") is not None]
    average_score = round(sum(overall_scores) / len(overall_scores), 1) if overall_scores else 0
    total_quizzes_attempted = len(submissions)
    
    performance_across_groups = []
    
    for group in groups:
        group_id_str = str(group["_id"])
        group_name = group.get("name", "Unknown Group")
        
        group_quizzes = list(quizzes_collection.find({"group_id": group_id_str}))
        group_quiz_ids = [str(q["_id"]) for q in group_quizzes]
        group_submissions = [s for s in submissions if str(s.get("quiz_id")) in group_quiz_ids]
        
        group_scores = [s.get("score", 0) for s in group_submissions if s.get("score") is not None]
        avg_group_score = round(sum(group_scores) / len(group_scores), 1) if group_scores else 0
        
        total_active = sum(1 for q in group_quizzes if q.get("is_active", True))
        attempted = len(set(str(s.get("quiz_id")) for s in group_submissions))
        missed = max(0, total_active - attempted)
        
        performance_across_groups.append(f"- {group_name}: Avg Score {avg_group_score}%, Attempted {attempted}/{total_active} quizzes (Missed {missed})")
    
    if not performance_across_groups:
        return {"insight": "You haven't joined any groups or taken any quizzes yet. Join a group to get started!"}

    groups_summary = "\n".join(performance_across_groups)
    
    prompt = (
        "You are an encouraging AI tutor analyzing a student's recent performance. "
        "Here is their performance summary across their groups:\n"
        f"Overall Average Score: {average_score}%\n"
        f"Total Quizzes Taken: {total_quizzes_attempted}\n"
        "Group Detailed Breakdown:\n"
        f"{groups_summary}\n\n"
        "Please provide a very brief (2-3 sentences max) encouraging insight. "
        "Highlight their strongest area, point out where they could improve (like missed quizzes or lower scores), "
        "and keep the tone highly motivational. Do not use markdown like bolding or lists, just a plain paragraph."
    )
    
    try:
        response = llm.invoke(prompt)
        result = {"insight": response.content.strip()}
        set_cache(cache_key, result, CACHE_TTL_INSIGHTS)
        return result
    except Exception as e:
        print(f"Error generating insight: {e}")
        return {"insight": "Keep up the great work! Complete more quizzes to unlock AI-powered insights."}

# ==================== STUDY RECOMMENDATIONS ENDPOINTS ====================

@router.get("/recommendations/{student_id}")
async def get_study_recommendations(
    student_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get personalized study recommendations based on weak areas."""
    if str(current_user["_id"]) != student_id and current_user["role"] != "teacher":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    submissions = list(submissions_collection.find({"user_id": student_id}))
    
    # Analyze performance by category
    category_performance = {}
    for sub in submissions:
        category = sub.get("category", "General")
        score = sub.get("score", 0)
        if category not in category_performance:
            category_performance[category] = {"scores": [], "count": 0}
        category_performance[category]["scores"].append(score)
        category_performance[category]["count"] += 1
    
    # Calculate category averages
    weak_areas = []
    strong_areas = []
    for cat, data in category_performance.items():
        avg = sum(data["scores"]) / len(data["scores"]) if data["scores"] else 0
        area_info = {
            "category": cat,
            "averageScore": round(avg, 1),
            "quizCount": data["count"]
        }
        if avg < 70:
            weak_areas.append(area_info)
        else:
            strong_areas.append(area_info)
    
    weak_areas.sort(key=lambda x: x["averageScore"])
    
    groups = get_user_groups(student_id)
    group_ids = [str(g["_id"]) for g in groups]
    
    # Find recommended materials
    recommended_materials = []
    weak_categories = [w["category"] for w in weak_areas[:3]]
    
    for gid in group_ids:
        materials = list(materials_collection.find({
            "group_id": gid,
            "category": {"$in": weak_categories if weak_categories else ["General"]}
        }).limit(5))
        for m in materials:
            recommended_materials.append({
                "id": str(m["_id"]),
                "title": m.get("lecture_title", m.get("filename", "")),
                "category": m.get("category", "General"),
                "group_id": gid,
                "reason": f"Review for {m.get('category', 'General')} improvement"
            })
    
    # Find practice quizzes
    attempted_quiz_ids = {str(s.get("quiz_id")) for s in submissions}
    recommended_quizzes = []
    
    for gid in group_ids:
        quizzes = list(quizzes_collection.find({"group_id": gid, "is_active": True}))
        for q in quizzes:
            qid = str(q["_id"])
            q_category = q.get("settings", {}).get("subject", "General")
            if qid not in attempted_quiz_ids or q_category in weak_categories:
                recommended_quizzes.append({
                    "id": qid,
                    "title": q.get("settings", {}).get("name", "Practice Quiz"),
                    "category": q_category,
                    "group_id": gid,
                    "attempted": qid in attempted_quiz_ids,
                    "reason": "Practice needed" if qid not in attempted_quiz_ids else f"Retry for {q_category}"
                })
    
    # Generate study tips
    study_tips = []
    if weak_areas:
        study_tips.append(f"Focus on {weak_areas[0]['category']} - your lowest scoring area at {weak_areas[0]['averageScore']}%")
    if len(submissions) < 5:
        study_tips.append("Complete more quizzes to get better recommendations")
    if strong_areas:
        study_tips.append(f"Great work in {strong_areas[0]['category']}! Keep reviewing to maintain your {strong_areas[0]['averageScore']}% average")
    if not study_tips:
        study_tips.append("Keep up the good work! Try exploring new materials to expand your knowledge")
    
    return {
        "weakAreas": weak_areas,
        "strongAreas": strong_areas,
        "recommendedMaterials": recommended_materials[:6],
        "recommendedQuizzes": recommended_quizzes[:4],
        "studyTips": study_tips,
        "totalQuizzesCompleted": len(submissions),
        "overallAverage": round(sum(s.get("score", 0) for s in submissions) / len(submissions), 1) if submissions else 0
    }

@router.get("/student/{student_id}/group/{group_id}")
async def get_student_group_analytics(
    student_id: str,
    group_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get detailed analytics for a student in a specific group"""
    if str(current_user["_id"]) != student_id and current_user["role"] != "teacher":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    cache_key = f"student_group_{student_id}_{group_id}"
    cached_data = get_cached(cache_key, CACHE_TTL_ANALYTICS)
    if cached_data:
        return cached_data
    
    group = groups_collection.find_one({"_id": ObjectId(group_id)})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    if not is_user_in_group(student_id, group_id):
        raise HTTPException(status_code=403, detail="Student is not in this group")
    
    # Get all quizzes for this group
    quizzes = list(quizzes_collection.find({"group_id": group_id, "is_active": True}))
    quiz_ids = [str(q["_id"]) for q in quizzes]
    
    # Get all submissions for this student in this group
    submissions = list(submissions_collection.find({
        "user_id": student_id,
        "quiz_id": {"$in": quiz_ids}
    }))
    
    # --- 1. Quiz Performance Over Time (Line Chart) ---
    performance_over_time = []
    quizzes_sorted = sorted(quizzes, key=lambda q: q.get("created_at", 0))
    for idx, quiz in enumerate(quizzes_sorted):
        quiz_id_str = str(quiz["_id"])
        quiz_name = quiz.get("settings", {}).get("name", f"Quiz {idx + 1}")
        sub = next((s for s in submissions if s.get("quiz_id") == quiz_id_str), None)
        if sub and sub.get("score") is not None:
            performance_over_time.append({
                "name": quiz_name,
                "score": round(sub["score"], 1)
            })

    # --- 2 & 3. Topic Analysis (Weak Topics & Mastery) ---
    all_questions = []
    q_to_quiz = {}
    for quiz in quizzes:
        qz_id = str(quiz["_id"])
        for q in quiz.get("questions", []):
            unique_id = f"{qz_id}_{q.get('id')}"
            all_questions.append({
                "id": unique_id,
                "question": q.get("question", ""),
                "answer": str(q.get("correct_answer", "")),
                "explanation": q.get("explanation", "")
            })
            q_to_quiz[unique_id] = qz_id
    
    # Get granular topics from LLM
    llm_analysis = analyze_topics_agent(all_questions)
    q_to_topic = llm_analysis.get("mapping", {})
    
    topic_results = defaultdict(lambda: {"correct": 0, "total": 0})
    
    for s in submissions:
        quiz_id = s.get("quiz_id")
        student_answers = s.get("answers", [])
        
        # Convert student_answers list to map
        ans_map = {}
        if isinstance(student_answers, list):
            for a in student_answers:
                qid = str(a.get("question_id"))
                ans_map[qid] = a
        
        quiz_obj = next((q for q in quizzes if str(q["_id"]) == quiz_id), None)
        if quiz_obj:
            for q in quiz_obj.get("questions", []):
                q_id = str(q.get("id"))
                unique_q_id = f"{quiz_id}_{q_id}"
                topic = q_to_topic.get(unique_q_id)
                
                if topic:
                    ans_obj = ans_map.get(q_id, {})
                    topic_results[topic]["total"] += 1
                    
                    if "correct" in ans_obj:
                        if ans_obj["correct"]:
                            topic_results[topic]["correct"] += 1
                    else:
                        st_ans = ans_obj.get("selected_answer")
                        correct_ans = q.get("correct_answer")
                        if st_ans is not None:
                            if str(st_ans).strip().lower() == str(correct_ans).strip().lower():
                                topic_results[topic]["correct"] += 1

    weak_topic_distribution = []
    topic_mastery = []
    
    for topic, data in topic_results.items():
        incorrect_percentage = round(((data["total"] - data["correct"]) / data["total"] * 100), 1) if data["total"] > 0 else 0
        mastery_level = round((data["correct"] / data["total"] * 100), 1) if data["total"] > 0 else 0
        
        weak_topic_distribution.append({
            "topic": topic,
            "incorrectPercentage": incorrect_percentage
        })
        topic_mastery.append({
            "topic": topic,
            "mastery": mastery_level
        })

    # Sort weak topics by incorrect percentage descending 
    weak_topic_distribution.sort(key=lambda x: x["incorrectPercentage"], reverse=True)
    
    result = {
        "performanceOverTime": performance_over_time,
        "weakTopicDistribution": weak_topic_distribution,
        "topicMastery": topic_mastery,
        "correctVsIncorrect": [
            {"name": "Correct", "value": sum(d["correct"] for d in topic_results.values())},
            {"name": "Incorrect", "value": sum(d["total"] - d["correct"] for d in topic_results.values())}
        ]
    }
    set_cache(cache_key, result)
    return result

@router.get("/student/{student_id}/group/{group_id}/records")
async def get_student_quiz_records_endpoint(
    student_id: str,
    group_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get detailed quiz records for a student in a group"""
    if str(current_user["_id"]) != student_id and current_user["role"] != "teacher":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    return await student_analytics_service.get_student_quiz_records(student_id, group_id)

@router.get("/submission/{submission_id}/insights")
async def get_quiz_insights_endpoint(
    submission_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get AI insights for a specific quiz submission"""
    # Authorization: check if user is the student who took the quiz or a teacher
    submission = submissions_collection.find_one({"_id": ObjectId(submission_id)})
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")
        
    if str(current_user["_id"]) != str(submission["user_id"]) and current_user["role"] != "teacher":
        raise HTTPException(status_code=403, detail="Not authorized")
        
    return await student_analytics_service.generate_quiz_insights(submission_id)
