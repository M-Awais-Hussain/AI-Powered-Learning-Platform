"""
FastAPI Main Application
Learning Platform Backend - Modularized Entry Point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import db
from .routes import api_router

# Initialize FastAPI app
app = FastAPI(
    title="Learning Platform API",
    description="AI-powered learning management platform",
    version="1.0.0"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register all modular routes
# Includes auth, profile, groups, materials, chat, quizzes, analytics, notifications, and notes
app.include_router(api_router)


# ==================== CORE ENDPOINTS ====================

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "Learning Platform API", "status": "running"}


@app.get("/health")
async def health_check():
    """Detailed health check for backend and database"""
    try:
        # Check database connectivity
        db.command('ping')
        db_status = "connected"
    except Exception:
        db_status = "disconnected"
    
    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "database": db_status,
        "version": "1.0.0"
    }
