# 🎓 AI Learning Management System

A complete production-ready AI-powered Learning Management System built with FastAPI, React 19, MongoDB, LangChain, LangGraph, Cloudinary, and Redis.

## 📋 Features

### For Teachers
- **Group Management**: Create and manage multiple study groups with unique join codes.
- **Material Upload**: Upload lectures and course materials (PDF, DOCX, PPTX, Images) backed by reliable cloud storage.
- **AI Quiz Generation**: Automatically generate quizzes from uploaded materials.
- **Performance Analytics**: Track student progress with interactive charts and dashboards.
- **Real-time Insights**: Monitor weak areas and class performance trends with high-performance caching.

### For Students
- **Group Participation**: Join multiple groups using teacher-provided codes.
- **AI Tutor**: Chat with an AI tutor that understands your course materials.
- **Quiz Taking**: Take AI-generated quizzes with instant feedback.
- **Progress Tracking**: View your performance with visual analytics.
- **Note Management**: Create and organize study notes by category.

### Platform Wide
- **Secure Authentication**: JWT-based auth with email verification and password reset capabilities.
- **User Profiles**: Manage your account details seamlessly.
- **Robust Cloud Storage**: All media and files securely stored and delivered via Cloudinary.
- **Lightning Fast**: Frequently accessed analytics and insights cached with Upstash Redis.

### AI-Powered Features
- **Context-Aware Chatbot**: LangChain-powered AI tutor with group-specific knowledge.
- **Automatic Quiz Generation**: Generate MCQs and descriptive questions from materials.
- **Multi-Agent System**: 5 specialized AI agents working together via LangGraph.
- **OCR Support**: Extract text from images for processing.
- **Smart Embeddings**: FAISS vector stores for fast semantic search.
- **Intelligent Evaluation**: AI-powered quiz grading with detailed feedback.

## 🏗️ Tech Stack

### Backend
- **FastAPI**: Modern, fast web framework for Python.
- **MongoDB**: NoSQL database for flexible data storage.
- **LangChain & LangGraph**: Framework for building stateful, multi-agent AI applications.
- **Groq API**: High-performance LLM inference.
- **HuggingFace**: State-of-the-art embeddings.
- **FAISS**: Efficient similarity search.
- **Cloudinary**: Scalable cloud storage for media and document uploads.
- **Upstash Redis**: Serverless REST-based Redis for caching analytics and insights.
- **Python SMTP**: Integrated email service for notifications and account verification.
- **Tesseract OCR**: Text extraction from images.
- **PyPDF2**: PDF processing.
- **JWT Authentication**: Secure user authentication.

### Frontend
- **React 19**: Modern UI library with modular component architecture.
- **React Router v7**: Client-side routing with role-based protected routes.
- **Axios**: HTTP client.
- **Recharts**: Beautiful charts and analytics.
- **Bootstrap 5 & React Bootstrap**: Responsive UI components.
- **Custom Design System**: Modular CSS with tokens (`tokens.css`), utility classes (`utilities.css`), and micro-animations (`animations.css`) for a premium Glassmorphism aesthetic.

## 🤖 AI Agents Architecture

This project utilizes a sophisticated multi-agent system powered by **LangGraph** to deliver personalized learning experiences. The system consists of 5 specialized agents:

1. **Chat Tutor Agent**: Acts as a knowledgeable tutor for specific study groups using RAG.
2. **Quiz Generation Agent**: Automatically creates assessments based on course content.
3. **Evaluation Agent**: Grades student submissions with human-like precision.
4. **Feedback Agent**: Delivers personalized study advice based on performance trends.
5. **Teacher Dashboard Agent**: Aggregates complex analytics for instructors.

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Node.js 16+
- MongoDB Atlas account (or local MongoDB)
- Groq API key
- Cloudinary Account
- Upstash Redis Account
- HuggingFace API key (optional)

### Backend Setup

1. **Navigate to backend directory**
```bash
cd backend
```

2. **Create virtual environment**
```bash
python -m venv myenv
# Windows
myenv\Scripts\activate
# Linux/Mac
source myenv/bin/activate
```

