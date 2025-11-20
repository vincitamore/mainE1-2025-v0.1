# MainE1 Implementation Plan

> **Step-by-step guide to building the N² Overmind Platform**

**Target:** Complete Phase 1 & 2 (Weeks 1-10)  
**Outcome:** Working MVP with frontend, backend, and core cognitive engine

---

## Prerequisites

### Development Environment
```bash
# Required software
- Python 3.11+
- Node.js 18+
- pnpm 8+
- Docker & Docker Compose
- PostgreSQL 15+ (or via Docker)
- Redis 7+ (or via Docker)
- Git

# Recommended tools
- VS Code with extensions (Python, TypeScript, Docker)
- Postman or Insomnia (API testing)
- pgAdmin or DBeaver (database management)
- Redis Insight (Redis GUI)
```

### API Keys
- OpenAI API key (required)
- Anthropic API key (optional, for Claude support)

---

## Step 1: Project Initialization (Day 1)

### 1.1 Create Project Structure

```bash
# Create root directory
mkdir maine1-platform
cd maine1-platform

# Initialize Git
git init
git branch -M main

# Create directory structure
mkdir -p backend/{app/{api,core,models,services,schemas},tests,alembic}
mkdir -p frontend/{src/{app,components,lib,hooks,types},public}
mkdir -p docs
mkdir -p scripts
mkdir -p .github/workflows

# Create .gitignore
cat > .gitignore << 'EOF'
# Python
__pycache__/
*.py[cod]
*$py.class
.env
.venv/
venv/
*.egg-info/
.pytest_cache/

# Node
node_modules/
.next/
out/
*.log
.pnpm-store/

# IDEs
.vscode/
.idea/
*.swp

# OS
.DS_Store
Thumbs.db

# Build
dist/
build/
*.dump
EOF
```

### 1.2 Set Up Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg15
    container_name: maine1-postgres
    environment:
      POSTGRES_USER: maine1
      POSTGRES_PASSWORD: dev_password
      POSTGRES_DB: maine1_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U maine1"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: maine1-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: maine1-backend
    environment:
      - DATABASE_URL=postgresql://maine1:dev_password@postgres:5432/maine1_db
      - REDIS_URL=redis://redis:6379/0
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: maine1-frontend
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8000
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
      - /app/node_modules
      - /app/.next
    depends_on:
      - backend
    command: pnpm dev

volumes:
  postgres_data:
  redis_data:
```

### 1.3 Create Environment Files

```bash
# .env.example
# Database
DATABASE_URL=postgresql://maine1:dev_password@localhost:5432/maine1_db
REDIS_URL=redis://localhost:6379/0

# LLM Providers
OPENAI_API_KEY=sk-your-key-here
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Security
JWT_SECRET=your-secret-key-here-change-in-production
JWT_ALGORITHM=HS256
JWT_EXPIRATION_SECONDS=3600

# Application
ENVIRONMENT=development
LOG_LEVEL=INFO
CORS_ORIGINS=http://localhost:3000

# Copy and fill with real values
cp .env.example .env
```

---

## Step 2: Backend Setup (Days 2-3)

### 2.1 Initialize Python Project

```bash
cd backend

# Create pyproject.toml
cat > pyproject.toml << 'EOF'
[tool.poetry]
name = "maine1-backend"
version = "0.1.0"
description = "MainE1 N² Overmind Backend"
authors = ["Your Name <you@example.com>"]

[tool.poetry.dependencies]
python = "^3.11"
fastapi = "^0.104.0"
uvicorn = {extras = ["standard"], version = "^0.24.0"}
sqlalchemy = "^2.0.0"
alembic = "^1.12.0"
asyncpg = "^0.29.0"
psycopg2-binary = "^2.9.9"
redis = "^5.0.0"
pydantic = {extras = ["email"], version = "^2.5.0"}
pydantic-settings = "^2.1.0"
python-jose = {extras = ["cryptography"], version = "^3.3.0"}
passlib = {extras = ["bcrypt"], version = "^1.7.4"}
python-multipart = "^0.0.6"
langchain = "^0.1.0"
langchain-openai = "^0.0.2"
langchain-anthropic = "^0.0.1"
crewai = "^0.1.0"
openai = "^1.3.0"
anthropic = "^0.7.0"
python-socketio = "^5.10.0"
celery = {extras = ["redis"], version = "^5.3.4"}
python-dotenv = "^1.0.0"
httpx = "^0.25.0"

