"""
Material routes
Handles material uploads to Cloudinary, downloads via URL, bookmarks, and search
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, BackgroundTasks
from fastapi.responses import RedirectResponse
from bson import ObjectId
from pathlib import Path
import os
import time
import asyncio

from ..database import (
    materials_collection, groups_collection, bookmarks_collection
)
from ..crud import upload_material, is_user_in_group, serialize_material
from ..auth import get_current_active_user, require_role
from ..agents import process_pdf, process_ocr, process_docx, process_pptx, update_vectorstore
from ..services.cloudinary_service import (
    upload_to_cloudinary, delete_from_cloudinary,
    save_temp_file, cleanup_temp_file
)
from ..crud import _trigger_analytics_recompute

router = APIRouter(prefix="/materials", tags=["Materials"])


def process_material_background(
    material_id: str,
    group_id: str,
    file_content: bytes,
    filename: str,
    file_ext: str
):
    """Background task to upload file, extract text, and update vector store"""
    # ---- 1. Upload to Cloudinary ----
    file_url = None
    public_id = None
    cloudinary_resource_type = None
    
    try:
        cloud_result = upload_to_cloudinary(
            file_content=file_content,
            filename=filename,
            group_id=group_id
        )
        file_url = cloud_result["secure_url"]
        public_id = cloud_result["public_id"]
        cloudinary_resource_type = cloud_result["resource_type"]
        
        # Save Cloudinary info immediately
        materials_collection.update_one(
            {"_id": ObjectId(material_id)},
            {"$set": {
                "file_url": file_url,
                "public_id": public_id,
                "cloudinary_resource_type": cloudinary_resource_type
            }}
        )
    except Exception as e:
        print(f"Cloud upload failed in background for {filename}: {e}")
        materials_collection.update_one(
            {"_id": ObjectId(material_id)},
            {"$set": {
                "processing_status": "failed",
                "processing_error": f"Cloud upload failed: {str(e)}"
            }}
        )
        return  # Abort further processing
        
    # ---- 2. Extract Text ----
    content = ""
    temp_path = None
    
    try:
        if file_ext == ".pdf":
            temp_path = save_temp_file(file_content, filename)
            content = process_pdf(temp_path)
        elif file_ext in [".jpg", ".jpeg", ".png"]:
            temp_path = save_temp_file(file_content, filename)
            content = process_ocr(temp_path)
        elif file_ext in [".docx", ".doc"]:
            temp_path = save_temp_file(file_content, filename)
            content = process_docx(temp_path)
        elif file_ext in [".pptx", ".ppt"]:
            temp_path = save_temp_file(file_content, filename)
            content = process_pptx(temp_path)
        else:
            content = f"File uploaded: {filename}"
    except Exception as e:
        print(f"File processing error: {e}")
        content = f"File uploaded: {filename} (processing failed)"
    finally:
        if temp_path:
            cleanup_temp_file(temp_path)
    
    # Save extracted content before updating vector store
    materials_collection.update_one(
        {"_id": ObjectId(material_id)},
        {"$set": {"content": content}}
    )
    
    # ---- Update vector store for AI features ----
    processing_status = "completed"
    processing_error = None
    
    if content and not content.startswith("File uploaded:"):
        try:
            print(f"Updating vector store for group {group_id}")
            update_vectorstore(group_id, content)
        except Exception as e:
            print(f"Error updating vector store: {e}")
            processing_status = "failed"
            processing_error = str(e)
    
    # Update material with final processing status
    materials_collection.update_one(
        {"_id": ObjectId(material_id)},
        {"$set": {
            "processing_status": processing_status,
            "processing_error": processing_error
        }}
    )



@router.post("/upload/{group_id}")
async def upload_material_endpoint(
    group_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    lecture_title: str = Form(None),
    current_user: dict = Depends(get_current_active_user)
):
    """Upload course material and process in background (teachers only)"""
    if current_user["role"] != "teacher":
        raise HTTPException(status_code=403, detail="Only teachers can upload materials")
    
    teacher_id = str(current_user["_id"])
    
    # Verify group exists and user is teacher
    group = groups_collection.find_one({"_id": ObjectId(group_id)})
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    
    if str(group["teacher_id"]) != teacher_id:
        raise HTTPException(status_code=403, detail="Only group owner can upload materials")
    
    # Validate file type
    allowed_extensions = [".pdf", ".docx", ".pptx", ".jpg", ".jpeg", ".png", ".doc", ".ppt", ".mp4", ".mov"]
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed. Allowed types: {', '.join(allowed_extensions)}"
        )
    
    # Auto-detect category
    category = "General"
    if file_ext == ".pdf":
        category = "PDF"
    elif file_ext in [".jpg", ".jpeg", ".png"]:
        category = "Image"
    elif file_ext in [".mp4", ".mov"]:
        category = "Video"
    elif file_ext in [".pptx", ".ppt"]:
        category = "Slide"
    elif file_ext in [".docx", ".doc"]:
        category = "Document"

    # Read file content
    file_content = await file.read()
    
    # Validate file size (max 10MB)
    if len(file_content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds 10MB limit")
    
    file_size = len(file_content)
    
    # ---- Save skeleton to MongoDB immediately ----
    material_id = upload_material(
        group_id=group_id,
        filename=file.filename,
        type=file.content_type or "application/octet-stream",
        content="",  # Content populated by background task
        category=category,
        lecture_title=lecture_title,
        file_size=file_size,
        processing_status="processing",
        file_url=None,  # Populated after background upload
        public_id=None,
        cloudinary_resource_type=None,
        teacher_id=teacher_id,
    )
    
    # ---- Enqueue Background Processing ----
    background_tasks.add_task(
        process_material_background,
        material_id,
        group_id,
        file_content,
        file.filename,
        file_ext
    )
    
    return {
        "material_id": material_id,
        "lecture_title": lecture_title or file.filename,
        "message": "Material uploading and processing started in background",
        "processing_status": "processing",
        "file_url": None,
    }


@router.get("/{group_id}")
async def get_materials_endpoint(
    group_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get all materials for a group"""
    user_id = str(current_user["_id"])
    if not is_user_in_group(user_id, group_id):
        raise HTTPException(status_code=403, detail="Not authorized to access this group")
    
    materials = list(materials_collection.find(
        {"group_id": group_id},
        {"_id": 1, "filename": 1, "lecture_title": 1, "category": 1, 
         "uploaded_at": 1, "file_size": 1, "type": 1, "processing_status": 1,
         "file_url": 1, "teacher_id": 1}
    ))
    
    result = [serialize_material(m) for m in materials]
    
    return result


