"""
Quiz Generation Agent
Generates quizzes from group materials using LLM
"""
from typing import TypedDict, Optional, List
import json
import re

from langchain_core.prompts import ChatPromptTemplate

from .base import llm
from .vectorstore import get_vectorstore
from ..database import materials_collection


class QuizState(TypedDict):
    group_id: str
    user_id: Optional[str]
    settings: Optional[dict]
    question_type: Optional[str]
    num_questions: Optional[int]
    difficulty: Optional[str]
    materials: Optional[List[dict]]
    output: Optional[dict]


def generate_fallback_questions(count: int, q_type: str, difficulty: str) -> List[dict]:
    """Generate placeholder questions when LLM fails"""
    q_type_map = {"MCQ": "multiple_choice", "True/False": "true_false", "Short Answer": "short_answer"}
    base_type = q_type_map.get(q_type, "multiple_choice")
    
    questions = []
    for i in range(min(count, 10)):
        q = {
            "id": i + 1,
            "type": base_type,
            "question": f"Question {i + 1}: Based on the course materials, what is a key concept?",
            "correct_answer": 0 if base_type != "short_answer" else "Answer based on materials",
            "explanation": "This is a placeholder question.",
            "difficulty": difficulty.lower() if isinstance(difficulty, str) else "medium",
            "topic": "General"
        }
        
        if base_type == "multiple_choice":
            q["options"] = ["Option A", "Option B", "Option C", "Option D"]
        elif base_type == "true_false":
            q["options"] = ["True", "False"]
        else:
            q["sample_answer"] = "A brief answer based on the materials"
            q["key_points"] = ["Point 1", "Point 2"]
        
        questions.append(q)
    return questions


