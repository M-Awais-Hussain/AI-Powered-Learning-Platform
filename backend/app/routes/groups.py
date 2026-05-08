"""
Group routes
Handles group creation, joining, leaving, and member management
"""
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId

from ..schemas import GroupCreate, GroupJoin, GroupLeave
from ..database import (
    groups_collection, materials_collection, quizzes_collection,
    submissions_collection, users_collection
)
from ..crud import (
    create_group, join_group, leave_group, delete_group,
    get_user_groups, get_teacher_groups, get_group_submissions, is_user_in_group,
    get_quiz_title
)
from ..auth import get_current_active_user, require_role

router = APIRouter(prefix="/groups", tags=["Groups"])


@router.post("/create")
async def create_group_endpoint(
    group_data: GroupCreate,
    current_user: dict = Depends(require_role(["teacher"]))
):
    """Create a new study group (teachers only)"""
    teacher_id = str(current_user["_id"])
    result = create_group(group_data.name, teacher_id, group_data.description)
    return result


@router.post("/join")
async def join_group_endpoint(
    join_data: GroupJoin,
    current_user: dict = Depends(get_current_active_user)
):
    """Join a group using join code"""
    user_id = str(current_user["_id"])
    group_id = join_group(user_id, join_data.code)
    if not group_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found or invalid code"
        )
    return {"group_id": group_id, "message": "Successfully joined group"}


