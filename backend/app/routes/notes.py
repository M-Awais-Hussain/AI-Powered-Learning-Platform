"""
Notes and OCR routes
Handles note creation, retrieval, deletion, and OCR text extraction
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from pathlib import Path
import os
import time
import tempfile
from typing import Optional, List
from bson import ObjectId

from ..database import notes_collection
from ..crud import create_note
from ..agents import summarize_notes, process_ocr, process_pdf
from ..auth import get_current_active_user
from ..schemas import NoteCreate

router = APIRouter(prefix="/notes", tags=["Notes & OCR"])


@router.post("/ocr/upload")
async def ocr_upload_endpoint(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_active_user)
):
    """Upload image for OCR text extraction and summarization"""
    allowed_extensions = [".jpg", ".jpeg", ".png"]
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail="Only image files (JPG, PNG) are allowed for OCR"
        )
    
    file_content = await file.read()
    
    # Save to temp file for OCR processing
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=file_ext)
    tmp.write(file_content)
    tmp.flush()
    tmp.close()
    file_path = tmp.name
    
    try:
        extracted_text = process_ocr(file_path)
        summary = summarize_notes(extracted_text, "ocr")
        
        return {
            "extracted_text": extracted_text,
            "summary": summary,
            "message": "OCR processing completed successfully"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(e)}")
    finally:
        # Clean up temp file
        try:
            os.unlink(file_path)
        except Exception:
            pass


@router.post("/create")
async def create_note_endpoint(
    note_data: NoteCreate,
    current_user: dict = Depends(get_current_active_user),
    file: Optional[UploadFile] = File(None)
):
    """Create a new note (with optional file upload)"""
    user_id = str(current_user["_id"])
    content = note_data.content
    source = note_data.source
    summary = None
    
    if file:
        file_ext = Path(file.filename).suffix.lower()
        if file_ext != ".pdf":
            raise HTTPException(status_code=400, detail="Only PDF files are supported for notes")
        
        file_content = await file.read()
        
        # Save to temp file for PDF processing
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=file_ext)
        tmp.write(file_content)
        tmp.flush()
        tmp.close()
        file_path = tmp.name
        
        try:
            content = process_pdf(file_path)
            summary = summarize_notes(content, "pdf")
            source = "pdf"
        finally:
            # Clean up temp file
            try:
                os.unlink(file_path)
            except Exception:
                pass
    else:
        summary = summarize_notes(content, source) if source != "manual" else None
    
    note_id = create_note(user_id, content, note_data.category, source, summary)
    
    return {
        "note_id": note_id,
        "summary": summary,
        "message": "Note created successfully"
    }


@router.get("/{student_id}")
async def get_notes_endpoint(
    student_id: str,
    category: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_active_user)
):
    """Get notes for a student"""
    if str(current_user["_id"]) != student_id and current_user["role"] != "teacher":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {"user_id": student_id}
    if category:
        query["category"] = category
    
    notes = list(notes_collection.find(query).sort("_id", -1))
    return [
        {
            "id": str(note["_id"]),
            "content": note["content"],
            "summary": note.get("summary"),
            "category": note["category"],
            "source": note["source"]
        }
        for note in notes
    ]


@router.delete("/{note_id}")
async def delete_note(
    note_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Delete a note"""
    note = notes_collection.find_one({"_id": ObjectId(note_id)})
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    if str(note["user_id"]) != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    notes_collection.delete_one({"_id": ObjectId(note_id)})
    return {"message": "Note deleted successfully"}
