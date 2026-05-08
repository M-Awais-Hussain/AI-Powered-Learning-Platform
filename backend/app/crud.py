from .database import (
    users_collection, groups_collection, group_members_collection, 
    materials_collection, notes_collection, quizzes_collection, 
    submissions_collection, chat_messages_collection
)



from .auth import get_password_hash
from bson import ObjectId
import uuid
import time
import os
import shutil
from typing import List

# Lazy import to avoid circular dependencies
def _trigger_analytics_recompute(entity_id: str, entity_type: str):
    """Trigger background analytics recomputation after data changes."""
    try:
        from .services.analytics_engine import (
            recompute_group_analytics, recompute_student_performance,
            recompute_teacher_analytics, invalidate_analytics
        )
        from .services.redis_cache import (
            invalidate_student_cache, invalidate_teacher_cache, invalidate_group_cache
        )
                
        if entity_type == "group":
            invalidate_group_cache(entity_id)
            invalidate_analytics(entity_id, "group")
            recompute_group_analytics(entity_id)
        elif entity_type == "student":
            invalidate_student_cache(entity_id)
            invalidate_analytics(entity_id, "student_performance")
            recompute_student_performance(entity_id)
        elif entity_type == "teacher":
            invalidate_teacher_cache(entity_id)
            invalidate_analytics(entity_id, "teacher")
            recompute_teacher_analytics(entity_id)
    except Exception as e:
        print(f"⚠ Analytics recompute warning (non-fatal): {e}")

from datetime import datetime, timedelta
import secrets

def create_user(email: str, full_name: str, password: str, role: str):
    """Create a new user with hashed password and verification token"""
    hashed_password = get_password_hash(password)
    verification_token = secrets.token_urlsafe(32)
    
    user = {
        "email": email,
        "full_name": full_name,
        "password": hashed_password, 
        "role": role,
        "is_verified": False,
        "verification_token": verification_token,
        "verification_token_expires": int((datetime.utcnow() + timedelta(hours=24)).timestamp()),
        "reset_token": None,
        "reset_token_expires": None,
    }
    result = users_collection.insert_one(user)
    return {
        "user_id": str(result.inserted_id),
        "verification_token": verification_token
    }

def get_user_by_email(email: str):
    """Lookup user by email address"""
    return users_collection.find_one({"email": email.lower()})

def verify_user_email(token: str):
    """Verify an email token and activate the account"""
    current_time = int(datetime.utcnow().timestamp())
    user = users_collection.find_one({
        "verification_token": token,
        "verification_token_expires": {"$gt": current_time}
    })
    
    if user:
        users_collection.update_one(
            {"_id": user["_id"]},
            {"$set": {"is_verified": True}, "$unset": {"verification_token": "", "verification_token_expires": ""}}
        )
        return True
    return False

def generate_password_reset_token(email: str):
    """Generate and store a password reset token"""
    user = get_user_by_email(email)
    if not user:
        return None
        
    reset_token = secrets.token_urlsafe(32)
    expires = int((datetime.utcnow() + timedelta(hours=1)).timestamp())
    
    users_collection.update_one(
        {"_id": user["_id"]},
        {"$set": {"reset_token": reset_token, "reset_token_expires": expires}}
    )
    return reset_token

def update_user_password(token: str, new_password: str):
    """Update password if reset token is valid"""
    current_time = int(datetime.utcnow().timestamp())
    user = users_collection.find_one({
        "reset_token": token,
        "reset_token_expires": {"$gt": current_time}
    })
    
    if user:
        hashed_password = get_password_hash(new_password)
        users_collection.update_one(
            {"_id": user["_id"]},
            {
                "$set": {"password": hashed_password}, 
                "$unset": {"reset_token": "", "reset_token_expires": ""}
            }
        )
        return True
    return False

def create_group(name: str, teacher_id: str, description: str = ""):
    code = str(uuid.uuid4())[:8].upper()
    group_doc = {
        "name": name, 
        "code": code, 
        "teacher_id": teacher_id, 
        "member_ids": [], 
        "material_ids": [],
        "quiz_ids": [],
        "created_at": int(time.time()),
        "description": description,
        "vector_store_path": None  # Will be set after group is created
    }
    result = groups_collection.insert_one(group_doc)
    group_id = str(result.inserted_id)
    
    # Set vector store path after getting the group_id
    vector_store_path = f"./vectorstores/{group_id}"
    os.makedirs(vector_store_path, exist_ok=True)
    groups_collection.update_one({"_id": ObjectId(group_id)}, {"$set": {"vector_store_path": vector_store_path}})
    
    _trigger_analytics_recompute(teacher_id, "teacher")
    
    return {"id": group_id, "code": code}

