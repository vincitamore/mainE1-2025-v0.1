# MainE1 Technical Specification

> **Comprehensive technical architecture for the N² Overmind Platform**

**Version:** 1.0  
**Last Updated:** November 2025  
**Status:** Active Development

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Core Components](#core-components)
4. [Data Models](#data-models)
5. [API Specifications](#api-specifications)
6. [LLM Integration](#llm-integration)
7. [Real-Time Communication](#real-time-communication)
8. [Security](#security)
9. [Performance](#performance)
10. [Deployment](#deployment)

---

## 1. System Overview

### 1.1 Technology Stack

#### Frontend
- **Framework:** Next.js 14+ (React 18+, App Router)
- **Language:** TypeScript 5+
- **State Management:** Zustand with persistence
- **UI Components:** shadcn/ui + Radix UI primitives
- **Styling:** Tailwind CSS 3+ with custom design system
- **Real-Time:** Socket.io-client
- **Data Fetching:** TanStack Query (React Query)
- **Forms:** React Hook Form + Zod validation
- **Charts:** Recharts / Visx
- **Markdown:** react-markdown with syntax highlighting
- **Testing:** Vitest + React Testing Library + Playwright

#### Backend
- **Framework:** FastAPI 0.104+ (Python 3.11+)
- **Async Runtime:** asyncio + uvicorn
- **LLM Framework:** LangChain + Custom abstractions
- **Multi-Agent:** CrewAI (customized) + LangGraph
- **Task Queue:** Celery with Redis broker
- **WebSocket:** Socket.io (Python)
- **API Docs:** OpenAPI/Swagger (auto-generated)
- **Validation:** Pydantic 2.0+
- **Testing:** pytest + pytest-asyncio + httpx

#### Database & Storage
- **Primary DB:** PostgreSQL 15+ with pgvector extension
- **Caching:** Redis 7+ (with RedisJSON and RedisSearch)
- **Vector DB:** Pinecone / Weaviate / pgvector
- **Object Storage:** S3-compatible (AWS S3, MinIO)
- **Search:** Elasticsearch (optional, for advanced queries)

#### Infrastructure
- **Containerization:** Docker + Docker Compose
- **Orchestration:** Kubernetes (with Helm charts)
- **API Gateway:** Kong / Traefik
- **Message Queue:** RabbitMQ / Apache Kafka (for event streaming)
- **Monitoring:** Prometheus + Grafana
- **Logging:** ELK Stack (Elasticsearch, Logstash, Kibana)
- **Tracing:** Jaeger / OpenTelemetry
- **CI/CD:** GitHub Actions + ArgoCD

### 1.2 System Requirements

#### Minimum (Development)
- **CPU:** 4 cores
- **RAM:** 8GB
- **Storage:** 20GB SSD
- **Network:** Stable internet for LLM API calls

#### Production (Per Instance)
- **CPU:** 8+ cores
- **RAM:** 16GB+
- **Storage:** 100GB+ SSD
- **Network:** 1Gbps, <50ms latency to LLM providers

---

## 2. Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Next.js    │  │  WebSocket   │  │   Admin UI   │      │
│  │     App      │  │    Client    │  │              │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS / WSS
┌────────────────────────┴────────────────────────────────────┐
│                      API Gateway Layer                       │
│  ┌────────────────────────────────────────────────────┐     │
│  │  Kong / Traefik - Auth, Rate Limit, Routing       │     │
│  └────────────────────────────────────────────────────┘     │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────────┐
│                    Microservices Layer                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Conversation│  │ Orchestration│  │   LLM        │      │
│  │   Service    │  │   Service    │  │  Service     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Synthesis   │  │  Analytics   │  │  WebSocket   │      │
│  │   Service    │  │   Service    │  │  Service     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────────┐
│                      Data Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  PostgreSQL  │  │    Redis     │  │  Vector DB   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 Service Architecture

#### Core Services

##### 2.2.1 Conversation Service
**Responsibilities:**
- Manage conversation sessions
- Store and retrieve message history
- Handle context windowing
- User authentication and authorization

**Tech:** FastAPI + SQLAlchemy + PostgreSQL

**Endpoints:**
- `POST /conversations` - Create new conversation
- `GET /conversations/{id}` - Retrieve conversation
- `GET /conversations` - List user conversations
- `DELETE /conversations/{id}` - Delete conversation
- `POST /conversations/{id}/messages` - Add message

##### 2.2.2 Orchestration Service
**Responsibilities:**
- Coordinate multi-agent workflows
- Execute ODAI synthesis cycle
- Manage N² self-correction loop
- Handle parallel/sequential execution

**Tech:** FastAPI + Celery + RabbitMQ + Redis

**Key Classes:**
```python
class OrchestrationEngine:
    async def execute_workflow(self, query: str, context: str) -> Response
    async def execute_lower_layer(self, agents: List[Agent], query: str) -> List[AgentOutput]
    async def execute_upper_layer(self, contributions: List[AgentOutput]) -> SynthesisResult
    async def execute_n2_loop(self, query: str, max_iterations: int) -> FinalOutput

class WorkflowDefinition:
    id: str
    agents: List[AgentConfig]
    execution_mode: Literal["parallel", "sequential"]
    quality_threshold: float
    max_n2_iterations: int
```

##### 2.2.3 LLM Service
**Responsibilities:**
- Abstract LLM provider APIs
- Manage API keys and rate limits
- Handle retries and fallbacks
- Token counting and optimization

**Tech:** FastAPI + LangChain + Custom adapters

**Provider Support:**
- OpenAI (GPT-4, GPT-4-Turbo, GPT-5.1)
- Anthropic (Claude 3 Opus, Claude 3.5 Sonnet)
- Google (Gemini Pro)
- Local models (Llama, Mistral via Ollama)
- Custom endpoints (OpenAI-compatible)

**Key Interface:**
```python
class LLMProvider(ABC):
    @abstractmethod
    async def generate(self, prompt: str, config: LLMConfig) -> LLMResponse
    
    @abstractmethod
    async def stream(self, prompt: str, config: LLMConfig) -> AsyncIterator[str]
    
    @abstractmethod
    def count_tokens(self, text: str) -> int

class LLMConfig(BaseModel):
    model: str
    temperature: float
    max_tokens: int
    top_p: float
    frequency_penalty: float
    presence_penalty: float
```

##### 2.2.4 Synthesis Service
**Responsibilities:**
- Execute ODAI cycle
- Quality scoring
- Generate repair directives
- Format final output

**Tech:** FastAPI + Custom logic

**ODAI Implementation:**
```python
class ODAISynthesizer:
    async def observe(self, query: str, contributions: List[str]) -> Observation
    async def distill(self, observation: Observation) -> Distillation
    async def adapt(self, distillation: Distillation) -> Optional[RepairDirective]
    async def integrate(self, distillation: Distillation) -> FinalOutput
    
    async def synthesize(self, query: str, contributions: List[str]) -> SynthesisResult:
        obs = await self.observe(query, contributions)
        dist = await self.distill(obs)
        
        if dist.quality_score >= self.threshold:
            output = await self.integrate(dist)
            return SynthesisResult(success=True, output=output)
        else:
            repair = await self.adapt(dist)
            return SynthesisResult(success=False, repair_directive=repair)
```

##### 2.2.5 Analytics Service
**Responsibilities:**
- Track usage metrics
- Log agent performance
- Monitor quality scores
- Generate insights

**Tech:** FastAPI + TimescaleDB + Prometheus

**Metrics:**
- Request rate, latency percentiles
- Quality score distribution
- N² trigger rate
- Token usage per query
- Agent contribution patterns
- User satisfaction scores

##### 2.2.6 WebSocket Service
**Responsibilities:**
- Real-time bidirectional communication
- Event broadcasting
- Connection management
- Reconnection handling

**Tech:** Socket.io (Python server)

**Events:**
```typescript
// Client -> Server
interface ClientEvents {
  "query": (data: { conversationId: string; message: string }) => void;
  "cancel": (data: { requestId: string }) => void;
}

// Server -> Client
interface ServerEvents {
  "agent_started": (data: { agentId: string; agentName: string }) => void;
  "agent_completed": (data: { agentId: string; output: string }) => void;
  "synthesis_started": () => void;
  "quality_scored": (data: { score: number; iteration: number }) => void;
  "n2_triggered": (data: { reason: string; iteration: number }) => void;
  "final_output": (data: { content: string; metadata: Metadata }) => void;
  "error": (data: { message: string; code: string }) => void;
}
```

---

## 3. Core Components

### 3.1 Agent System

#### Agent Definition
```python
from pydantic import BaseModel
from typing import Literal

class AgentConfig(BaseModel):
    id: str
    role: str
    goal: str
    backstory: str
    output_format: Literal["sim_4_lines", "json", "markdown"]
    llm_config: LLMConfig
    allow_delegation: bool = False
    verbose: bool = False

class AgentOutput(BaseModel):
    agent_id: str
    agent_role: str
    output: str
    tokens_used: int
    latency_ms: float
    timestamp: datetime
```

#### Default Six Sub-Personalities
```python
DEFAULT_AGENTS = [
    AgentConfig(
        id="creative",
        role="Creative Clarity",
        goal="Generate clear, innovative solutions and novel perspectives",
        backstory="You are a creative thinker focused on ideation. Output exactly 4 numbered SIM steps only. Be concise and actionable.",
        output_format="sim_4_lines",
        llm_config=LLMConfig(model="gpt-4-turbo", temperature=0.7),
    ),
    AgentConfig(
        id="structural",
        role="Structural Clarity",
        goal="Organize information and relieve cognitive overload",
        backstory="You bring structure to chaos. Output exactly 4 numbered SIM steps only. Focus on organization and systematic analysis.",
        output_format="sim_4_lines",
        llm_config=LLMConfig(model="gpt-4-turbo", temperature=0.3),
    ),
    # ... [remaining 4 agents with similar structure]
]
```

### 3.2 ODAI Synthesis Engine

#### Phases
```python
class Observation(BaseModel):
    """What actually needs to be answered"""
    user_intent: str
    key_requirements: List[str]
    context_summary: str

class Distillation(BaseModel):
    """Core truth extraction + quality scoring"""
    core_insights: List[str]
    alignment_check: Dict[str, bool]  # coherence across agents
    quality_score: float  # 0-10
    scoring_rationale: str

class RepairDirective(BaseModel):
    """Instructions for swarm improvement"""
    issues: List[str]
    specific_instructions: Dict[str, str]  # agent_id -> instruction
    focus_areas: List[str]

class FinalOutput(BaseModel):
    """Clean markdown answer"""
    content: str
    confidence: float
    metadata: Dict[str, Any]
```

### 3.3 N² Loop Controller

```python
class N2Controller:
    def __init__(self, max_iterations: int = 4, threshold: float = 9.0):
        self.max_iterations = max_iterations
        self.threshold = threshold
    
    async def execute(
        self, 
        query: str, 
        agents: List[Agent],
        synthesizer: ODAISynthesizer
    ) -> N2Result:
        history = []
        
        for iteration in range(1, self.max_iterations + 1):
            # Lower layer execution
            contributions = await execute_agents_parallel(agents, query)
            
            # Upper layer synthesis
            synthesis = await synthesizer.synthesize(query, contributions)
            
            history.append({
                "iteration": iteration,
                "contributions": contributions,
                "synthesis": synthesis,
            })
            
            # Check quality
            if synthesis.quality_score >= self.threshold:
                return N2Result(
                    success=True,
                    final_output=synthesis.output,
                    iterations=iteration,
                    history=history
                )
            
            # If not last iteration, prepare repair
            if iteration < self.max_iterations:
                repair = await synthesizer.generate_repair(synthesis)
                query = self.augment_query_with_repair(query, repair)
        
        # Max iterations reached - return best attempt
        return N2Result(
            success=False,
            final_output=synthesis.output,  # best effort
            iterations=self.max_iterations,
            history=history
        )
```

---

## 4. Data Models

### 4.1 Core Entities

#### User
```typescript
interface User {
  id: string;
  email: string;
  name: string;
  organization_id: string;
  role: "admin" | "user" | "viewer";
  created_at: Date;
  updated_at: Date;
  preferences: UserPreferences;
}

interface UserPreferences {
  default_model: string;
  quality_threshold: number;
  show_debug_info: boolean;
  theme: "light" | "dark" | "auto";
}
```

#### Conversation
```typescript
interface Conversation {
  id: string;
  user_id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
  last_activity: Date;
  message_count: number;
  metadata: {
    tags?: string[];
    folder?: string;
    archived?: boolean;
  };
}
```

#### Message
```typescript
interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: Date;
  metadata: MessageMetadata;
}

interface MessageMetadata {
  // For user messages
  edited?: boolean;
  
  // For assistant messages
  agent_contributions?: AgentContribution[];
  synthesis_details?: SynthesisDetails;
  n2_iterations?: number;
  quality_score?: number;
  tokens_used?: number;
  latency_ms?: number;
  model_used?: string;
}
```

#### AgentConfiguration
```typescript
interface AgentConfiguration {
  id: string;
  organization_id: string;
  name: string;
  role: string;
  goal: string;
  backstory: string;
  output_format: "sim_4_lines" | "json" | "markdown";
  llm_config: LLMConfig;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}
```

#### WorkflowTemplate
```typescript
interface WorkflowTemplate {
  id: string;
  organization_id: string;
  name: string;
  description: string;
  agent_ids: string[];
  execution_mode: "parallel" | "sequential";
  quality_threshold: number;
  max_n2_iterations: number;
  is_public: boolean;
  created_by: string;
  created_at: Date;
}
```

### 4.2 Event Models

```typescript
interface AgentEvent {
  id: string;
  conversation_id: string;
  message_id: string;
  agent_id: string;
  event_type: "started" | "completed" | "failed";
  timestamp: Date;
  data: {
    output?: string;
    error?: string;
    latency_ms?: number;
    tokens_used?: number;
  };
}

interface SynthesisEvent {
  id: string;
  conversation_id: string;
  message_id: string;
  iteration: number;
  quality_score: number;
  triggered_n2: boolean;
  timestamp: Date;
  data: {
    observation?: Observation;
    distillation?: Distillation;
    repair_directive?: RepairDirective;
  };
}
```

---

## 5. API Specifications

### 5.1 REST API

#### Base URL
```
Production: https://api.maine1.ai/v1
Development: http://localhost:8000/v1
```

#### Authentication
```http
Authorization: Bearer <jwt_token>
```

#### Endpoints

##### Conversations
```http
POST /conversations
GET /conversations
GET /conversations/{id}
DELETE /conversations/{id}
PATCH /conversations/{id}
```

##### Messages
```http
POST /conversations/{id}/messages
GET /conversations/{id}/messages
GET /messages/{id}
```

##### Agent Configurations
```http
GET /agents
POST /agents
GET /agents/{id}
PUT /agents/{id}
DELETE /agents/{id}
POST /agents/{id}/test
```

##### Workflows
```http
GET /workflows
POST /workflows
GET /workflows/{id}
PUT /workflows/{id}
DELETE /workflows/{id}
POST /workflows/{id}/execute
```

### 5.2 WebSocket API

#### Connection
```typescript
import io from "socket.io-client";

const socket = io("wss://api.maine1.ai", {
  auth: { token: jwt_token },
  transports: ["websocket"],
});
```

#### Message Flow
```typescript
// Send query
socket.emit("query", {
  conversationId: "conv_123",
  message: "How do I improve team productivity?"
});

// Receive events
socket.on("agent_started", (data) => {
  console.log(`Agent ${data.agentName} started`);
});

socket.on("agent_completed", (data) => {
  console.log(`Agent completed: ${data.output}`);
});

socket.on("synthesis_started", () => {
  console.log("Synthesizing responses...");
});

socket.on("quality_scored", (data) => {
  console.log(`Quality: ${data.score}/10 (iteration ${data.iteration})`);
});

socket.on("n2_triggered", (data) => {
  console.log(`N² repair triggered: ${data.reason}`);
});

socket.on("final_output", (data) => {
  console.log("Final answer:", data.content);
});
```

---

## 6. LLM Integration

### 6.1 Provider Abstraction

```python
class OpenAIProvider(LLMProvider):
    def __init__(self, api_key: str):
        self.client = AsyncOpenAI(api_key=api_key)
    
    async def generate(self, prompt: str, config: LLMConfig) -> LLMResponse:
        response = await self.client.chat.completions.create(
            model=config.model,
            messages=[{"role": "user", "content": prompt}],
            temperature=config.temperature,
            max_tokens=config.max_tokens,
        )
        return LLMResponse(
            content=response.choices[0].message.content,
            tokens_used=response.usage.total_tokens,
            finish_reason=response.choices[0].finish_reason,
        )

class AnthropicProvider(LLMProvider):
    # Similar implementation

class LLMFactory:
    @staticmethod
    def create(provider: str, api_key: str) -> LLMProvider:
        if provider == "openai":
            return OpenAIProvider(api_key)
        elif provider == "anthropic":
            return AnthropicProvider(api_key)
        # ...
```

### 6.2 Prompt Engineering

#### Agent Prompt Template
```python
AGENT_PROMPT_TEMPLATE = """
You are {role}.

Your goal: {goal}

Context: {backstory}

Conversation history:
{history}

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

Your response:
"""
```

#### Synthesis Prompt Template
```python
SYNTHESIS_PROMPT_TEMPLATE = """
You are the Central Consciousness synthesizing multiple perspectives.

User query: {query}

Sub-personality contributions:
{contributions}

Execute the ODAI cycle:

1. OBSERVATION - What does the user truly need?
2. DISTILLATION - Extract core insights and assign quality score (0-10)
3. ADAPTATION - If score < 9, create repair directive
4. INTEGRATION - If score >= 9, write final answer

Return JSON:
{{
  "observation": "...",
  "core_insights": ["...", "..."],
  "quality_score": 8.5,
  "score_rationale": "...",
  "repair_directive": "..." OR null,
  "final_output": "..." OR null
}}

CRITICAL: If score >= 9, include final_output. If < 9, include repair_directive.
"""
```

---

## 7. Real-Time Communication

### 7.1 WebSocket Architecture

```python
from socketio import AsyncServer, ASGIApp

sio = AsyncServer(async_mode="asgi", cors_allowed_origins="*")
app = ASGIApp(sio)

@sio.event
async def connect(sid, environ, auth):
    # Authenticate
    token = auth.get("token")
    user = await authenticate_token(token)
    if not user:
        raise ConnectionRefusedError("Invalid token")
    
    # Store session
    await sio.save_session(sid, {"user_id": user.id})
    print(f"User {user.id} connected: {sid}")

@sio.event
async def query(sid, data):
    session = await sio.get_session(sid)
    user_id = session["user_id"]
    
    # Start async processing
    task_id = await queue_conversation_task(
        user_id=user_id,
        conversation_id=data["conversationId"],
        message=data["message"],
        socket_sid=sid,
    )
    
    await sio.emit("task_started", {"taskId": task_id}, room=sid)

# Emitters from worker processes
async def emit_agent_event(sid: str, event: str, data: dict):
    await sio.emit(event, data, room=sid)
```

### 7.2 Event Ordering

Events are emitted in strict order:
1. `task_started`
2. `agent_started` (x6)
3. `agent_completed` (x6)
4. `synthesis_started`
5. `quality_scored`
6. `n2_triggered` (if score < 9)
7. Repeat 2-6 if N² loop continues
8. `final_output` OR `error`

---

## 8. Security

### 8.1 Authentication & Authorization

#### JWT Structure
```json
{
  "sub": "user_id",
  "email": "user@example.com",
  "org": "org_id",
  "role": "admin",
  "exp": 1234567890,
  "iat": 1234567890
}
```

#### RBAC Matrix
| Resource | Admin | User | Viewer |
|----------|-------|------|--------|
| Create conversation | ✓ | ✓ | ✗ |
| View own conversations | ✓ | ✓ | ✓ |
| View org conversations | ✓ | ✗ | ✗ |
| Modify agents | ✓ | ✗ | ✗ |
| Create workflows | ✓ | ✓ | ✗ |
| View analytics | ✓ | ✓ | ✓ |

### 8.2 API Security

- **Rate Limiting:** 100 requests/minute per user (configurable)
- **Input Validation:** Pydantic schemas + sanitization
- **SQL Injection:** SQLAlchemy ORM (no raw queries)
- **XSS Protection:** Content Security Policy headers
- **CORS:** Whitelist allowed origins

### 8.3 Data Security

- **Encryption at Rest:** AES-256 for sensitive fields
- **Encryption in Transit:** TLS 1.3
- **Key Management:** AWS KMS / HashiCorp Vault
- **PII Handling:** Opt-in logging, auto-redaction
- **Data Retention:** Configurable per organization

---

## 9. Performance

### 9.1 Optimization Strategies

#### Parallel Execution
```python
async def execute_agents_parallel(agents: List[Agent], query: str) -> List[AgentOutput]:
    tasks = [agent.execute(query) for agent in agents]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    return [r for r in results if not isinstance(r, Exception)]
```

#### Caching
```python
@cache(expire=3600)
async def get_agent_config(agent_id: str) -> AgentConfig:
    return await db.query(AgentConfig).get(agent_id)
```

#### Connection Pooling
```python
DATABASE_URL = "postgresql+asyncpg://..."
engine = create_async_engine(
    DATABASE_URL,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
)
```

### 9.2 Performance Targets

| Metric | Target | P95 | P99 |
|--------|--------|-----|-----|
| API Response (simple) | <200ms | <300ms | <500ms |
| Agent Execution | <3s | <5s | <8s |
| Full Synthesis (no N²) | <8s | <12s | <15s |
| With N² (1 iteration) | <15s | <20s | <25s |
| WebSocket Latency | <50ms | <100ms | <150ms |

---

## 10. Deployment

### 10.1 Docker Compose (Development)

```yaml
version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg15
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    ports:
      - "5432:5432"
  
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
  
  backend:
    build: ./backend
    env_file: .env
    ports:
      - "8000:8000"
    depends_on:
      - postgres
      - redis
  
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend
  
  worker:
    build: ./backend
    command: celery -A app.worker worker
    depends_on:
      - redis
      - postgres
```

### 10.2 Kubernetes (Production)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: maine1-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: maine1-backend
  template:
    metadata:
      labels:
        app: maine1-backend
    spec:
      containers:
      - name: backend
        image: maine1/backend:latest
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: maine1-secrets
              key: database-url
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
```

### 10.3 CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run tests
        run: |
          cd backend && pytest
          cd frontend && pnpm test
  
  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Build Docker images
        run: |
          docker build -t maine1/backend:${{ github.sha }} ./backend
          docker build -t maine1/frontend:${{ github.sha }} ./frontend
      - name: Push to registry
        run: |
          docker push maine1/backend:${{ github.sha }}
          docker push maine1/frontend:${{ github.sha }}
  
  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/maine1-backend backend=maine1/backend:${{ github.sha }}
          kubectl set image deployment/maine1-frontend frontend=maine1/frontend:${{ github.sha }}
```

---

## Appendices

### A. Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/maine1
REDIS_URL=redis://localhost:6379/0

# LLM Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Security
JWT_SECRET=...
JWT_ALGORITHM=HS256
JWT_EXPIRATION=3600

# Application
ENVIRONMENT=production
LOG_LEVEL=INFO
CORS_ORIGINS=https://app.maine1.ai

# External Services
VECTOR_DB_URL=...
S3_BUCKET=maine1-data
S3_REGION=us-east-1
```

### B. Monitoring Queries

```promql
# Request rate
rate(http_requests_total[5m])

# P95 latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Error rate
rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])

# N² trigger rate
rate(n2_loops_triggered_total[5m]) / rate(queries_total[5m])
```

---

**This technical specification is a living document and will be updated as the system evolves.**
