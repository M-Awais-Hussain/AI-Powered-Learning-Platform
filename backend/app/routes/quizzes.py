"""
Quiz routes
Handles quiz generation, taking, submission, and results
"""
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId
import time

from ..schemas import QuizCreate, QuizSubmission, QuizUpdate
from ..database import (
    quizzes_collection, groups_collection, submissions_collection, users_collection
)
from ..crud import (
    is_user_in_group, create_quiz, submit_quiz, get_group_materials_by_ids,
    get_quiz_title, create_basic_questions
)
from ..auth import get_current_active_user, require_role
from ..agents import quiz_generation_agent
from ..crud import _trigger_analytics_recompute

router = APIRouter(prefix="/quiz", tags=["Quizzes"])


@router.post("/generate/{group_id}")
async def generate_quiz_endpoint(
    group_id: str,
    quiz_data: QuizCreate,
    current_user: dict = Depends(require_role(["teacher"]))
):
    """Generate a quiz from group materials (teachers only)"""
    
    group = groups_collection.find_one({"_id": ObjectId(group_id)})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    if str(group["teacher_id"]) != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Only group owner can create quizzes")
    
    # Validate scheduling times
    current_time = int(time.time())
    if quiz_data.start_time and quiz_data.start_time < current_time:
        raise HTTPException(status_code=400, detail="Start time must be in the future")
    
    if quiz_data.start_time and quiz_data.end_time:
        if quiz_data.end_time <= quiz_data.start_time:
            raise HTTPException(status_code=400, detail="End time must be after start time")
        duration_minutes = quiz_data.duration_minutes or int((quiz_data.end_time - quiz_data.start_time) / 60)
    elif quiz_data.duration_minutes and quiz_data.start_time:
        quiz_data.end_time = quiz_data.start_time + (quiz_data.duration_minutes * 60)
        duration_minutes = quiz_data.duration_minutes
    else:
        duration_minutes = quiz_data.duration_minutes
    
    # Prepare quiz generation
    settings = quiz_data.settings or {}
    question_type = settings.get("question_type", "MCQ")
    num_questions = settings.get("question_count", 10)
    difficulty = settings.get("difficulty", "Medium")
    
    state = {
        "group_id": group_id,
        "settings": settings,
        "question_type": question_type,
        "num_questions": num_questions,
        "difficulty": difficulty,
        "query": None,
        "user_id": str(current_user["_id"]),
        "content": None,
        "output": None
    }
    
    if quiz_data.material_ids:
        print(f"DEBUG: Generating quiz from {len(quiz_data.material_ids)} selected materials.")
        materials = get_group_materials_by_ids(group_id, quiz_data.material_ids)
        if not materials:
            print(f"WARNING: Selected materials {quiz_data.material_ids} not found in DB.")
            raise HTTPException(status_code=404, detail="Selected materials not found")
        state["materials"] = materials
        state["material_ids"] = quiz_data.material_ids
    else:
        print("DEBUG: Generating quiz from all group content (no specific material IDs provided).")
    
    questions = []
    try:
        result = quiz_generation_agent(state)
        questions = result.get("output", {}).get("questions", []) if result else []
        if not questions:
            questions = create_basic_questions(num_questions or 10, difficulty)
    except Exception as e:
        print(f"Error in quiz generation: {e}")
        questions = create_basic_questions(num_questions or 10, difficulty)
    
    if not questions:
        questions = create_basic_questions(1, difficulty)
    
    quiz_id = create_quiz(
        group_id=group_id,
        questions=questions,
        settings=quiz_data.settings,
        material_ids=quiz_data.material_ids,
        created_by=str(current_user["_id"]),
        start_time=quiz_data.start_time,
        end_time=quiz_data.end_time,
        duration_minutes=duration_minutes
    )
    
    return {
        "quiz_id": quiz_id,
        "questions": questions,
        "start_time": quiz_data.start_time,
        "end_time": quiz_data.end_time,
        "duration_minutes": duration_minutes
    }