[tool.poetry.group.dev.dependencies]
pytest = "^7.4.0"
pytest-asyncio = "^0.21.0"
pytest-cov = "^4.1.0"
black = "^23.10.0"
ruff = "^0.1.0"
mypy = "^1.6.0"

[build-system]
requires = ["poetry-core"]
build-backend = "poetry.core.masonry.api"

[tool.black]
line-length = 100
target-version = ['py311']

[tool.ruff]
line-length = 100
select = ["E", "F", "I", "N", "UP"]

[tool.mypy]
python_version = "3.11"
strict = true
EOF

# Install dependencies
pip install poetry
poetry install
```

### 2.2 Create Backend Structure

```bash
# App structure
cd app

# __init__.py files
touch __init__.py
touch api/__init__.py
touch core/__init__.py
touch models/__init__.py
touch services/__init__.py
touch schemas/__init__.py

# Core configuration
cat > core/config.py << 'EOF'
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str
    REDIS_URL: str
    
    # Security
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_SECONDS: int = 3600
    
    # LLM Providers
    OPENAI_API_KEY: str
    ANTHROPIC_API_KEY: str | None = None
    
    # Application
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
EOF

# Database connection
cat > core/database.py << 'EOF'
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from .config import settings

# Convert postgresql:// to postgresql+asyncpg://
DATABASE_URL = settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

engine = create_async_engine(
    DATABASE_URL,
    echo=settings.ENVIRONMENT == "development",
    pool_size=20,
    max_overflow=10,
)

async_session_maker = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

Base = declarative_base()

async def get_db() -> AsyncSession:
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()
EOF
```

### 2.3 Create Main Application

```python
# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging

from app.core.config import settings
from app.api import auth, conversations, agents, health

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    logger.info("Starting MainE1 Backend...")
    # Startup logic here
    yield
    logger.info("Shutting down MainE1 Backend...")
    # Cleanup logic here

