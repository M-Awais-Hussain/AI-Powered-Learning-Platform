"""
Base LLM and Embeddings Configuration
Provides shared LLM and embedding instances for all agents
"""
import os
from typing import List
from langchain_groq import ChatGroq
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from dotenv import load_dotenv

load_dotenv()


# Initialize LLM
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    print("WARNING: GROQ_API_KEY not set. AI features will not work.")

try:
    llm = ChatGroq(model_name="llama-3.1-8b-instant", temperature=0.3, api_key=GROQ_API_KEY)
except Exception as e:
    print(f"Error initializing LLM: {e}")
    llm = None

# Initialize Embeddings
print("Initializing local embedding model (sentence-transformers/all-MiniLM-L6-v2)...")
try:
    try:
        from langchain_huggingface import HuggingFaceEmbeddings
        embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    except ImportError:
        print("WARNING: langchain-huggingface not found. Using community HuggingFaceEmbeddings fallback.")
        from langchain_community.embeddings import HuggingFaceEmbeddings
        embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
except Exception as e:
    print(f"CRITICAL WARNING: Failed to initialize local HuggingFace embeddings. Network issue? Error: {e}")
    print("WARNING: Vector store features will NOT work until this is resolved. Falling back to a dummy embedding model to prevent crashing.")
    
    class DummyEmbeddings:
        def embed_documents(self, texts: List[str]) -> List[List[float]]:
            return [[0.0] * 384 for _ in texts]
        def embed_query(self, text: str) -> List[float]:
            return [0.0] * 384
            
    embeddings = DummyEmbeddings()

# Text splitter for chunking documents
text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)

# Export all
__all__ = ['llm', 'embeddings', 'text_splitter']