@router.get("/user/{user_id}")
async def get_user_groups_endpoint(
    user_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get all groups a user belongs to"""
    # Verify user can access this endpoint
    if str(current_user["_id"]) != user_id and current_user["role"] != "teacher":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    groups = get_user_groups(user_id)
    teacher_groups = get_teacher_groups(user_id)
    
    # Combine and deduplicate
    all_groups = {}
    for g in groups + teacher_groups:
        group_id = str(g["_id"])
        # Get stats for each group
        materials_count = materials_collection.count_documents({"group_id": group_id})
        quizzes_count = quizzes_collection.count_documents({"group_id": group_id, "is_active": True})
        
        # Calculate average quiz score for teacher groups
        avg_score = 0
        if g.get("teacher_id") == user_id:
            submissions = get_group_submissions(group_id)
            if submissions:
                scores = [s.get("grade", {}).get("score", 0) for s in submissions if s.get("grade")]
                if scores:
                    avg_score = sum(scores) / len(scores)
        
        all_groups[group_id] = {
            "id": group_id,
            "name": g["name"],
            "code": g["code"],
            "description": g.get("description", ""),
            "member_count": len(g.get("member_ids", [])),
            "materials_count": materials_count,
            "quizzes_count": quizzes_count,
            "average_score": round(avg_score, 1),
            "is_teacher": g.get("teacher_id") == user_id,
            "created_at": g.get("created_at", 0)
        }
    
    return list(all_groups.values())


@router.get("/teacher/{teacher_id}")
async def get_teacher_groups_endpoint(
    teacher_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get all groups created by a teacher with summary stats"""
    # Verify user can access this endpoint
    if str(current_user["_id"]) != teacher_id and current_user["role"] != "teacher":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    groups = get_teacher_groups(teacher_id)
    result = []
    
    for g in groups:
        group_id = str(g["_id"])
        # Get comprehensive stats
        materials_count = materials_collection.count_documents({"group_id": group_id})
        quizzes_count = quizzes_collection.count_documents({"group_id": group_id, "is_active": True})
        
        # Calculate average quiz score
        submissions = get_group_submissions(group_id)
        avg_score = 0
        if submissions:
            scores = [s.get("grade", {}).get("score", 0) for s in submissions if s.get("grade") and s.get("grade").get("score")]
            if scores:
                avg_score = sum(scores) / len(scores)
        
        result.append({
            "id": group_id,
            "name": g["name"],
            "code": g["code"],
            "description": g.get("description", ""),
            "member_count": len(g.get("member_ids", [])),
            "materials_count": materials_count,
            "quizzes_count": quizzes_count,
            "average_score": round(avg_score, 1),
            "created_at": g.get("created_at", 0)
        })
    
    return result

@router.get("/detail/{group_id}")
async def get_group_detail_endpoint(
    group_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get details for a single group"""
    group = groups_collection.find_one({"_id": ObjectId(group_id)})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
        
    user_id = str(current_user["_id"])
    is_teacher = str(group.get("teacher_id")) == user_id
    is_member = user_id in group.get("member_ids", [])
    
    if not is_teacher and not is_member and current_user["role"] != "teacher":
        raise HTTPException(status_code=403, detail="Not authorized")

    materials_count = materials_collection.count_documents({"group_id": group_id})
    quizzes_count = quizzes_collection.count_documents({"group_id": group_id, "is_active": True})
    
    submissions = get_group_submissions(group_id)
    avg_score = 0
    if submissions:
        scores = [s.get("grade", {}).get("score", 0) for s in submissions if s.get("grade") and s.get("grade").get("score")]
        if scores:
            avg_score = sum(scores) / len(scores)

    return {
        "id": group_id,
        "name": group["name"],
        "code": group["code"],
        "description": group.get("description", ""),
        "member_count": len(group.get("member_ids", [])),
        "materials_count": materials_count,
        "quizzes_count": quizzes_count,
        "average_score": round(avg_score, 1),
        "created_at": group.get("created_at", 0),
        "is_teacher": is_teacher
    }


@router.post("/leave")
async def leave_group_endpoint(
    leave_data: GroupLeave,
    current_user: dict = Depends(get_current_active_user)
):
    """Leave a group (students only)"""
    user_id = str(current_user["_id"])
    group_id = leave_data.group_id
    
    # Verify user is in the group (as a student, not teacher)
    group = groups_collection.find_one({"_id": ObjectId(group_id)})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    if str(group["teacher_id"]) == user_id:
        raise HTTPException(status_code=400, detail="Teachers cannot leave their own groups. Delete the group instead.")
    
    if user_id not in group.get("member_ids", []):
        raise HTTPException(status_code=403, detail="You are not a member of this group")
    
    success = leave_group(user_id, group_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to leave group")
    
    return {"message": "Successfully left group"}


@router.delete("/{group_id}")
async def delete_group_endpoint(
    group_id: str,
    current_user: dict = Depends(require_role(["teacher"]))
):
    """Delete a group (only group owner)"""
    teacher_id = str(current_user["_id"])
    success = delete_group(group_id, teacher_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Group not found or you don't have permission to delete it"
        )
    return {"message": "Group deleted successfully"}


@router.get("/{group_id}/quizzes")
async def get_group_quizzes(
    group_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get all quizzes for a group (teachers see all, students see active)"""
    # Verify user has access to this group
    user_id = str(current_user["_id"])
    if not is_user_in_group(user_id, group_id):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {"group_id": group_id}
    # If student, only show active quizzes
    if current_user["role"] == "student":
        query["is_active"] = {"$ne": False}
        
    quizzes = list(quizzes_collection.find(query))
    result = []
    
    for quiz in quizzes:
        quiz_id = str(quiz["_id"])
        # Calculate average score for this quiz
        submissions = list(submissions_collection.find({"quiz_id": quiz_id}))
        scores = [s.get("score", 0) for s in submissions if s.get("score") is not None]
        avg_score = round(sum(scores) / len(scores), 1) if scores else 0
        
        quiz_data = {
            "id": quiz_id,
            "title": get_quiz_title(quiz),
            "description": quiz.get("settings", {}).get("description", ""),
            "question_count": len(quiz.get("questions", [])),
            "difficulty": quiz.get("settings", {}).get("difficulty", "Medium"),
            "created_at": quiz.get("created_at", 0),
            "is_active": quiz.get("is_active", True),
            "start_time": quiz.get("start_time"),
            "end_time": quiz.get("end_time"),
            "duration_minutes": quiz.get("duration_minutes"),
            "avg_score": avg_score
        }
        
        # For students, include submission status and score
        if current_user["role"] == "student":
            existing_submission = submissions_collection.find_one({
                "quiz_id": quiz_id,
                "user_id": user_id
            })
            quiz_data["has_submitted"] = existing_submission is not None
            quiz_data["submission_score"] = existing_submission.get("score") if existing_submission else None
        
        result.append(quiz_data)
        
    return result


@router.get("/{group_id}/code")
async def get_group_code(
    group_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get group join code"""
    group = groups_collection.find_one({"_id": ObjectId(group_id)})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Verify user is teacher or member
    if str(group.get("teacher_id")) != str(current_user["_id"]) and \
       str(current_user["_id"]) not in group.get("member_ids", []):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return {"code": group["code"]}


@router.get("/{group_id}/members")
async def get_group_members(
    group_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get all members (students) of a group"""
    group = groups_collection.find_one({"_id": ObjectId(group_id)})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    # Verify user has access to this group
    user_id = str(current_user["_id"])
    if not is_user_in_group(user_id, group_id):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get member IDs
    member_ids = group.get("member_ids", [])
    
    # Fetch user details for each member
    members = []
    for member_id in member_ids:
        user = users_collection.find_one({"_id": ObjectId(member_id)})
        if user:
            # Get student quiz stats
            submissions = list(submissions_collection.find({"user_id": member_id}))
            quiz_ids_in_group = [str(q["_id"]) for q in quizzes_collection.find({"group_id": group_id, "is_active": True})]
            student_submissions = [s for s in submissions if s.get("quiz_id") in quiz_ids_in_group]
            
            scores = []
            for sub in student_submissions:
                if sub.get("grade") and sub["grade"].get("score"):
                    scores.append(sub["grade"]["score"])
            
            avg_score = sum(scores) / len(scores) if scores else 0
            
            members.append({
                "id": str(user["_id"]),
                "email": user.get("email", ""),
                "name": user.get("full_name", user.get("display_name", user.get("email", f"User {member_id[:8]}"))),
                "joined_date": group.get("created_at", 0),
                "quiz_count": len(student_submissions),
                "avg_score": round(avg_score, 1)
            })
    
    return members

@router.delete("/{group_id}/members/{member_id}")
async def remove_member_endpoint(
    group_id: str,
    member_id: str,
    current_user: dict = Depends(require_role(["teacher"]))
):
    """Remove a student from a group (teachers only)"""
    # Verify the teacher owns this group
    teacher_id = str(current_user["_id"])
    group = groups_collection.find_one({"_id": ObjectId(group_id), "teacher_id": teacher_id})
    if not group:
        raise HTTPException(status_code=403, detail="Not authorized or group not found")
    
    success = leave_group(member_id, group_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to remove student")
        
    return {"message": "Student removed successfully"}