def join_group(user_id: str, code: str):
    group = groups_collection.find_one({"code": code})
    if group:
        group_id = str(group["_id"])
        groups_collection.update_one({"_id": ObjectId(group_id)}, {"$addToSet": {"member_ids": user_id}})
        group_members_collection.insert_one({"user_id": user_id, "group_id": group_id})
        # Trigger analytics recomputation
        _trigger_analytics_recompute(group_id, "group")
        _trigger_analytics_recompute(user_id, "student")
        return group_id
    return None

def upload_material(group_id: str, filename: str, type: str, content: str, category: str = 'General', 
                    lecture_title: str = None, file_size: int = None, processing_status: str = "pending",
                    file_url: str = None, public_id: str = None, cloudinary_resource_type: str = None,
                    teacher_id: str = None):
    material = {
        "group_id": group_id, 
        "filename": filename, 
        "type": type, 
        "content": content, 
        "category": category,
        "lecture_title": lecture_title or filename,
        "uploaded_at": int(time.time()),
        "file_size": file_size,
        "processing_status": processing_status,  # pending, processing, completed, failed
        "processing_error": None,
        "file_url": file_url,               # Cloudinary secure_url
        "public_id": public_id,             # Cloudinary public_id (for deletion)
        "cloudinary_resource_type": cloudinary_resource_type,  # image, raw, video
        "teacher_id": teacher_id,           # Who uploaded this material
    }
    result = materials_collection.insert_one(material)
    groups_collection.update_one({"_id": ObjectId(group_id)}, {"$addToSet": {"material_ids": str(result.inserted_id)}})
    
    _trigger_analytics_recompute(group_id, "group")
    if teacher_id:
        _trigger_analytics_recompute(teacher_id, "teacher")
        
    return str(result.inserted_id)

def create_note(user_id: str, content: str, category: str, source: str, summary: str = None):
    note = {"user_id": user_id, "content": content, "summary": summary, "category": category, "source": source}
    result = notes_collection.insert_one(note)
    return str(result.inserted_id)

def create_quiz(group_id: str, questions: List[dict], settings: dict, material_ids: List[str] = None, 
                created_by: str = None, start_time: int = None, end_time: int = None, duration_minutes: int = None):
    quiz = {
        "group_id": group_id, 
        "questions": questions, 
        "settings": settings,
        "material_ids": material_ids or [],
        "created_by": created_by,
        "start_time": start_time,
        "end_time": end_time,
        "duration_minutes": duration_minutes,
        "created_at": int(time.time()),
        "is_active": True
    }
    result = quizzes_collection.insert_one(quiz)
    quiz_id = str(result.inserted_id)
    # Add quiz_id to group's quiz_ids list
    groups_collection.update_one({"_id": ObjectId(group_id)}, {"$addToSet": {"quiz_ids": quiz_id}})
    
    _trigger_analytics_recompute(group_id, "group")
    if created_by:
        _trigger_analytics_recompute(created_by, "teacher")
        
    return quiz_id

def standardize_answer(answer):
    """Trim and lower-case for more robust comparison"""
    if answer is None:
        return ""
    # Remove %, redundant spaces, and convert to lower case
    s = str(answer).strip().lower()
    return s


def get_quiz_title(quiz: dict) -> str:
    """Extract quiz title from settings with consistent fallback logic.
    Single source of truth for quiz title extraction."""
    settings = quiz.get("settings", {})
    return settings.get("title") or settings.get("name", "Untitled Quiz")


def create_basic_questions(count: int, difficulty: str = "medium") -> list:
    """Generate fallback placeholder questions when AI generation fails.
    Single source of truth — do not duplicate this function."""
    return [{
        "id": i + 1,
        "type": "multiple_choice",
        "question": f"Question {i + 1}: Based on the course materials, what is a key concept?",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "correct_answer": 0,
        "explanation": "This is a placeholder question.",
        "difficulty": difficulty.lower() if isinstance(difficulty, str) else "medium",
        "topic": "General"
    } for i in range(min(count, 10))]


def serialize_material(material: dict) -> dict:
    """Serialize a MongoDB material document to API response format.
    Single source of truth for material serialization."""
    return {
        "id": str(material["_id"]),
        "filename": material.get("filename", ""),
        "lecture_title": material.get("lecture_title", material.get("filename", "")),
        "category": material.get("category", "General"),
        "uploaded_at": material.get("uploaded_at", 0),
        "file_size": material.get("file_size", 0),
        "type": material.get("type", "unknown"),
        "processing_status": material.get("processing_status", "completed"),
        "file_url": material.get("file_url", ""),
        "teacher_id": material.get("teacher_id", ""),
        "group_id": material.get("group_id", ""),
    }

