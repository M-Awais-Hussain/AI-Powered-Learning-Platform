"""
Utility Functions
OCR, PDF processing, and summarization utilities
"""
import pytesseract
from PIL import Image
import PyPDF2
from langchain_core.prompts import ChatPromptTemplate
from langchain_community.document_loaders import (
    PyPDFLoader, Docx2txtLoader, UnstructuredPowerPointLoader
)

from .base import llm

# Windows Tesseract path configuration
pytesseract.pytesseract.tesseract_cmd = r'C:\\Program Files\\Tesseract-OCR\\tesseract.exe'


def summarize_notes(content: str, source: str) -> str:
    """Summarize content into concise bullet points"""
    if not llm:
        return "Summarization not available. Please configure API keys."
    
    prompt = ChatPromptTemplate.from_template(
        "Summarize this content into concise bullet points: {content}"
    )
    
    try:
        chain = prompt | llm
        response = chain.invoke({"content": content[:5000]})
        return response.content
    except Exception as e:
        print(f"Summarization error: {e}")
        return "Could not generate summary."


def process_ocr(image_path: str) -> str:
    """Extract text from image using OCR"""
    try:
        image = Image.open(image_path)
        text = pytesseract.image_to_string(image)
        return text
    except Exception as e:
        print(f"OCR error: {e}")
        return ""


def process_pdf(file_path: str) -> str:
    """Extract text from PDF file"""
    content = ""
    try:
        loader = PyPDFLoader(file_path)
        docs = loader.load()
        content = "\n".join([doc.page_content for doc in docs])
    except Exception as e:
        print(f"PDF processing error: {e}")
    return content

def process_docx(file_path: str) -> str:
    """Extract text from DOC/DOCX file"""
    content = ""
    try:
        loader = Docx2txtLoader(file_path)
        docs = loader.load()
        content = "\n".join([doc.page_content for doc in docs])
    except Exception as e:
        print(f"DOCX processing error: {e}")
    return content

def process_pptx(file_path: str) -> str:
    """Extract text from PPT/PPTX file"""
    content = ""
    try:
        loader = UnstructuredPowerPointLoader(file_path)
        docs = loader.load()
        content = "\n".join([doc.page_content for doc in docs])
    except Exception as e:
        print(f"PPTX processing error: {e}")
    return content


__all__ = ['summarize_notes', 'process_ocr', 'process_pdf', 'process_docx', 'process_pptx']