app = FastAPI(
    title="MainE1 API",
    description="N² Overmind Platform API",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, prefix="/health", tags=["Health"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(conversations.router, prefix="/api/v1/conversations", tags=["Conversations"])
app.include_router(agents.router, prefix="/api/v1/agents", tags=["Agents"])

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Global exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )

@app.get("/")
async def root():
    return {
        "name": "MainE1 API",
        "version": "0.1.0",
        "status": "operational"
    }
```

### 2.4 Create Health Check Endpoint

```python
# app/api/health.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import redis.asyncio as redis

from app.core.database import get_db
from app.core.config import settings

router = APIRouter()

@router.get("")
async def health_check(db: AsyncSession = Depends(get_db)):
    """Comprehensive health check"""
    checks = {
        "api": "ok",
        "database": "unknown",
        "redis": "unknown",
    }
    
    # Check database
    try:
        result = await db.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {str(e)}"
    
    # Check Redis
    try:
        r = redis.from_url(settings.REDIS_URL)
        await r.ping()
        checks["redis"] = "ok"
        await r.close()
    except Exception as e:
        checks["redis"] = f"error: {str(e)}"
    
    all_ok = all(v == "ok" for v in checks.values())
    
    return {
        "status": "healthy" if all_ok else "degraded",
        "checks": checks
    }
```

### 2.5 Create Dockerfile

```dockerfile
# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN pip install poetry

# Copy dependency files
COPY pyproject.toml poetry.lock* ./

# Install dependencies
RUN poetry config virtualenvs.create false \
    && poetry install --no-interaction --no-ansi

# Copy application
COPY . .

# Expose port
EXPOSE 8000

# Run application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## Step 3: Database Models & Migrations (Days 4-5)

### 3.1 Create Base Model

```python
# app/models/base.py
from sqlalchemy import Column, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.core.database import Base

class BaseModel(Base):
    __abstract__ = True
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime, nullable=True)
```

### 3.2 Create User Model

```python
# app/models/user.py
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID

from .base import BaseModel

class User(BaseModel):
    __tablename__ = "users"
    
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False)
    
    # Authentication
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    email_verified = Column(Boolean, default=False, nullable=False)
    email_verified_at = Column(DateTime, nullable=True)
    
    # Profile
    name = Column(String(255), nullable=False)
    avatar_url = Column(String(500), nullable=True)
    
    # Authorization
    role = Column(String(50), nullable=False, default="user")
    permissions = Column(JSONB, default=list, nullable=False)
    
    # Settings
    preferences = Column(JSONB, default=dict, nullable=False)
    
    # Activity
    last_login_at = Column(DateTime, nullable=True)
    last_active_at = Column(DateTime, nullable=True)
    
    # Relationships
    organization = relationship("Organization", back_populates="users")
    conversations = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")
```

### 3.3 Initialize Alembic

```bash
cd backend

# Initialize Alembic
alembic init alembic

# Configure alembic.ini
# Edit alembic.ini to use: sqlalchemy.url = %(DATABASE_URL)s

# Edit alembic/env.py to import models
cat > alembic/env.py << 'EOF'
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
import os

# Import Base and models
from app.core.database import Base
from app.models import user, organization, conversation, message, agent

# this is the Alembic Config object
config = context.config

# Set sqlalchemy.url from environment
config.set_main_option('sqlalchemy.url', os.getenv('DATABASE_URL'))

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
EOF

# Create initial migration
alembic revision --autogenerate -m "Initial schema"

# Apply migration
alembic upgrade head
```

---

## Step 4: Cognitive Engine (Days 6-8)

### 4.1 Create Agent Abstraction

```python
# app/services/agents.py
from typing import List, Dict, Any, Literal
from pydantic import BaseModel
from abc import ABC, abstractmethod

class AgentConfig(BaseModel):
    id: str
    role: str
    goal: str
    backstory: str
    output_format: Literal["sim_4_lines", "json", "markdown"] = "sim_4_lines"
    llm_provider: str = "openai"
    llm_model: str = "gpt-4-turbo"
    temperature: float = 0.7
    max_tokens: int = 500
    allow_delegation: bool = False

class AgentOutput(BaseModel):
    agent_id: str
    agent_role: str
    output: str
    tokens_used: int
    latency_ms: float

class Agent:
    def __init__(self, config: AgentConfig, llm_service):
        self.config = config
        self.llm = llm_service
    
    async def execute(self, query: str, context: str = "", repair_directive: str = "") -> AgentOutput:
        """Execute agent with given query"""
        import time
        
        prompt = self._build_prompt(query, context, repair_directive)
        
        start_time = time.time()
        response = await self.llm.generate(
            prompt=prompt,
            model=self.config.llm_model,
            temperature=self.config.temperature,
            max_tokens=self.config.max_tokens,
        )
        latency_ms = (time.time() - start_time) * 1000
        
        return AgentOutput(
            agent_id=self.config.id,
            agent_role=self.config.role,
            output=response.content,
            tokens_used=response.tokens_used,
            latency_ms=latency_ms,
        )
    
    def _build_prompt(self, query: str, context: str, repair_directive: str) -> str:
        """Build agent prompt"""
        prompt = f"""You are {self.config.role}.

Your goal: {self.config.goal}

Context: {self.config.backstory}

{"Conversation history:" if context else ""}
{context}

Current user query:
{query}

{repair_directive}

CRITICAL REQUIREMENTS:
- Output EXACTLY 4 numbered lines (SIM format)
- Each line should be concise and actionable
- No additional commentary or explanation
- Focus on your specific cognitive role

Example format:
1. [First insight]
2. [Second insight]
3. [Third insight]
4. [Fourth insight]

Your response:"""
        
        return prompt
```

### 4.2 Create ODAI Synthesizer

```python
# app/services/synthesis.py
from typing import List, Optional
from pydantic import BaseModel
import json

class Observation(BaseModel):
    user_intent: str
    key_requirements: List[str]
    context_summary: str

class Distillation(BaseModel):
    core_insights: List[str]
    quality_score: float
    score_rationale: str

class RepairDirective(BaseModel):
    issues: List[str]
    instructions: Dict[str, str]

class SynthesisResult(BaseModel):
    success: bool
    observation: Observation
    distillation: Distillation
    repair_directive: Optional[RepairDirective] = None
    final_output: Optional[str] = None

class ODAISynthesizer:
    def __init__(self, llm_service, quality_threshold: float = 9.0):
        self.llm = llm_service
        self.threshold = quality_threshold
    
    async def synthesize(
        self, 
        query: str, 
        contributions: List[AgentOutput]
    ) -> SynthesisResult:
        """Execute ODAI synthesis cycle"""
        
        # Format contributions
        contributions_text = "\n\n".join([
            f"**{c.agent_role}:**\n{c.output}"
            for c in contributions
        ])
        
        prompt = f"""You are the Central Consciousness synthesizing multiple perspectives.

User query: {query}

Sub-personality contributions:
{contributions_text}

Execute the ODAI cycle and return JSON:

{{
  "observation": {{
    "user_intent": "what user truly needs",
    "key_requirements": ["req1", "req2"],
    "context_summary": "brief context"
  }},
  "distillation": {{
    "core_insights": ["insight1", "insight2", "insight3"],
    "quality_score": 8.5,
    "score_rationale": "explanation of score"
  }},
  "repair_directive": {{
    "issues": ["issue1", "issue2"],
    "instructions": {{"agent_id": "specific instruction"}}
  }} OR null,
  "final_output": "clean markdown answer" OR null
}}

CRITICAL: 
- If quality_score >= {self.threshold}, include final_output (repair_directive should be null)
- If quality_score < {self.threshold}, include repair_directive (final_output should be null)
- Return ONLY valid JSON, nothing else

Your response:"""
        
        response = await self.llm.generate(
            prompt=prompt,
            model="gpt-4-turbo",
            temperature=0.0,
            max_tokens=2000,
        )
        
        # Parse JSON response
        try:
            data = json.loads(response.content)
            
            observation = Observation(**data["observation"])
            distillation = Distillation(**data["distillation"])
            
            if distillation.quality_score >= self.threshold:
                return SynthesisResult(
                    success=True,
                    observation=observation,
                    distillation=distillation,
                    final_output=data["final_output"],
                )
            else:
                repair = RepairDirective(**data["repair_directive"]) if data.get("repair_directive") else None
                return SynthesisResult(
                    success=False,
                    observation=observation,
                    distillation=distillation,
                    repair_directive=repair,
                )
        except Exception as e:
            raise ValueError(f"Failed to parse synthesis output: {e}")
```

### 4.3 Create N² Loop Controller

```python
# app/services/orchestration.py
from typing import List
import asyncio

class N2Controller:
    def __init__(self, max_iterations: int = 4, quality_threshold: float = 9.0):
        self.max_iterations = max_iterations
        self.quality_threshold = quality_threshold
    
    async def execute(
        self,
        query: str,
        agents: List[Agent],
        synthesizer: ODAISynthesizer,
        context: str = "",
    ) -> Dict[str, Any]:
        """Execute N² loop"""
        
        history = []
        current_query = query
        
        for iteration in range(1, self.max_iterations + 1):
            # Execute all agents in parallel
            tasks = [agent.execute(current_query, context) for agent in agents]
            contributions = await asyncio.gather(*tasks)
            
            # Synthesize
            synthesis = await synthesizer.synthesize(query, contributions)
            
            history.append({
                "iteration": iteration,
                "quality_score": synthesis.distillation.quality_score,
                "contributions": [c.dict() for c in contributions],
                "synthesis": synthesis.dict(),
            })
            
            # Check if acceptable
            if synthesis.success:
                return {
                    "success": True,
                    "final_output": synthesis.final_output,
                    "iterations": iteration,
                    "quality_score": synthesis.distillation.quality_score,
                    "history": history,
                }
            
            # Prepare for next iteration
            if iteration < self.max_iterations and synthesis.repair_directive:
                repair_text = "\n".join(synthesis.repair_directive.issues)
                current_query = f"{query}\n\nREPAIR DIRECTIVE: {repair_text}"
        
        # Max iterations reached
        return {
            "success": False,
            "final_output": synthesis.final_output or "Unable to reach quality threshold",
            "iterations": self.max_iterations,
            "quality_score": synthesis.distillation.quality_score,
            "history": history,
        }
```

---

## Step 5: Frontend Setup (Days 9-10)

### 5.1 Initialize Next.js

```bash
cd frontend

# Initialize with pnpm
pnpm create next-app@latest . --typescript --tailwind --app --use-pnpm

# Install additional dependencies
pnpm add @tanstack/react-query zustand socket.io-client
pnpm add react-hook-form zod @hookform/resolvers
pnpm add react-markdown remark-gfm
pnpm add lucide-react @radix-ui/react-*  # UI primitives
pnpm add -D @types/node @types/react
```

### 5.2 Set Up Env

```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

### 5.3 Create API Client

```typescript
// src/lib/api.ts
import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// API functions
export const conversationsApi = {
  list: () => api.get('/api/v1/conversations'),
  get: (id: string) => api.get(`/api/v1/conversations/${id}`),
  create: (data: any) => api.post('/api/v1/conversations', data),
  delete: (id: string) => api.delete(`/api/v1/conversations/${id}`),
};

export const messagesApi = {
  send: (conversationId: string, content: string) => 
    api.post(`/api/v1/conversations/${conversationId}/messages`, { content }),
};
```

### 5.4 Create State Store

```typescript
// src/lib/store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Conversation {
  id: string;
  title: string;
  lastActivity: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

interface AppState {
  conversations: Conversation[];
  currentConversation: string | null;
  messages: Record<string, Message[]>;
  
  setConversations: (conversations: Conversation[]) => void;
  setCurrentConversation: (id: string | null) => void;
  addMessage: (conversationId: string, message: Message) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      conversations: [],
      currentConversation: null,
      messages: {},
      
      setConversations: (conversations) => set({ conversations }),
      setCurrentConversation: (id) => set({ currentConversation: id }),
      addMessage: (conversationId, message) => 
        set((state) => ({
          messages: {
            ...state.messages,
            [conversationId]: [...(state.messages[conversationId] || []), message],
          },
        })),
    }),
    {
      name: 'maine1-storage',
    }
  )
);
```

### 5.5 Create Chat Interface

```tsx
// src/app/chat/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { messagesApi } from '@/lib/api';

