from pydantic import BaseModel

class GroupCreate(BaseModel):
    """Schema for creating a new group"""
    name: str
    description: str = ""


class GroupJoin(BaseModel):
    """Schema for joining a group"""
    code: str


class GroupLeave(BaseModel):
    """Schema for leaving a group"""
    group_id: str
