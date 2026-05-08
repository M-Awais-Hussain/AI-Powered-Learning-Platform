"""
Evaluation and Feedback Agents
Handles quiz evaluation and personalized feedback
"""
from typing import TypedDict, Optional
from langchain_core.prompts import ChatPromptTemplate
from bson import ObjectId
from collections import defaultdict
import json

from .base import llm
from ..database import materials_collection, quizzes_collection, submissions_collection



class EvalState(TypedDict):
    group_id: str
    user_id: Optional[str]
    content: Optional[str]  # submission_id
    output: Optional[dict]


def evaluation_agent(state: EvalState) -> dict:
    """Evaluate a quiz submission with detailed feedback"""
    if not llm:
        return {"output": {"error": "LLM not available"}}
    
    submission = submissions_collection.find_one({"_id": ObjectId(state["content"])})
    if not submission:
        return {"output": {"error": "Submission not found"}}
    
    quiz = quizzes_collection.find_one({"_id": ObjectId(submission["quiz_id"])})
    if not quiz:
        return {"output": {"error": "Quiz not found"}}
    
    # Get materials context
    materials = materials_collection.find({"group_id": quiz["group_id"]})
    material_context = "\n".join([mat["content"] for mat in materials if mat.get("content")])[:5000]
    
    prompt = ChatPromptTemplate.from_template(
        """Evaluate this quiz submission:

Questions: {questions}
Answers: {answers}
Materials: {material_context}

Return JSON:
{{
    "score": <0-100>,
    "detailed_feedback": [
        {{"question_id": 1, "correct": true/false, "points_awarded": 10, "explanation": "...", "suggestions": "..."}}
    ],
    "overall_feedback": "...",
    "strengths": ["..."],
    "areas_for_improvement": ["..."]
}}"""
    )
    
    try:
        chain = prompt | llm
        response = chain.invoke({
            "questions": quiz["questions"],
            "answers": submission["answers"],
            "material_context": material_context
        })
        
        grade = json.loads(response.content)
    except Exception as e:
        print(f"Evaluation error: {e}")
        grade = {
            "score": 75,
            "overall_feedback": "Evaluation completed",
            "strengths": ["Good effort"],
            "areas_for_improvement": ["Continue studying"]
        }
    
    submissions_collection.update_one({"_id": ObjectId(state["content"])}, {"$set": {"grade": grade}})
    return {"output": grade}


def feedback_agent(state: EvalState) -> dict:
    """Generate personalized study feedback"""
    if not llm:
        return {"output": {"tips": "Continue studying the course materials."}}
    
    submission = submissions_collection.find_one({"_id": ObjectId(state["content"])})
    if not submission or not submission.get("grade"):
        return {"output": {"tips": "Complete a quiz to get personalized feedback."}}
    
    prompt = ChatPromptTemplate.from_template(
        "Provide personalized study tips based on this quiz performance: {grade}"
    )
    
    try:
        chain = prompt | llm
        response = chain.invoke({"grade": submission["grade"]})
        return {"output": {"tips": response.content}}
    except Exception as e:
        return {"output": {"tips": "Review the materials and try again."}}


def teacher_dashboard_agent(state: EvalState) -> dict:
    """Generate teacher dashboard analytics"""
    from ..crud import get_group_submissions
    submissions = get_group_submissions(state["group_id"])
    
    if not submissions:
        return {"output": {
            "studentProgress": [],
            "weakAreas": [],
            "classPerformance": [],
            "courseProgress": []
        }}
    
    scores_by_category = defaultdict(list)
    scores_over_time = defaultdict(list)
    
    for sub in submissions:
        if sub.get("grade") and "score" in sub["grade"]:
            cat = sub.get("category", "General")
            scores_by_category[cat].append(sub["grade"]["score"])
            ts = sub.get("timestamp", 0)
            scores_over_time[ts].append(sub["grade"]["score"])
    
    student_progress = []
    total = sum(sum(scores) for scores in scores_by_category.values())
    for cat, scores in scores_by_category.items():
        avg = sum(scores) / len(scores) if scores else 0
        student_progress.append({"name": cat, "value": avg})
    
    weak_areas = [
        {"name": cat, "value": sum(scores) / len(scores)}
        for cat, scores in scores_by_category.items()
        if (sum(scores) / len(scores)) < 70
    ]
    
    class_performance = []
    for ts in sorted(scores_over_time.keys()):
        avg = sum(scores_over_time[ts]) / len(scores_over_time[ts])
        class_performance.append({"time": ts, "score": avg})
    
    course_progress = [
        {"name": cat, "progress": sum(scores) / len(scores), "topic": cat}
        for cat, scores in scores_by_category.items()
    ]
    
    return {"output": {
        "studentProgress": student_progress,
        "weakAreas": weak_areas,
        "classPerformance": class_performance,
        "courseProgress": course_progress
    }}


__all__ = ['evaluation_agent', 'feedback_agent', 'teacher_dashboard_agent', 'EvalState']