def submit_quiz(quiz_id: str, user_id: str, answers: List[dict], group_id: str = None, completed: bool = True):
    """Submit quiz answers and calculate score with robust recognition"""
    
    # Get quiz to validate answers
    quiz = quizzes_collection.find_one({"_id": ObjectId(quiz_id)})
    if not quiz:
        raise ValueError("Quiz not found")
    
    questions = quiz.get("questions", [])
    total_questions = len(questions)
    correct_count = 0
    
    # Process answers and calculate score
    processed_answers = []
    for ans in answers:
        question_id = ans.get("question_id")
        if question_id is None:
            question_id = ans.get("id")
            
        selected_answer = ans.get("selected_answer")
        if selected_answer is None:
            selected_answer = ans.get("answer")
        
        # Find the question
        question = next((q for q in questions if str(q.get("id")) == str(question_id) or q.get("question") == question_id), None)
        if not question:
            processed_answers.append({
                "question_id": question_id,
                "selected_answer": selected_answer,
                "correct": False
            })
            continue
        
        # Determine if answer is correct
        is_correct = False
        correct_answer = question.get("correct_answer")
        question_type = question.get("type")
        options = question.get("options", [])
        
        if question_type == "multiple_choice":
            # 1. Try to get student's selection as an index
            selected_index = None
            if isinstance(selected_answer, int):
                selected_index = selected_answer
            elif isinstance(selected_answer, str) and selected_answer.isdigit():
                selected_index = int(selected_answer)
            elif isinstance(selected_answer, str) and len(selected_answer) == 1 and selected_answer.upper() in "ABCD":
                selected_index = ord(selected_answer.upper()) - ord('A')
            
            # 2. Compare based on what correct_answer is (index or value)
            if isinstance(correct_answer, int) or (isinstance(correct_answer, str) and correct_answer.isdigit()):
                correct_index = int(correct_answer)
                if selected_index is not None:
                    is_correct = (selected_index == correct_index)
                else:
                    # Maybe student sent the option text directly?
                    if 0 <= correct_index < len(options):
                        is_correct = (standardize_answer(selected_answer) == standardize_answer(options[correct_index]))
            else:
                # correct_answer is not a simple index, maybe it's the text value
                if selected_index is not None and 0 <= selected_index < len(options):
                    is_correct = (standardize_answer(options[selected_index]) == standardize_answer(correct_answer))
                else:
                    # Compare text value directly
                    is_correct = (standardize_answer(selected_answer) == standardize_answer(correct_answer))
        
        elif question_type == "true_false":
            # Handle True/False robustly (indices 0/1 or values "True"/"False")
            selected_index = None
            if isinstance(selected_answer, int):
                selected_index = selected_answer
            elif isinstance(selected_answer, str) and selected_answer.isdigit():
                selected_index = int(selected_answer)
            
            if isinstance(correct_answer, int) or (isinstance(correct_answer, str) and correct_answer.isdigit()):
                correct_index = int(correct_answer)
                if selected_index is not None:
                    is_correct = (selected_index == correct_index)
                else:
                    # Maybe student sent the value directly?
                    if 0 <= correct_index < len(options):
                        is_correct = (standardize_answer(selected_answer) == standardize_answer(options[correct_index]))
            else:
                # correct_answer is a value (e.g. "True")
                if selected_index is not None and 0 <= selected_index < len(options):
                    is_correct = (standardize_answer(options[selected_index]) == standardize_answer(correct_answer))
                else:
                    is_correct = (standardize_answer(selected_answer) == standardize_answer(correct_answer))
        
        elif question_type == "short_answer":
            # For short answer, use standardized comparison if correct_answer exists
            if correct_answer:
                is_correct = (standardize_answer(selected_answer) == standardize_answer(correct_answer))
            else:
                # Mark as correct if non-empty as fallback
                is_correct = bool(selected_answer and len(str(selected_answer).strip()) > 0)
        
        if is_correct:
            correct_count += 1
        
        processed_answers.append({
            "question_id": question_id,
            "selected_answer": selected_answer,
            "correct": is_correct
        })
    
    # Calculate score percentage
    score = (correct_count / total_questions * 100) if total_questions > 0 else 0
    
    submission = {
        "quiz_id": quiz_id,
        "user_id": user_id,
        "group_id": group_id or quiz.get("group_id"),
        "answers": processed_answers,
        "score": round(score, 2),
        "completed": completed,
        "grade": {
            "correct": correct_count,
            "total": total_questions,
            "score": round(score, 2)
        },
        "timestamp": int(time.time()),
        "submitted_at": int(time.time())
    }
    
    # Check if submission already exists (for auto-save updates)
    existing = submissions_collection.find_one({"quiz_id": quiz_id, "user_id": user_id})
    if existing:
        # Update existing submission
        submissions_collection.update_one(
            {"_id": existing["_id"]},
            {"$set": submission}
        )
        submission_id = str(existing["_id"])
    else:
        # Create new submission
        result = submissions_collection.insert_one(submission)
        submission_id = str(result.inserted_id)

    # Trigger analytics recomputation
    effective_group_id = group_id or quiz.get("group_id")
    if effective_group_id:
        _trigger_analytics_recompute(effective_group_id, "group")
    _trigger_analytics_recompute(user_id, "student")

    return submission_id