@router.get("/active/{group_id}")
async def get_active_quizzes_endpoint(
    group_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get currently active quizzes for a group"""
    user_id = str(current_user["_id"])
    
    if not is_user_in_group(user_id, group_id):
        raise HTTPException(status_code=403, detail="Not authorized to access this group")
    
    current_time = int(time.time())
    
    active_quizzes = quizzes_collection.find({
        "group_id": group_id,
        "is_active": True,
        "$or": [
            {"start_time": {"$lte": current_time}, "end_time": {"$gte": current_time}},
            {"start_time": {"$lte": current_time}, "end_time": None},
            {"start_time": None, "end_time": None}
        ]
    })
    
    result = []
    for quiz in active_quizzes:
        existing_submission = submissions_collection.find_one({
            "quiz_id": str(quiz["_id"]),
            "user_id": user_id
        })
        
        result.append({
            "id": str(quiz["_id"]),
            "title": get_quiz_title(quiz),
            "description": quiz.get("settings", {}).get("description", ""),
            "question_count": len(quiz.get("questions", [])),
            "start_time": quiz.get("start_time"),
            "end_time": quiz.get("end_time"),
            "duration_minutes": quiz.get("duration_minutes"),
            "difficulty": quiz.get("settings", {}).get("difficulty", "Medium"),
            "has_submitted": existing_submission is not None,
            "submission_id": str(existing_submission["_id"]) if existing_submission else None,
            "submission_score": existing_submission.get("score") if existing_submission else None
        })
    
    return result


@router.get("/{quiz_id}")
async def get_quiz_details_endpoint(
    quiz_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get quiz details for taking (students) or viewing (teachers)"""
    user_id = str(current_user["_id"])
    
    quiz = quizzes_collection.find_one({"_id": ObjectId(quiz_id)})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    if not is_user_in_group(user_id, quiz["group_id"]):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    current_time = int(time.time())
    
    if current_user["role"] == "student":
        start_time = quiz.get("start_time")
        end_time = quiz.get("end_time")
        
        if start_time and current_time < start_time:
            raise HTTPException(status_code=403, detail="Quiz has not started yet")
        if end_time and current_time > end_time:
            raise HTTPException(status_code=403, detail="Quiz has ended")
        
        existing_submission = submissions_collection.find_one({
            "quiz_id": quiz_id,
            "user_id": user_id
        })
        if existing_submission and existing_submission.get("completed"):
            raise HTTPException(status_code=403, detail="You have already completed this quiz")
    
    questions = quiz.get("questions", [])
    if current_user["role"] == "student":
        questions_display = []
        for q in questions:
            q_copy = q.copy()
            q_copy.pop("correct_answer", None)
            q_copy.pop("sample_answer", None)
            questions_display.append(q_copy)
        questions = questions_display
    
    return {
        "id": str(quiz["_id"]),
        "title": get_quiz_title(quiz),
        "description": quiz.get("settings", {}).get("description", ""),
        "questions": questions,
        "start_time": quiz.get("start_time"),
        "end_time": quiz.get("end_time"),
        "duration_minutes": quiz.get("duration_minutes"),
        "difficulty": quiz.get("settings", {}).get("difficulty", "Medium"),
        "question_count": len(questions)
    }


@router.post("/submit/{quiz_id}")
async def submit_quiz_endpoint(
    quiz_id: str,
    submission_data: QuizSubmission,
    current_user: dict = Depends(get_current_active_user)
):
    """Submit quiz answers for evaluation"""
    user_id = str(current_user["_id"])
    
    quiz = quizzes_collection.find_one({"_id": ObjectId(quiz_id)})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    if not is_user_in_group(user_id, quiz["group_id"]):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if current_user["role"] == "student":
        current_time = int(time.time())
        start_time = quiz.get("start_time")
        end_time = quiz.get("end_time")
        if start_time and current_time < start_time:
            raise HTTPException(status_code=403, detail="Quiz has not started yet")
        # Allow a 30-second grace period after end_time for auto-submit latency
        if end_time and current_time > end_time + 30:
            raise HTTPException(status_code=403, detail="Quiz has ended. Submissions are no longer accepted.")
    
    submission_id = submit_quiz(
        quiz_id=quiz_id,
        user_id=user_id,
        answers=submission_data.answers,
        group_id=quiz["group_id"],
        completed=submission_data.completed
    )
    
    submission = submissions_collection.find_one({"_id": ObjectId(submission_id)})
    
    return {
        "submission_id": submission_id,
        "score": submission.get("score", 0),
        "correct": submission.get("grade", {}).get("correct", 0),
        "total": submission.get("grade", {}).get("total", 0),
        "completed": submission.get("completed", False),
        "message": "Quiz submitted successfully"
    }



@router.get("/submission/{quiz_id}/me")
async def get_my_submission(
    quiz_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get current user's submission for a specific quiz (for results page)"""
    user_id = str(current_user["_id"])
    
    quiz = quizzes_collection.find_one({"_id": ObjectId(quiz_id)})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    if not is_user_in_group(user_id, quiz["group_id"]):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    submission = submissions_collection.find_one({
        "quiz_id": quiz_id,
        "user_id": user_id
    })
    
    if not submission:
        raise HTTPException(status_code=404, detail="No submission found for this quiz")
    
    # Build per-question results with correct answers
    questions = quiz.get("questions", [])
    question_results = []
    for q in questions:
        q_id = q.get("id")
        # Find the student's answer for this question
        student_answer = None
        for ans in submission.get("answers", []):
            if str(ans.get("question_id")) == str(q_id):
                student_answer = ans
                break
        
        question_results.append({
            "id": q_id,
            "type": q.get("type", "multiple_choice"),
            "question": q.get("question", ""),
            "options": q.get("options"),
            "correct_answer": q.get("correct_answer"),
            "explanation": q.get("explanation", ""),
            "sample_answer": q.get("sample_answer"),
            "key_points": q.get("key_points"),
            "student_answer": student_answer.get("selected_answer") if student_answer else None,
            "is_correct": student_answer.get("correct", False) if student_answer else False,
            "difficulty": q.get("difficulty", "medium"),
            "topic": q.get("topic", "General")
        })
    
    return {
        "submission_id": str(submission["_id"]),
        "quiz_id": quiz_id,
        "quiz_title": get_quiz_title(quiz),
        "score": submission.get("score", 0),
        "correct": submission.get("grade", {}).get("correct", 0),
        "total": submission.get("grade", {}).get("total", 0),
        "completed": submission.get("completed", False),
        "submitted_at": submission.get("submitted_at", submission.get("timestamp", 0)),
        "questions": question_results
    }


@router.get("/results/{quiz_id}")
async def get_quiz_results_endpoint(
    quiz_id: str,
    current_user: dict = Depends(require_role(["teacher"]))
):
    """Get all results for a specific quiz (teachers only)"""
    quiz = quizzes_collection.find_one({"_id": ObjectId(quiz_id)})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    group = groups_collection.find_one({"_id": ObjectId(quiz["group_id"])})
    if not group or str(group["teacher_id"]) != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Not authorized to view these results")
    
    submissions = list(submissions_collection.find({"quiz_id": quiz_id}))
    
    scores = [s.get("score", 0) for s in submissions if s.get("score") is not None]
    avg_score = sum(scores) / len(scores) if scores else 0
    highest_score = max(scores) if scores else 0
    lowest_score = min(scores) if scores else 0
    
    results = []
    for sub in submissions:
        user = users_collection.find_one({"_id": ObjectId(sub["user_id"])})
        results.append({
            "submission_id": str(sub["_id"]),
            "user_id": str(sub["user_id"]),
            "email": user.get("email", "Unknown") if user else "Unknown",
            "full_name": user.get("full_name", "Unknown") if user else "Unknown",
            "score": sub.get("score", 0),
            "correct": sub.get("grade", {}).get("correct", 0) if sub.get("grade") else 0,
            "total": sub.get("grade", {}).get("total", 0) if sub.get("grade") else 0,
            "completed": sub.get("completed", False),
            "submitted_at": sub.get("submitted_at", sub.get("timestamp", 0))
        })
    
    return {
        "quiz_id": quiz_id,
        "quiz_title": get_quiz_title(quiz),
        "total_submissions": len(submissions),
        "average_score": round(avg_score, 2),
        "highest_score": round(highest_score, 2),
        "lowest_score": round(lowest_score, 2),
        "submissions": results
    }


@router.get("/results/student/{student_id}")
async def get_student_quiz_results(
    student_id: str,
    group_id: str = None,
    current_user: dict = Depends(get_current_active_user)
):
    """Get quiz results for a student, optionally filtered by group"""
    if str(current_user["_id"]) != student_id and current_user["role"] != "teacher":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {"user_id": student_id}
    if group_id:
        query["group_id"] = group_id
        
    submissions = list(submissions_collection.find(query))
    results = []
    
    for sub in submissions:
        quiz = quizzes_collection.find_one({"_id": ObjectId(sub["quiz_id"])})
        if quiz:
            results.append({
                "submission_id": str(sub["_id"]),
                "quiz_id": str(quiz["_id"]),
                "quiz_name": quiz.get("settings", {}).get("name", "Untitled Quiz"),
                "score": sub.get("grade", {}).get("score", 0) if sub.get("grade") else 0,
                "timestamp": sub.get("timestamp", 0),
                "category": sub.get("category", "General")
            })
    
    return results


@router.delete("/{quiz_id}")
async def delete_quiz(
    quiz_id: str,
    current_user: dict = Depends(require_role(["teacher"]))
):
    """Delete or deactivate a quiz"""
    quiz = quizzes_collection.find_one({"_id": ObjectId(quiz_id)})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    group = groups_collection.find_one({"_id": ObjectId(quiz["group_id"])})
    if str(group["teacher_id"]) != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Permanently delete the quiz
    quizzes_collection.delete_one({"_id": ObjectId(quiz_id)})

    _trigger_analytics_recompute(quiz["group_id"], "group")
    _trigger_analytics_recompute(str(current_user["_id"]), "teacher")
    
    return {"message": "Quiz deleted successfully"}


@router.put("/{quiz_id}")
async def update_quiz(
    quiz_id: str,
    update_data: QuizUpdate,
    current_user: dict = Depends(require_role(["teacher"]))
):
    """Update an existing quiz - time changes preserve submissions, content changes regenerate questions"""
    
    quiz = quizzes_collection.find_one({"_id": ObjectId(quiz_id)})
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    
    group = groups_collection.find_one({"_id": ObjectId(quiz["group_id"])})
    if str(group["teacher_id"]) != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_fields = {}
    
    # Update times if provided
    if update_data.start_time is not None:
        update_fields["start_time"] = update_data.start_time
    if update_data.end_time is not None:
        update_fields["end_time"] = update_data.end_time
    if update_data.duration_minutes is not None:
        update_fields["duration_minutes"] = update_data.duration_minutes
    
    # Update settings if provided
    if update_data.settings:
        current_settings = quiz.get("settings", {})
        current_settings.update(update_data.settings)
        update_fields["settings"] = current_settings
    
    # Regenerate questions if requested
    if update_data.regenerate_content:
        settings = update_fields.get("settings", quiz.get("settings", {}))
        question_type = settings.get("question_type", "MCQ")
        num_questions = settings.get("question_count", 10)
        difficulty = settings.get("difficulty", "Medium")
        
        state = {
            "group_id": quiz["group_id"],
            "settings": settings,
            "question_type": question_type,
            "num_questions": num_questions,
            "difficulty": difficulty,
            "query": None,
            "user_id": str(current_user["_id"]),
            "content": None,
            "output": None
        }
        
        questions = []
        try:
            result = quiz_generation_agent(state)
            questions = result.get("output", {}).get("questions", []) if result else []
            if not questions:
                questions = create_basic_questions(num_questions or 10, difficulty)
        except Exception as e:
            print(f"Error in quiz regeneration: {e}")
            questions = create_basic_questions(num_questions or 10, difficulty)
        
        if not questions:
            questions = create_basic_questions(1, difficulty)
        
        update_fields["questions"] = questions
        # Note: Previous submissions are preserved - students who already submitted won't see new questions
    
    update_fields["updated_at"] = int(time.time())
    update_fields["is_active"] = True  # Ensure quiz is active after update
    
    quizzes_collection.update_one(
        {"_id": ObjectId(quiz_id)},
        {"$set": update_fields}
    )
    
    
    _trigger_analytics_recompute(quiz["group_id"], "group")
    _trigger_analytics_recompute(str(current_user["_id"]), "teacher")
    
    return {
        "message": "Quiz updated successfully",
        "quiz_id": quiz_id,
        "regenerated": update_data.regenerate_content
    }

