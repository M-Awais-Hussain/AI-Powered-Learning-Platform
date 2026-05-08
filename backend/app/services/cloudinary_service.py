"""
Cloudinary Service
Handles file upload, download URL generation, and deletion via Cloudinary.
Uses CLOUDINARY_URL environment variable for configuration.
"""
import cloudinary
import cloudinary.uploader
import cloudinary.api
import os
import tempfile
from pathlib import Path

# Initialize Cloudinary from CLOUDINARY_URL env variable
# The CLOUDINARY_URL format: cloudinary://API_KEY:API_SECRET@CLOUD_NAME
cloudinary_url = os.getenv("CLOUDINARY_URL")
if cloudinary_url:
    cloudinary.config(cloudinary_url=cloudinary_url)
    print("✓ Cloudinary configured successfully")
else:
    print("⚠ WARNING: CLOUDINARY_URL not found in .env file")
    print("File uploads will fail until Cloudinary is configured.")


def upload_to_cloudinary(
    file_content: bytes,
    filename: str,
    group_id: str,
    resource_type: str = "auto"
) -> dict:
    """
    Upload a file to Cloudinary.
    
    Args:
        file_content: Raw file bytes
        filename: Original filename
        group_id: Group ID for folder organization
        resource_type: Cloudinary resource type ('auto', 'image', 'raw', 'video')
    
    Returns:
        dict with secure_url, public_id, resource_type, format, bytes
    """
    # Determine resource type based on file extension
    ext = Path(filename).suffix.lower()
    
    # PDFs, DOCX, PPTX etc. must be uploaded as 'raw' in Cloudinary
    if ext in [".pdf", ".doc", ".docx", ".ppt", ".pptx", ".txt", ".csv", ".xlsx"]:
        resource_type = "raw"
    elif ext in [".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"]:
        resource_type = "image"
    elif ext in [".mp4", ".mov", ".avi", ".webm", ".mkv"]:
        resource_type = "video"
    else:
        resource_type = "raw"
    
    # Create a temporary file to upload (Cloudinary SDK needs a file path or file-like object)
    tmp_file = None
    try:
        tmp_file = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
        tmp_file.write(file_content)
        tmp_file.flush()
        tmp_file.close()
        
        # Upload to Cloudinary with folder organization
        folder = f"lms/groups/{group_id}"
        
        result = cloudinary.uploader.upload(
            tmp_file.name,
            folder=folder,
            resource_type=resource_type,
            use_filename=True,
            unique_filename=True,
            overwrite=False,
            # For raw files, preserve the original filename
            public_id=Path(filename).stem if resource_type == "raw" else None,
        )
        
        return {
            "secure_url": result.get("secure_url"),
            "public_id": result.get("public_id"),
            "resource_type": result.get("resource_type"),
            "format": result.get("format"),
            "bytes": result.get("bytes", 0),
            "original_filename": result.get("original_filename", filename),
            "version": result.get("version"),
        }
    except Exception as e:
        print(f"Cloudinary upload error: {e}")
        raise Exception(f"Failed to upload file to cloud storage: {str(e)}")
    finally:
        # Clean up temp file
        if tmp_file and os.path.exists(tmp_file.name):
            try:
                os.unlink(tmp_file.name)
            except Exception:
                pass


def delete_from_cloudinary(public_id: str, resource_type: str = "raw") -> bool:
    """
    Delete a file from Cloudinary.
    
    Args:
        public_id: Cloudinary public ID of the file
        resource_type: The resource type ('image', 'raw', 'video')
    
    Returns:
        True if deleted successfully, False otherwise
    """
    try:
        result = cloudinary.uploader.destroy(
            public_id,
            resource_type=resource_type
        )
        return result.get("result") == "ok"
    except Exception as e:
        print(f"Cloudinary delete error: {e}")
        return False


def save_temp_file(file_content: bytes, filename: str) -> str:
    """
    Save file content to a temporary file for local processing (PDF text extraction, OCR).
    Returns the temp file path. Caller is responsible for cleanup.
    """
    ext = Path(filename).suffix.lower()
    tmp_file = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
    tmp_file.write(file_content)
    tmp_file.flush()
    tmp_file.close()
    return tmp_file.name


def cleanup_temp_file(file_path: str):
    """Remove a temporary file if it exists."""
    try:
        if file_path and os.path.exists(file_path):
            os.unlink(file_path)
    except Exception:
        pass


__all__ = [
    'upload_to_cloudinary',
    'delete_from_cloudinary',
    'save_temp_file',
    'cleanup_temp_file'
]
