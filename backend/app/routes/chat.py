from fastapi import APIRouter, Depends, HTTPException, Query
from bson import ObjectId
from datetime import datetime
from typing import List

from ..schemas.chat import ChatRequest, ChatMessageSchema, ChatSessionSchema
from ..database import chats_collection, chat_messages_collection, summaries_collection
from ..auth import get_current_active_user
from ..agents.chat_workflow import chat_workflow

router = APIRouter(prefix="/chat", tags=["Chat"])

@router.post("/new")
async def create_new_chat(
    group_id: str = Query(None),
    current_user: dict = Depends(get_current_active_user)
):
    """Create a new chat session"""
    user_id = str(current_user["_id"])
    
    chat_doc = {
        "user_id": user_id,
        "group_id": group_id,
        "title": "New Chat",
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    result = chats_collection.insert_one(chat_doc)
    return {"chat_id": str(result.inserted_id), "title": "New Chat"}

@router.get("/sessions")
async def get_chat_sessions(
    current_user: dict = Depends(get_current_active_user)
):
    """Get all chat sessions for the current user"""
    user_id = str(current_user["_id"])
    
    sessions = list(chats_collection.find({"user_id": user_id}).sort("updated_at", -1))
    
    sessions_with_last_msg = []
    for s in sessions:
        last_msg_doc = chat_messages_collection.find_one(
            {"chat_id": str(s["_id"])},
            sort=[("timestamp", -1)]
        )
        last_message = last_msg_doc["content"] if last_msg_doc else ""
        if len(last_message) > 100:
            last_message = last_message[:97] + "..."
            
        sessions_with_last_msg.append({
            "chat_id": str(s["_id"]),
            "title": s["title"],
            "updated_at": s["updated_at"],
            "group_id": s.get("group_id"),
            "last_message": last_message
        })
    
    return sessions_with_last_msg

@router.get("/{chat_id}/history")
async def get_chat_history_endpoint(
    chat_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get rehydrated chat history (summary + last 7 messages)"""
    user_id = str(current_user["_id"])
    
    # Verify ownership
    chat = chats_collection.find_one({"_id": ObjectId(chat_id), "user_id": user_id})
    if not chat:
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    # Last 7 messages
    messages = list(chat_messages_collection.find({"chat_id": chat_id}).sort("timestamp", -1).limit(7))
    
    # Latest summary
    summary_doc = summaries_collection.find_one({"chat_id": chat_id}, sort=[("range_end", -1)])
    summary = summary_doc["summary"] if summary_doc else ""
    
    return {
        "messages": [
            {
                "role": m["role"],
                "content": m["content"],
                "timestamp": m["timestamp"]
            }
            for m in reversed(messages)
        ],
        "summary": summary,
        "title": chat["title"]
    }

@router.post("/{chat_id}/message")
async def send_chat_message(
    chat_id: str,
    chat_data: ChatRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """Send a message in an existing chat session"""
    user_id = str(current_user["_id"])
    
    # Verify ownership
    chat = chats_collection.find_one({"_id": ObjectId(chat_id), "user_id": user_id})
    if not chat:
        # Fallback to group-based or create new if not exists
        raise HTTPException(status_code=404, detail="Chat session not found")
    
    # Prepare state for LangGraph
    state = {
        "chat_id": chat_id,
        "user_id": user_id,
        "group_id": chat.get("group_id"),
        "messages": [], # Will be rehydrated by memory node
        "summary": "",
        "context": "",
        "material_ids": chat_data.material_ids,
        "new_message": chat_data.query,
        "title_generated": False
    }
    
    result = chat_workflow.invoke(state)
    
    # Extract last message (AI response)
    ai_msg = result["messages"][-1]
    
    return {
        "role": "assistant",
        "content": ai_msg.content,
        "title": result.get("title_generated", False) # Hint to frontend
    }
