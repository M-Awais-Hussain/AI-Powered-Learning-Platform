"""
Notification routes
Handles user notifications, read status, and notification counts
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from bson import ObjectId
import time

from ..database import notifications_collection
from ..auth import get_current_active_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("/{user_id}")
async def get_notifications(
    user_id: str,
    limit: int = Query(20, description="Max notifications to return"),
    unread_only: bool = Query(False, description="Only return unread notifications"),
    current_user: dict = Depends(get_current_active_user)
):
    """Get notifications for a user"""
    if str(current_user["_id"]) != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {"user_id": user_id}
    if unread_only:
        query["is_read"] = False
    
    notifications = list(
        notifications_collection.find(query)
        .sort("created_at", -1)
        .limit(limit)
    )
    
    result = []
    for n in notifications:
        result.append({
            "id": str(n["_id"]),
            "type": n.get("type", "info"),
            "title": n.get("title", "Notification"),
            "message": n.get("message", ""),
            "link": n.get("link"),
            "link_type": n.get("link_type"),
            "link_id": n.get("link_id"),
            "is_read": n.get("is_read", False),
            "created_at": n.get("created_at", 0)
        })
    
    return result


@router.get("/{user_id}/count")
async def get_unread_count(
    user_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get unread notification count"""
    if str(current_user["_id"]) != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    count = notifications_collection.count_documents({
        "user_id": user_id,
        "is_read": False
    })
    
    return {"unread_count": count}


@router.post("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Mark a notification as read"""
    notification = notifications_collection.find_one({"_id": ObjectId(notification_id)})
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    if notification["user_id"] != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    notifications_collection.update_one(
        {"_id": ObjectId(notification_id)},
        {"$set": {"is_read": True}}
    )
    
    return {"success": True}


@router.post("/mark-all-read")
async def mark_all_notifications_read(
    current_user: dict = Depends(get_current_active_user)
):
    """Mark all notifications as read for the current user"""
    user_id = str(current_user["_id"])
    
    notifications_collection.update_many(
        {"user_id": user_id, "is_read": False},
        {"$set": {"is_read": True}}
    )
    
    return {"success": True}


# Helper function - can be imported by other modules
def create_notification(user_id: str, notification_type: str, title: str, message: str, 
                       link_type: str = None, link_id: str = None):
    """Helper function to create a notification"""
    notifications_collection.insert_one({
        "user_id": user_id,
        "type": notification_type,
        "title": title,
        "message": message,
        "link_type": link_type,
        "link_id": link_id,
        "is_read": False,
        "created_at": int(time.time())
    })
