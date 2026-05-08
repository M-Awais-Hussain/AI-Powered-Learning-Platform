from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class ChatRequest(BaseModel):
    """Schema for AI tutor chat request"""
    query: str
    chat_id: Optional[str] = None
    group_id: Optional[str] = None
    material_ids: List[str] = []

class ChatMessageSchema(BaseModel):
    chat_id: str
    role: str
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class ChatSessionSchema(BaseModel):
    id: str = Field(alias="_id")
    user_id: str
    group_id: Optional[str] = None
    title: str = "New Chat"
    created_at: datetime
    updated_at: datetime

class ChatSummarySchema(BaseModel):
    chat_id: str
    summary: str
    range_start: datetime
    range_end: datetime
