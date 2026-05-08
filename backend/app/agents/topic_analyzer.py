"""
Topic Analyzer Agent
Analyzes quiz questions to identify granular learning topics using LLM structured output.
"""
from typing import List, Dict, Any
from langchain_core.prompts import ChatPromptTemplate
import json
import re

from .base import llm

from functools import lru_cache
import hashlib

# Simple in-memory cache for topic analysis results
# Max 100 recent quiz configurations
topic_analysis_cache = {}

def get_questions_hash(questions: List[Dict[str, Any]]) -> str:
    """Generate a stable hash for a list of questions based on their IDs and text."""
    stable_repr = "|".join([ f"{q.get('id', '')}:{q.get('question', '')[:50]}" for q in questions ])
    return hashlib.md5(stable_repr.encode('utf-8')).hexdigest()

def analyze_topics_agent(questions: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Categorizes quiz questions into granular topics.
    Each question should have at least 'question' and 'id'.
    """
    if not llm:
        return {"mapping": {}, "topics": []}
    
    if not questions:
        return {"mapping": {}, "topics": []}
        
    # Check cache first
    q_hash = get_questions_hash(questions)
    if q_hash in topic_analysis_cache:
        return topic_analysis_cache[q_hash]

    system_prompt = """
    You are an expert educational analyst. Your task is to analyze a list of quiz questions and group them into 3-6 granular, coherent learning topics.
    
    Return the result as a JSON object with:
    1. "topics": A list of strings representing the identified topic names.
    2. "mapping": An object where keys are the question "id" (as strings) and values are the name of the topic from your list.

    Ensure every question ID provided is mapped to exactly one topic from your list.
    Use specific, academic topic names (e.g., "Calculus: Derivatives", "Neural Networks: Activation Functions").
    """

    # Limit questions to avoid token overflow — LLM must produce one mapping entry per question
    MAX_QUESTIONS = 30
    truncated = questions[:MAX_QUESTIONS] if len(questions) > MAX_QUESTIONS else questions

    user_content = json.dumps([
        {"id": str(q.get("id", idx)), "text": q.get("question", "")[:150]}
        for idx, q in enumerate(truncated)
    ])

    prompt = ChatPromptTemplate.from_messages([
        ("system", system_prompt),
        ("user", "Analyze these questions: {questions}")
    ])

    try:
        # Bind with explicit max_tokens to prevent truncated JSON output
        chain = prompt | llm.bind(
            response_format={"type": "json_object"},
            max_tokens=2048
        )
        response = chain.invoke({"questions": user_content})
        
        content = response.content.strip() if hasattr(response, 'content') else str(response)
        
        # Robust parsing
        try:
            result = json.loads(content)
        except json.JSONDecodeError:
            # Fallback regex if it contains extra text
            json_match = re.search(r'(\{.*\})', content, re.DOTALL)
            if json_match:
                result = json.loads(json_match.group(1))
            else:
                raise ValueError("Could not find valid JSON in LLM response")

        # Save to cache
        topic_analysis_cache[q_hash] = result
        # Simple cache eviction (keep under 100 entries)
        if len(topic_analysis_cache) > 100:
            # Remove oldest entry (dictionaries preserve insertion order in Python 3.7+)
            topic_analysis_cache.pop(next(iter(topic_analysis_cache)))
            
        return result
    except Exception as e:
        print(f"Topic analysis error: {e}")
        # Return empty mapping on failure
        return {"mapping": {}, "topics": []}

__all__ = ['analyze_topics_agent']
