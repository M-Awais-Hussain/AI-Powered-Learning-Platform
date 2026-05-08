"""
Profile routes
Handles user profile management, password changes, and learning preferences
"""
from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId

from ..schemas import ProfileUpdate, PasswordChange, LearningPreferences
from ..database import users_collection, submissions_collection, groups_collection
from ..auth import get_current_active_user, verify_password, get_password_hash

router = APIRouter(prefix="/profile", tags=["Profile"])


@router.get("/{user_id}")
async def get_profile(
    user_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get full user profile with preferences and stats"""
    if str(current_user["_id"]) != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    user = users_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get learning stats
    submissions = list(submissions_collection.find({"user_id": user_id}))
    
    if user["role"] == "teacher":
        groups = list(groups_collection.find({"teacher_id": user_id}))
    else:
        groups = list(groups_collection.find({"member_ids": user_id}))
    
    total_quizzes = len(submissions)
    avg_score = sum(s.get("score", 0) for s in submissions) / len(submissions) if submissions else 0
    
    return {
        "user_id": str(user["_id"]),
        "email": user.get("email", ""),
        "display_name": user.get("display_name", user.get("email", "")),
        "role": user["role"],
        "created_at": user.get("created_at", 0),
        "profile_picture": user.get("profile_picture", None),
        "bio": user.get("bio", ""),
        "preferences": user.get("preferences", {
            "preferred_study_time": "afternoon",
            "session_duration": 30,
            "difficulty_preference": "medium",
            "notification_enabled": True,
            "daily_goal_quizzes": 3
        }),
        "stats": {
            "total_groups": len(groups),
            "total_quizzes_completed": total_quizzes,
            "average_score": round(avg_score, 1),
            "member_since": user.get("created_at", 0)
        }
    }


@router.put("/{user_id}")
async def update_profile(
    user_id: str,
    profile_data: ProfileUpdate,
    current_user: dict = Depends(get_current_active_user)
):
    """Update user profile information"""
    if str(current_user["_id"]) != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_fields = {}
    if profile_data.email:
        update_fields["email"] = profile_data.email
    if profile_data.display_name:
        update_fields["display_name"] = profile_data.display_name
    if profile_data.profile_picture is not None:
        update_fields["profile_picture"] = profile_data.profile_picture
    if profile_data.bio is not None:
        update_fields["bio"] = profile_data.bio
    
    if update_fields:
        users_collection.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": update_fields}
        )
    
    return {"success": True, "message": "Profile updated successfully"}


@router.post("/{user_id}/password")
async def change_password(
    user_id: str,
    password_data: PasswordChange,
    current_user: dict = Depends(get_current_active_user)
):
    """Change user password"""
    if str(current_user["_id"]) != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Verify current password
    if not verify_password(password_data.current_password, current_user["hashed_password"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    # Update password
    new_hash = get_password_hash(password_data.new_password)
    users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"hashed_password": new_hash}}
    )
    
    return {"success": True, "message": "Password changed successfully"}


@router.put("/{user_id}/preferences")
async def update_preferences(
    user_id: str,
    preferences: LearningPreferences,
    current_user: dict = Depends(get_current_active_user)
):
    """Update learning preferences"""
    if str(current_user["_id"]) != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    pref_dict = preferences.dict(exclude_none=True)
    
    users_collection.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"preferences": pref_dict}}
    )
    
    return {"success": True, "message": "Preferences updated successfully", "preferences": pref_dict}