@router.get("/download/{material_id}")
async def download_material(
    material_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Redirect to Cloudinary URL for file download/preview"""
    material = materials_collection.find_one({"_id": ObjectId(material_id)})
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    
    user_id = str(current_user["_id"])
    if not is_user_in_group(user_id, material["group_id"]):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    file_url = material.get("file_url")
    if not file_url:
        raise HTTPException(status_code=404, detail="File URL not available. This material may have been uploaded before cloud storage was configured.")
    
    return RedirectResponse(url=file_url)


@router.delete("/{material_id}")
async def delete_material(
    material_id: str,
    current_user: dict = Depends(require_role(["teacher"]))
):
    """Delete a material from Cloudinary and MongoDB (teachers only)"""
    material = materials_collection.find_one({"_id": ObjectId(material_id)})
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    
    group = groups_collection.find_one({"_id": ObjectId(material["group_id"])})
    if str(group["teacher_id"]) != str(current_user["_id"]):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Delete from Cloudinary
    public_id = material.get("public_id")
    resource_type = material.get("cloudinary_resource_type", "raw")
    if public_id:
        deleted = delete_from_cloudinary(public_id, resource_type)
        if not deleted:
            print(f"Warning: Failed to delete file from Cloudinary: {public_id}")
    
    # Delete from MongoDB
    materials_collection.delete_one({"_id": ObjectId(material_id)})
    
    # Remove from group's material_ids
    groups_collection.update_one(
        {"_id": ObjectId(material["group_id"])},
        {"$pull": {"material_ids": material_id}}
    )
    
    # Delete associated bookmarks
    bookmarks_collection.delete_many({"material_id": material_id})
    
    _trigger_analytics_recompute(material["group_id"], "group")
    _trigger_analytics_recompute(str(current_user["_id"]), "teacher")
    
    return {"message": "Material deleted successfully"}


@router.post("/bookmark/{material_id}")
async def toggle_bookmark(
    material_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Toggle bookmark status for a material"""
    user_id = str(current_user["_id"])
    
    material = materials_collection.find_one({"_id": ObjectId(material_id)})
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    
    if not is_user_in_group(user_id, material["group_id"]):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    existing = bookmarks_collection.find_one({
        "user_id": user_id,
        "material_id": material_id
    })
    
    if existing:
        bookmarks_collection.delete_one({"_id": existing["_id"]})
        return {"bookmarked": False, "message": "Bookmark removed"}
    else:
        bookmarks_collection.insert_one({
            "user_id": user_id,
            "material_id": material_id,
            "group_id": material["group_id"],
            "created_at": int(time.time())
        })
        return {"bookmarked": True, "message": "Material bookmarked"}


@router.get("/bookmarks/{user_id}")
async def get_user_bookmarks(
    user_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get all bookmarked materials for a user"""
    if str(current_user["_id"]) != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    bookmarks = list(bookmarks_collection.find({"user_id": user_id}))
    
    result = []
    for bookmark in bookmarks:
        material = materials_collection.find_one({"_id": ObjectId(bookmark["material_id"])})
        if material:
            item = serialize_material(material)
            item["bookmarked_at"] = bookmark.get("created_at", 0)
            result.append(item)
    
    return result


@router.get("/search/{group_id}")
async def search_materials(
    group_id: str,
    q: str = Query("", description="Search query"),
    category: str = Query("", description="Filter by category"),
    current_user: dict = Depends(get_current_active_user)
):
    """Search and filter materials in a group"""
    user_id = str(current_user["_id"])
    
    if not is_user_in_group(user_id, group_id):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query_filter = {"group_id": group_id}
    if category:
        query_filter["category"] = category
    
    materials = list(materials_collection.find(query_filter))
    
    if q:
        q_lower = q.lower()
        materials = [
            m for m in materials 
            if q_lower in m.get("lecture_title", "").lower() 
            or q_lower in m.get("filename", "").lower()
            or q_lower in m.get("category", "").lower()
        ]
    
    user_bookmarks = set(
        b["material_id"] for b in bookmarks_collection.find({"user_id": user_id})
    )
    
    result = []
    for m in materials:
        material_id = str(m["_id"])
        item = serialize_material(m)
        item["bookmarked"] = material_id in user_bookmarks
        result.append(item)
    
    return result


@router.get("/{group_id}/categories")
async def get_material_categories(
    group_id: str,
    current_user: dict = Depends(get_current_active_user)
):
    """Get all unique categories in a group's materials"""
    user_id = str(current_user["_id"])
    
    if not is_user_in_group(user_id, group_id):
        raise HTTPException(status_code=403, detail="Not authorized")
    
    categories = materials_collection.distinct("category", {"group_id": group_id})
    return categories