def get_group_submissions(group_id: str):
    """Get all submissions for a group using indexed queries with projections."""
    quiz_ids = [
        str(q["_id"]) for q in quizzes_collection.find(
            {"group_id": group_id}, {"_id": 1}
        )
    ]
    return list(submissions_collection.find(
        {"quiz_id": {"$in": quiz_ids}},
        {"quiz_id": 1, "user_id": 1, "score": 1, "grade": 1,
         "answers": 1, "timestamp": 1, "submitted_at": 1}
    ))

def get_user_groups(user_id: str):
    """Get all groups a user belongs to"""
    return list(groups_collection.find({"member_ids": user_id}))

def get_teacher_groups(teacher_id: str):
    """Get all groups created by a teacher"""
    return list(groups_collection.find({"teacher_id": teacher_id}))

def get_group_by_code(code: str):
    """Get group by join code"""
    return groups_collection.find_one({"code": code})

def save_chat_message(group_id: str, user_id: str, message: str, role: str, material_context: List[str] = None):
    """Save a chat message to the group's conversation history"""
    chat_message = {
        "group_id": group_id,
        "user_id": user_id,
        "message": message,
        "role": role,
        "timestamp": int(time.time()),
        "material_context": material_context or []
    }
    result = chat_messages_collection.insert_one(chat_message)
    return str(result.inserted_id)

def get_group_chat_history(group_id: str, limit: int = 50):
    """Get recent chat history for a group"""
    return list(chat_messages_collection.find({"group_id": group_id}).sort("timestamp", -1).limit(limit))

def get_group_materials_by_ids(group_id: str, material_ids: List[str]):
    """Get specific materials by their IDs within a group"""
    return list(materials_collection.find({
        "group_id": group_id,
        "_id": {"$in": [ObjectId(mid) for mid in material_ids]}
    }))

def is_user_in_group(user_id: str, group_id: str):
    """Check if a user is a member of a specific group"""
    try:
        group = groups_collection.find_one({"_id": ObjectId(group_id)}, {"member_ids": 1, "teacher_id": 1})
        if not group:
            return False
        # Check if user is either a member or the teacher
        return user_id in group.get("member_ids", []) or user_id == group.get("teacher_id")
    except Exception as e:
        print(f"Error in is_user_in_group: {e}")
        return False

def leave_group(user_id: str, group_id: str):
    """Remove a user from a group (students can leave groups)"""
    group = groups_collection.find_one({"_id": ObjectId(group_id)})
    if not group:
        return False
    
    # Remove from member_ids
    groups_collection.update_one({"_id": ObjectId(group_id)}, {"$pull": {"member_ids": user_id}})
    
    # Remove from group_members collection
    group_members_collection.delete_many({"user_id": user_id, "group_id": group_id})
    
    _trigger_analytics_recompute(group_id, "group")
    _trigger_analytics_recompute(user_id, "student")
    
    return True

def delete_group(group_id: str, teacher_id: str):
    """Delete a group and all its associated data"""
    # Verify the teacher owns this group
    group = groups_collection.find_one({"_id": ObjectId(group_id), "teacher_id": teacher_id})
    if not group:
        return False
    
    # Delete vector store directory if it exists
    if group.get("vector_store_path") and os.path.exists(group["vector_store_path"]):
        try:
            shutil.rmtree(group["vector_store_path"])
        except Exception as e:
            print(f"Error deleting vector store: {e}")
    
    # Delete all associated materials
    materials_collection.delete_many({"group_id": group_id})
    
    # Collect quiz IDs BEFORE deleting them (bug fix: previously collected after deletion)
    quiz_ids = [str(q["_id"]) for q in quizzes_collection.find({"group_id": group_id}, {"_id": 1})]
    
    # Delete all associated quizzes
    quizzes_collection.delete_many({"group_id": group_id})
    
    # Delete all associated submissions
    submissions_collection.delete_many({"quiz_id": {"$in": quiz_ids}})
    
    # Delete all chat messages
    chat_messages_collection.delete_many({"group_id": group_id})
    
    # Delete group memberships
    group_members_collection.delete_many({"group_id": group_id})
    
    # Finally delete the group
    result = groups_collection.delete_one({"_id": ObjectId(group_id)})
    
    _trigger_analytics_recompute(teacher_id, "teacher")
    
    return result.deleted_count > 0