def quiz_generation_agent(state: QuizState) -> dict:
    """Generate quiz questions from group materials"""
    settings = state.get("settings", {})
    question_type = state.get("question_type") or settings.get("question_type", "MCQ")
    num_questions = int(state.get("num_questions") or settings.get("question_count", 10))
    difficulty = state.get("difficulty") or settings.get("difficulty", "Medium")
    
    num_questions = max(1, min(30, num_questions))
    
    if not llm:
        print("WARNING: LLM not initialized in base.py. Falling back to placeholder questions.")
        return {"output": {"questions": generate_fallback_questions(num_questions, question_type, difficulty)}}
    
    # Get context from materials
    context = ""
    material_titles = []
    
    if state.get("materials"):
        print(f"DEBUG: Using {len(state['materials'])} provided materials for quiz generation.")
        context = "\n".join([mat["content"] for mat in state["materials"] if mat.get("content")])
        material_titles = [mat.get("lecture_title", mat.get("filename", "")) for mat in state["materials"]]
    else:
        print(f"DEBUG: No specific materials provided for group {state['group_id']}. Attempting vector search and database fallback.")
        try:
            # 1. Try vector store search
            vectorstore = get_vectorstore(state["group_id"])
            docs = []
            if vectorstore:
                docs = vectorstore.similarity_search("", k=min(20, num_questions * 2))
                print(f"DEBUG: Vector search returned {len(docs)} documents.")
            
            # 2. If vector search returns nothing, fetch ALL materials from DB
            if not docs:
                print(f"DEBUG: Vector store empty or search failed. Fetching all materials from DB for group {state['group_id']}.")
                db_materials = list(materials_collection.find({"group_id": state["group_id"]}))
                print(f"DEBUG: Found {len(db_materials)} materials in database.")
                context = "\n".join([m.get("content", "") for m in db_materials if m.get("content")])
                material_titles = [m.get("lecture_title", m.get("filename", "Material")) for m in db_materials]
            else:
                context = "\n".join([doc.page_content for doc in docs if doc.page_content.strip()])
                material_titles = ["Group Materials (Search Results)"]
                
        except Exception as e:
            print(f"ERROR: Exception in context fetching for quiz generation: {e}")
            context = ""
            material_titles = []
    
    if not context.strip():
        print(f"WARNING: No content context found for group {state['group_id']}. Falling back to placeholder questions.")
        return {"output": {"questions": generate_fallback_questions(num_questions, question_type, difficulty)}}
    
    print(f"DEBUG: Context length for generation: {len(context)} chars. Generating questions...")
    
    # Build prompt
    q_type_map = {"MCQ": "multiple_choice", "True/False": "true_false", "Short Answer": "short_answer", "Mixed": "mixed"}
    q_type = q_type_map.get(question_type, "multiple_choice")
    
    # Build type-specific prompt
    if question_type == "True/False" or q_type == "true_false":
        type_example = '''{
            "id": 1,
            "type": "true_false",
            "question": "Python is a compiled language.",
            "options": ["True", "False"],
            "correct_answer": 1,
            "explanation": "Python is an interpreted language, not compiled.",
            "difficulty": "easy",
            "topic": "Python Basics"
        }'''
    elif question_type == "Short Answer" or q_type == "short_answer":
        type_example = '''{
            "id": 1,
            "type": "short_answer",
            "question": "Explain the concept of inheritance in OOP.",
            "sample_answer": "Inheritance allows a class to inherit properties and methods from another class.",
            "key_points": ["parent/child relationship", "code reuse", "extends keyword"],
            "correct_answer": "A mechanism where one class inherits properties from another",
            "explanation": "Inheritance is a fundamental OOP concept.",
            "difficulty": "medium",
            "topic": "OOP"
        }'''
    elif question_type == "Mixed":
        type_example = '''For mixed type, vary between multiple_choice, true_false, and short_answer types.
        Multiple Choice example:
        {"id": 1, "type": "multiple_choice", "question": "...", "options": ["A", "B", "C", "D"], "correct_answer": 0, ...}
        True/False example:
        {"id": 2, "type": "true_false", "question": "...", "options": ["True", "False"], "correct_answer": 0, ...}
        Short Answer example:
        {"id": 3, "type": "short_answer", "question": "...", "sample_answer": "...", "key_points": [...], ...}'''
    else:  # MCQ default
        type_example = '''{
            "id": 1,
            "type": "multiple_choice",
            "question": "What is the capital of France?",
            "options": ["London", "Paris", "Berlin", "Madrid"],
            "correct_answer": 1,
            "explanation": "Paris is the capital of France.",
            "difficulty": "easy",
            "topic": "Geography"
        }'''
    
    prompt = ChatPromptTemplate.from_template(
        """You are an expert quiz creator. Generate exactly {num_questions} {question_type} questions based on the content.

Content to create questions from:
{context}

Difficulty Level: {difficulty}

IMPORTANT: Generate {question_type} type questions. Use this exact structure:
{type_example}

Return ONLY valid JSON with this structure:
{{
    "questions": [
        ... {num_questions} questions following the structure above ...
    ]
}}

Rules:
- Each question must be unique and based on the provided content
- For multiple_choice: provide exactly 4 options, correct_answer is 0-3 index
- For true_false: options must be ["True", "False"], correct_answer is 0 or 1
- For short_answer: include sample_answer and key_points array
- Match the difficulty level: {difficulty}
- Return ONLY the JSON, no other text"""
    )
    
    try:
        chain = prompt | llm.bind(max_tokens=3000)
        response = chain.invoke({
            "context": context[:6000],
            "question_type": question_type,
            "num_questions": num_questions,
            "difficulty": difficulty.lower(),
            "type_example": type_example
        })
        
        content = response.content.strip() if hasattr(response, 'content') else str(response)
        json_match = re.search(r'\{.*"questions".*\}', content, re.DOTALL)
        if json_match:
            content = json_match.group(0)
        
        questions_data = json.loads(content)
        questions = questions_data.get("questions", [])
        
        # Ensure proper structure
        for i, q in enumerate(questions):
            q.setdefault("id", i + 1)
            q.setdefault("type", q_type if q_type != "mixed" else "multiple_choice")
            q.setdefault("explanation", "")
            q.setdefault("difficulty", difficulty.lower())
            q.setdefault("topic", "General")
        
        return {"output": {"questions": questions[:num_questions]}}
    except Exception as e:
        print(f"Quiz generation error: {e}")
        return {"output": {"questions": generate_fallback_questions(num_questions, question_type, difficulty)}}


__all__ = ['quiz_generation_agent', 'QuizState', 'generate_fallback_questions']
