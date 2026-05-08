"""
Vector Store Management
Handles FAISS vector stores for group materials
"""
import os
from typing import Dict
from langchain_community.vectorstores import FAISS
from bson import ObjectId

from .base import embeddings, text_splitter
from ..database import materials_collection, groups_collection


# In-memory cache for vector stores
vectorstores: Dict[str, FAISS] = {}


def get_vectorstore(group_id: str, force_reload: bool = False):
    """
    Get or create a persistent vector store for a group.
    Stores FAISS index on disk under /vectorstores/{group_id}/
    """
    global vectorstores
    
    if not force_reload and group_id in vectorstores:
        return vectorstores[group_id]
    
    persist_directory = f"./vectorstores/{group_id}"
    
    # Try to load existing vectorstore
    if os.path.exists(persist_directory) and not force_reload:
        try:
            vs = FAISS.load_local(persist_directory, embeddings, allow_dangerous_deserialization=True)
            vectorstores[group_id] = vs
            return vs
        except Exception as e:
            print(f"Could not load existing vectorstore for {group_id}: {e}")
    
    # Build from database
    materials = list(materials_collection.find({"group_id": group_id}))
    if not materials:
        return None
    
    texts = []
    metadatas = []
    
    for mat in materials:
        content = mat.get("content", "")
        if content:
            chunks = text_splitter.split_text(content)
            for chunk in chunks:
                texts.append(chunk)
                metadatas.append({
                    "material_id": str(mat["_id"]),
                    "filename": mat.get("filename", ""),
                    "type": mat.get("type", ""),
                    "category": mat.get("category", "General")
                })
    
    if not texts:
        return None
    
    try:
        vs = FAISS.from_texts(texts, embeddings, metadatas=metadatas)
        os.makedirs(persist_directory, exist_ok=True)
        vs.save_local(persist_directory)
        vectorstores[group_id] = vs
        return vs
    except Exception as e:
        print(f"Error creating vectorstore: {e}")
        return None


def update_vectorstore(group_id: str, new_content: str = None):
    """
    Update a group's vector store with new content.
    Rebuilds the vectorstore from ALL materials in the database.
    """
    global vectorstores
    
    materials = list(materials_collection.find({"group_id": group_id}))
    if not materials:
        return None
    
    texts = []
    metadatas = []
    
    for mat in materials:
        content = mat.get("content", "")
        if content:
            chunks = text_splitter.split_text(content)
            for chunk in chunks:
                texts.append(chunk)
                metadatas.append({
                    "material_id": str(mat["_id"]),
                    "filename": mat.get("filename", ""),
                    "type": mat.get("type", ""),
                    "category": mat.get("category", "General")
                })
    
    if not texts:
        return None
    
    try:
        vs = FAISS.from_texts(texts, embeddings, metadatas=metadatas)
        persist_directory = f"./vectorstores/{group_id}"
        os.makedirs(persist_directory, exist_ok=True)
        vs.save_local(persist_directory)
        vectorstores[group_id] = vs
        
        # Update group document
        groups_collection.update_one(
            {"_id": ObjectId(group_id)},
            {"$set": {"vector_store_path": persist_directory, "last_vectorstore_update": __import__('time').time()}}
        )
        
        return vs
    except Exception as e:
        print(f"Error updating vectorstore: {e}")
        return None


__all__ = ['get_vectorstore', 'update_vectorstore', 'vectorstores']
