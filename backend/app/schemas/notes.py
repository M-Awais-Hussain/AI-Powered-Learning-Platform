from pydantic import BaseModel

class NoteCreate(BaseModel):
    """Schema for creating a new note"""
    content: str
    category: str = "General"
    source: str = "manual"