export default function ChatPage() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { currentConversation, messages, addMessage } = useStore();
  const currentMessages = currentConversation ? messages[currentConversation] : [];
  
  const handleSend = async () => {
    if (!input.trim() || !currentConversation) return;
    
    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: input,
      createdAt: new Date().toISOString(),
    };
    
    addMessage(currentConversation, userMessage);
    setInput('');
    setLoading(true);
    
    try {
      const response = await messagesApi.send(currentConversation, input);
      const assistantMessage = response.data;
      addMessage(currentConversation, assistantMessage);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="flex flex-col h-screen">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {currentMessages.map((message) => (
          <div
            key={message.id}
            className={`p-4 rounded-lg ${
              message.role === 'user'
                ? 'bg-blue-100 ml-auto max-w-[80%]'
                : 'bg-gray-100 mr-auto max-w-[80%]'
            }`}
          >
            <div className="prose">{message.content}</div>
          </div>
        ))}
        {loading && <div className="text-center">Thinking...</div>}
      </div>
      
      {/* Input */}
      <div className="border-t p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type your message..."
            className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## Step 6: Testing & Deployment (Day 11-12)

### 6.1 Backend Tests

```python
# backend/tests/test_agents.py
import pytest
from app.services.agents import Agent, AgentConfig

@pytest.mark.asyncio
async def test_agent_execution():
    config = AgentConfig(
        id="test-agent",
        role="Test Agent",
        goal="Testing",
        backstory="Test backstory",
    )
    
    agent = Agent(config, mock_llm_service)
    output = await agent.execute("Test query")
    
    assert output.agent_id == "test-agent"
    assert output.output is not None
```

### 6.2 Frontend Tests

```typescript
// frontend/src/app/__tests__/chat.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import ChatPage from '../chat/page';

describe('ChatPage', () => {
  it('renders chat interface', () => {
    render(<ChatPage />);
    expect(screen.getByPlaceholderText('Type your message...')).toBeInTheDocument();
  });
  
  it('sends message on Enter key', () => {
    render(<ChatPage />);
    const input = screen.getByPlaceholderText('Type your message...');
    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.keyPress(input, { key: 'Enter', code: 'Enter' });
    // Assert message sent
  });
});
```

### 6.3 Start Development

```bash
# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Access application
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

---

## Next Steps

1. **Week 2**: Implement authentication and user management
2. **Week 3**: Add WebSocket support for real-time updates
3. **Week 4**: Build agent configuration UI
4. **Weeks 5-10**: Follow the Roadmap for remaining Phase 2 features

---

## Troubleshooting

### Database Connection Issues
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Reset database
docker-compose down -v
docker-compose up -d postgres
alembic upgrade head
```

### LLM API Errors
```bash
# Verify API key
echo $OPENAI_API_KEY

# Test API connection
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### Port Conflicts
```bash
# Check what's using port
lsof -i :8000  # Backend
lsof -i :3000  # Frontend

# Kill process or change ports in docker-compose.yml
```

---

## Success Checklist

- [ ] All services start successfully with `docker-compose up`
- [ ] Health check endpoint returns "healthy": `curl http://localhost:8000/health`
- [ ] Database migrations applied: `alembic current`
- [ ] Frontend accessible at `http://localhost:3000`
- [ ] API docs accessible at `http://localhost:8000/docs`
- [ ] Can create a conversation via API
- [ ] Can send a message and receive response
- [ ] Tests pass: `pytest` and `pnpm test`

---

**Congratulations! You now have a working foundation for MainE1. Continue with the Roadmap to build out the full platform.**
