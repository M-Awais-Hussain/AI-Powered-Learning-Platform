from bson import ObjectId
from typing import List, Dict, Any
import json
import time

from ..database import submissions_collection, quizzes_collection
from ..agents.topic_analyzer import analyze_topics_agent
from ..agents.base import llm


async def get_student_quiz_records(student_id: str, group_id: str) -> List[Dict[str, Any]]:
    """
    Fetch all quiz submissions for a student in a specific group with detailed stats.
    """
    # Find all quizzes for this group
    quizzes = list(quizzes_collection.find({"group_id": group_id}))
    quiz_map = {str(q["_id"]): q for q in quizzes}
    quiz_ids = list(quiz_map.keys())
    
    # Find all submissions for this student for these quizzes
    submissions = list(submissions_collection.find({
        "user_id": student_id,
        "quiz_id": {"$in": quiz_ids}
    }))
    
    results = []
    for sub in submissions:
        quiz_id = sub.get("quiz_id")
        quiz = quiz_map.get(quiz_id)
        if not quiz:
            continue
            
        grade = sub.get("grade", {})
        from ..crud import get_quiz_title
        results.append({
            "submission_id": str(sub["_id"]),
            "quiz_id": quiz_id,
            "quiz_name": get_quiz_title(quiz),
            "score": sub.get("score" or grade.get("score", 0)),
            "correct_count": grade.get("correct", 0),
            "total_questions": grade.get("total", len(quiz.get("questions", []))),
            "incorrect_count": grade.get("total", 0) - grade.get("correct", 0),
            "date": sub.get("submitted_at") or sub.get("timestamp", 0),
            "has_insights": "insights" in sub
        })
        
    # Sort by date descending
    results.sort(key=lambda x: x["date"], reverse=True)
    return results

async def generate_quiz_insights(submission_id: str) -> Dict[str, Any]:
    """
    Generate AI-powered insights for a specific quiz submission.
    Results are cached in the submission document.
    """
    submission = submissions_collection.find_one({"_id": ObjectId(submission_id)})
    if not submission:
        raise ValueError("Submission not found")
        
    # Check if insights already exist
    if "insights" in submission:
        return submission["insights"]
    
    quiz_id = submission.get("quiz_id")
    quiz = quizzes_collection.find_one({"_id": ObjectId(quiz_id)})
    if not quiz:
        raise ValueError("Quiz not found")
        
    questions = quiz.get("questions", [])
    student_answers = submission.get("answers", [])
    
    # Map answers by question_id for easy lookup
    ans_map = {str(a.get("question_id")): a for a in student_answers}
    
    # 1. Identify topics using the agent
    topic_analysis = analyze_topics_agent(questions)
    q_to_topic = topic_analysis.get("mapping", {})
    
    # 2. Calculate mastery per topic
    topic_stats = {} # {topic_name: {correct: X, total: Y}}
    
    for q in questions:
        q_id = str(q.get("id"))
        topic = q_to_topic.get(q_id, "General")
        
        if topic not in topic_stats:
            topic_stats[topic] = {"correct": 0, "total": 0}
            
        topic_stats[topic]["total"] += 1
        
        ans = ans_map.get(q_id)
        if ans and ans.get("correct"):
            topic_stats[topic]["correct"] += 1
            
    # Identify weak topics (score < 70%)
    weak_topics = []
    for topic, stats in topic_stats.items():
        mastery = (stats["correct"] / stats["total"]) * 100 if stats["total"] > 0 else 0
        if mastery < 70:
            weak_topics.append({
                "topic": topic,
                "mastery": round(mastery, 1),
                "correct": stats["correct"],
                "total": stats["total"]
            })
            
    # 3. Generate "Areas needing attention" using LLM
    attention_areas = "No major issues identified."
    if weak_topics and llm:
        weak_topics_str = ", ".join([f"{t['topic']} ({t['mastery']}%)" for t in weak_topics])
        prompt = f"""
        A student took a quiz and identified the following weak topics: {weak_topics_str}.
        Based on these topics, provide a concise (2-3 sentences) summary of what the student should focus on and how they can improve.
        Be specific but encouraging.
        """
        try:
            response = llm.invoke(prompt)
            attention_areas = response.content.strip()
        except Exception as e:
            print(f"Error generating attention areas: {e}")
            attention_areas = f"The student is struggling with {', '.join([t['topic'] for t in weak_topics])}. Further review of these areas is recommended."

    insights = {
        "weak_topics": weak_topics,
        "attention_areas": attention_areas,
        "generated_at": int(time.time()),
        "topic_all_stats": topic_stats
    }
    
    # Save insights to the submission
    submissions_collection.update_one(
        {"_id": ObjectId(submission_id)},
        {"$set": {"insights": insights}}
    )
    
    return insights