3. **Install dependencies**
```bash
pip install -r requirements.txt
```

4. **Configure environment variables**
Create a `.env` file in the backend directory:

```env
# MongoDB Connection
MONGODB_URI=mongodb+srv://...

# JWT Secret
SECRET_KEY=your-secret-key-minimum-32-characters-long

# AI APIs
GROQ_API_KEY=your_groq_api_key
HUGGINGFACE_API_KEY=your_huggingface_api_key

# Cloud Storage
CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME

# Caching (Upstash REST API)
UPSTASH_REDIS_REST_URL=your_upstash_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_token

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=your_app_password
SMTP_FROM_EMAIL=noreply@yourdomain.com

# Tesseract OCR Path (adjust for your OS)
TESSERACT_PATH=C:\\Program Files\\Tesseract-OCR\\tesseract.exe
```

5. **Run the backend server**
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup

1. **Navigate to frontend directory**
```bash
cd frontend
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment**
Create a `.env` file in the frontend directory:
```env
REACT_APP_API_URL=http://localhost:8000
```

4. **Run the development server**
```bash
npm start
```

## 📁 Project Structure

```text
learning-platform/
├── backend/
│   ├── app/
│   │   ├── agents/           # AI Multi-agent workflow logic
│   │   ├── routes/           # Modular FastAPI route handlers
│   │   ├── schemas/          # Pydantic validation models
│   │   ├── services/         # Business logic (Cloudinary, Redis, Email)
│   │   ├── auth.py           # JWT authentication utilities
│   │   ├── crud.py           # Database operations
│   │   ├── database.py       # MongoDB connection setup
│   │   └── main.py           # App entry point
│   └── requirements.txt
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── auth/             # Authentication components & contexts
│   │   ├── pages/            # Shared full pages (e.g., Profile, GroupSelector)
│   │   ├── routes/           # Routing configuration (AppRoutes.jsx)
│   │   ├── shared/           # Reusable components, hooks, utils
│   │   ├── studentDashboard/ # Student-specific features
│   │   ├── teacherDashboard/ # Teacher-specific features
│   │   ├── styles/           # CSS Tokens, Animations, Utilities
│   │   └── App.js            # Main React component
│   └── package.json
└── README.md
```

## 📊 API Architecture

The backend exposes a comprehensive RESTful API structured around modular routers:
- **`/auth`**: Login, Registration, Email Verification, Password Reset.
- **`/groups`**: Group creation, joining, and management.
- **`/materials`**: Cloudinary-backed file uploads and retrieval.
- **`/chat`**: Conversational RAG with LangChain.
- **`/quizzes`**: AI-generation, taking, and automated grading.
- **`/analytics`**: Redis-cached performance metrics for students and teachers.
- **`/notes`**: Study note organization.
- **`/profile`**: User profile management.

## 🚀 Deployment

### Docker Deployment (Recommended)

Backend `Dockerfile` is included. You can use Docker Compose to run the entire stack:
```yaml
version: '3.8'
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - MONGODB_URI=${MONGODB_URI}
      - SECRET_KEY=${SECRET_KEY}
      - GROQ_API_KEY=${GROQ_API_KEY}
      - CLOUDINARY_URL=${CLOUDINARY_URL}
      - UPSTASH_REDIS_REST_URL=${UPSTASH_REDIS_REST_URL}
      - UPSTASH_REDIS_REST_TOKEN=${UPSTASH_REDIS_REST_TOKEN}
      - SMTP_USER=${SMTP_USER}
      - SMTP_PASSWORD=${SMTP_PASSWORD}
  
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend
```

## 🔐 Security Features

- **JWT Authentication**
- **Password Hashing**: bcrypt
- **Role-Based Access Control (RBAC)**
- **Email Verification required for full access**
- **Secure Password Reset Flow**
- **CORS Protection**
- **Signed Cloud Storage Uploads**

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a PR with a clear description of your changes.

## 📄 License

This project is licensed under the MIT License.
