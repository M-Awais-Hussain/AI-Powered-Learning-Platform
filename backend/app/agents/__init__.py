"""
Agents Package
AI agents for the Learning Platform
"""

# Import from modular files
from .base import llm, embeddings, text_splitter
from .vectorstore import get_vectorstore, update_vectorstore
from .quiz_generator import quiz_generation_agent
from .evaluator import evaluation_agent, feedback_agent, teacher_dashboard_agent
from .utils import summarize_notes, process_ocr, process_pdf, process_docx, process_pptx
from .workflow import agent_workflow, AgentState

# Export all for backwards compatibility
__all__ = [
    # Base
    'llm',
    'embeddings', 
    'text_splitter',
    # Vectorstore
    'get_vectorstore',
    'update_vectorstore',
    # Agents
    'quiz_generation_agent',
    'evaluation_agent',
    'feedback_agent',
    'teacher_dashboard_agent',
    # Utils
    'summarize_notes',
    'process_ocr',
    'process_pdf',
    'process_docx',
    'process_pptx',
    # Workflow
    'agent_workflow',
    'AgentState'
]
