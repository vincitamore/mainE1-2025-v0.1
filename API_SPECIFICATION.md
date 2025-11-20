# MainE1 API Specification

> **Complete REST and WebSocket API documentation**

**Version:** 1.0  
**Base URL:** `https://api.maine1.ai/v1`  
**Protocol:** HTTPS  
**Authentication:** Bearer Token (JWT)

---

## Table of Contents

1. [Authentication](#authentication)
2. [REST API Endpoints](#rest-api-endpoints)
3. [WebSocket API](#websocket-api)
4. [Error Handling](#error-handling)
5. [Rate Limiting](#rate-limiting)
6. [Pagination](#pagination)
7. [Data Models](#data-models)
8. [Examples](#examples)

---

## Authentication

### JWT Bearer Token

All authenticated endpoints require a JWT token in the Authorization header:

```http
Authorization: Bearer <your_jwt_token>
```

### Obtaining a Token

**POST** `/auth/login`

```json
// Request
{
  "email": "user@example.com",
  "password": "secure_password"
}

// Response 200
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "user"
  }
}

// Error 401
{
  "detail": "Invalid credentials"
}
```

### Token Refresh

**POST** `/auth/refresh`

```json
// Request
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}

// Response 200
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

---

## REST API Endpoints

### Health & Status

#### Health Check

**GET** `/health`

```json
// Response 200
{
  "status": "healthy",
  "checks": {
    "api": "ok",
    "database": "ok",
    "redis": "ok"
  },
  "timestamp": "2025-11-20T12:00:00Z"
}
```

---

### Users

#### Get Current User

**GET** `/users/me`

**Auth:** Required

```json
// Response 200
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "name": "John Doe",
  "organization_id": "770e8400-e29b-41d4-a716-446655440000",
  "role": "user",
  "avatar_url": "https://example.com/avatar.jpg",
  "preferences": {
    "theme": "dark",
    "show_debug_info": false
  },
  "created_at": "2025-01-01T00:00:00Z",
  "last_active_at": "2025-11-20T11:55:00Z"
}
```

#### Update User Profile

**PATCH** `/users/me`

**Auth:** Required

```json
// Request
{
  "name": "John Smith",
  "preferences": {
    "theme": "light"
  }
}

// Response 200
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "name": "John Smith",
  "preferences": {
    "theme": "light",
    "show_debug_info": false
  },
  "updated_at": "2025-11-20T12:00:00Z"
}
```

---

### Conversations

#### List Conversations

**GET** `/conversations`

**Auth:** Required

**Query Parameters:**
- `page` (integer, default: 1) - Page number
- `limit` (integer, default: 20, max: 100) - Items per page
- `status` (string, optional) - Filter by status: `active`, `archived`, `deleted`
- `search` (string, optional) - Search in titles
- `sort` (string, default: `-last_activity`) - Sort field with direction

```json
// Request
GET /conversations?page=1&limit=20&status=active&sort=-last_activity

// Response 200
{
  "data": [
    {
      "id": "conv_123456",
      "title": "Product Strategy Discussion",
      "status": "active",
      "message_count": 15,
      "last_activity_at": "2025-11-20T11:50:00Z",
      "created_at": "2025-11-15T10:00:00Z",
      "tags": ["strategy", "product"],
      "metadata": {
        "quality_score": 9.2
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "total_pages": 3,
    "has_next": true,
    "has_prev": false
  }
}
```

#### Get Conversation

**GET** `/conversations/{conversation_id}`

**Auth:** Required

**Query Parameters:**
- `include_messages` (boolean, default: true) - Include recent messages
- `message_limit` (integer, default: 50) - Number of recent messages

```json
// Response 200
{
  "id": "conv_123456",
  "title": "Product Strategy Discussion",
  "status": "active",
  "message_count": 15,
  "quality_threshold": 9.0,
  "max_n2_iterations": 4,
  "last_activity_at": "2025-11-20T11:50:00Z",
  "created_at": "2025-11-15T10:00:00Z",
  "tags": ["strategy", "product"],
  "messages": [
    {
      "id": "msg_789",
      "role": "user",
      "content": "How can we improve user retention?",
      "created_at": "2025-11-20T11:45:00Z"
    },
    {
      "id": "msg_790",
      "role": "assistant",
      "content": "# User Retention Strategy\n\n1. **Onboarding Optimization**...",
      "quality_score": 9.3,
      "n2_iterations": 1,
      "tokens_used": 450,
      "latency_ms": 8200,
      "model_used": "gpt-4-turbo",
      "created_at": "2025-11-20T11:45:12Z",
      "metadata": {
        "agent_contributions": [...],
        "synthesis_details": {...}
      }
    }
  ]
}

// Error 404
{
  "detail": "Conversation not found"
}
```

#### Create Conversation

**POST** `/conversations`

**Auth:** Required

```json
// Request
{
  "title": "New Strategy Discussion",
  "tags": ["strategy"],
  "workflow_id": "workflow_default",  // optional
  "quality_threshold": 9.0,  // optional
  "max_n2_iterations": 4  // optional
}

// Response 201
{
  "id": "conv_123457",
  "title": "New Strategy Discussion",
  "status": "active",
  "message_count": 0,
  "quality_threshold": 9.0,
  "max_n2_iterations": 4,
  "created_at": "2025-11-20T12:00:00Z",
  "tags": ["strategy"]
}
```

#### Update Conversation

**PATCH** `/conversations/{conversation_id}`

**Auth:** Required

```json
// Request
{
  "title": "Updated Title",
  "tags": ["strategy", "new-tag"],
  "status": "archived"
}

// Response 200
{
  "id": "conv_123456",
  "title": "Updated Title",
  "status": "archived",
  "tags": ["strategy", "new-tag"],
  "updated_at": "2025-11-20T12:00:00Z"
}
```

#### Delete Conversation

**DELETE** `/conversations/{conversation_id}`

**Auth:** Required

```json
// Response 204 (No Content)
```

---

### Messages

#### Get Messages

**GET** `/conversations/{conversation_id}/messages`

**Auth:** Required

**Query Parameters:**
- `page` (integer, default: 1)
- `limit` (integer, default: 50, max: 200)
- `before` (datetime, optional) - Messages before this timestamp
- `after` (datetime, optional) - Messages after this timestamp

```json
// Response 200
{
  "data": [
    {
      "id": "msg_789",
      "conversation_id": "conv_123456",
      "role": "user",
      "content": "How can we improve user retention?",
      "created_at": "2025-11-20T11:45:00Z"
    },
    {
      "id": "msg_790",
      "conversation_id": "conv_123456",
      "role": "assistant",
      "content": "# User Retention Strategy\n\n...",
      "quality_score": 9.3,
      "n2_iterations": 1,
      "created_at": "2025-11-20T11:45:12Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 15,
    "has_next": false,
    "has_prev": false
  }
}
```

#### Send Message (Query)

**POST** `/conversations/{conversation_id}/messages`

**Auth:** Required

**Note:** For real-time experience, use WebSocket API instead.

```json
// Request
{
  "content": "What are the key factors in product-market fit?"
}

// Response 202 (Accepted)
{
  "message_id": "msg_791",
  "task_id": "task_xyz",
  "status": "processing",
  "estimated_time_seconds": 10
}

// Poll for result
// GET /messages/{message_id}

// Response 200 (when complete)
{
  "id": "msg_791",
  "conversation_id": "conv_123456",
  "role": "user",
  "content": "What are the key factors in product-market fit?",
  "created_at": "2025-11-20T12:00:00Z"
}
// Assistant response follows as separate message
```

---

### Agent Configurations

#### List Agents

**GET** `/agents`

**Auth:** Required

**Query Parameters:**
- `include_public` (boolean, default: true) - Include public/template agents
- `active_only` (boolean, default: true) - Only active agents

```json
// Response 200
{
  "data": [
    {
      "id": "agent_creative_001",
      "name": "Creative Clarity",
      "role": "Creative Clarity",
      "goal": "Generate clear, innovative solutions",
      "output_format": "sim_4_lines",
      "llm_model": "gpt-4-turbo",
      "temperature": 0.7,
      "is_active": true,
      "is_public": true,
      "usage_count": 1250,
      "avg_quality_score": 9.1,
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

#### Get Agent

**GET** `/agents/{agent_id}`

**Auth:** Required

```json
// Response 200
{
  "id": "agent_creative_001",
  "name": "Creative Clarity",
  "role": "Creative Clarity",
  "goal": "Generate clear, innovative solutions and novel perspectives",
  "backstory": "You are a creative thinker focused on ideation...",
  "output_format": "sim_4_lines",
  "llm_provider": "openai",
  "llm_model": "gpt-4-turbo",
  "temperature": 0.7,
  "max_tokens": 500,
  "allow_delegation": false,
  "is_active": true,
  "is_public": true,
  "created_at": "2025-01-01T00:00:00Z"
}
```

#### Create Agent

**POST** `/agents`

**Auth:** Required (role: admin or user)

```json
// Request
{
  "name": "Technical Analyzer",
  "role": "Technical Analysis",
  "goal": "Analyze technical feasibility and implementation details",
  "backstory": "You are an expert technical architect...",
  "output_format": "sim_4_lines",
  "llm_model": "gpt-4-turbo",
  "temperature": 0.5,
  "max_tokens": 500
}

// Response 201
{
  "id": "agent_custom_001",
  "name": "Technical Analyzer",
  "role": "Technical Analysis",
  // ... full agent object
  "created_at": "2025-11-20T12:00:00Z"
}
```

#### Update Agent

**PUT** `/agents/{agent_id}`

**Auth:** Required (owner or admin)

```json
// Request
{
  "temperature": 0.6,
  "is_active": true
}

// Response 200
{
  "id": "agent_custom_001",
  // ... updated agent object
  "updated_at": "2025-11-20T12:00:00Z"
}
```

#### Test Agent

**POST** `/agents/{agent_id}/test`

**Auth:** Required

```json
// Request
{
  "query": "How can we improve code quality?",
  "context": ""
}

// Response 200
{
  "output": "1. Implement automated testing\n2. Code review process\n3. Static analysis tools\n4. Continuous integration",
  "tokens_used": 120,
  "latency_ms": 1850,
  "model_used": "gpt-4-turbo"
}
```

#### Delete Agent

**DELETE** `/agents/{agent_id}`

**Auth:** Required (owner or admin)

```json
// Response 204 (No Content)
```

---

### Workflow Templates

#### List Workflows

**GET** `/workflows`

**Auth:** Required

```json
// Response 200
{
  "data": [
    {
      "id": "workflow_general",
      "name": "General Problem Solving",
      "description": "Balanced approach for diverse queries",
      "category": "general",
      "agent_ids": ["agent_creative_001", "agent_structural_001", ...],
      "execution_mode": "parallel",
      "quality_threshold": 9.0,
      "max_n2_iterations": 4,
      "is_public": true,
      "usage_count": 5000,
      "rating": 4.7,
      "created_at": "2025-01-01T00:00:00Z"
    }
  ]
}
```

#### Create Workflow

**POST** `/workflows`

**Auth:** Required

```json
// Request
{
  "name": "Technical Decision Making",
  "description": "Optimized for technical architecture decisions",
  "category": "technical",
  "agent_ids": [
    "agent_creative_001",
    "agent_structural_001",
    "agent_decision_001",
    "agent_custom_technical_001"
  ],
  "execution_mode": "parallel",
  "quality_threshold": 9.5,
  "max_n2_iterations": 4
}

// Response 201
{
  "id": "workflow_custom_001",
  "name": "Technical Decision Making",
  // ... full workflow object
  "created_at": "2025-11-20T12:00:00Z"
}
```

---

### Analytics

#### Organization Usage

**GET** `/analytics/usage`

**Auth:** Required (role: admin)

**Query Parameters:**
- `start_date` (date, required) - Start of date range
- `end_date` (date, required) - End of date range
- `granularity` (string, default: `day`) - `hour`, `day`, `week`, `month`

```json
// Request
GET /analytics/usage?start_date=2025-11-01&end_date=2025-11-20&granularity=day

// Response 200
{
  "data": [
    {
      "date": "2025-11-20",
      "query_count": 150,
      "message_count": 300,
      "token_count": 450000,
      "avg_quality_score": 9.2,
      "n2_trigger_rate": 0.25,
      "avg_latency_ms": 8500,
      "estimated_cost_usd": 45.00
    }
  ],
  "summary": {
    "total_queries": 3000,
    "total_tokens": 9000000,
    "total_cost_usd": 900.00,
    "avg_quality_score": 9.1,
    "period_start": "2025-11-01",
    "period_end": "2025-11-20"
  }
}
```

#### Quality Metrics

**GET** `/analytics/quality`

**Auth:** Required

```json
// Response 200
{
  "overall_quality_score": 9.2,
  "quality_distribution": {
    "9-10": 0.65,
    "8-9": 0.30,
    "7-8": 0.04,
    "0-7": 0.01
  },
  "n2_statistics": {
    "trigger_rate": 0.28,
    "avg_iterations_when_triggered": 1.8,
    "max_iterations_reached_rate": 0.05
  },
  "by_agent": [
    {
      "agent_id": "agent_creative_001",
      "agent_name": "Creative Clarity",
      "avg_contribution_quality": 9.1,
      "usage_count": 1250
    }
  ]
}
```

---

## WebSocket API

### Connection

**Endpoint:** `wss://api.maine1.ai/ws`

**Authentication:** Token in connection query parameter or auth handshake

```javascript
import io from 'socket.io-client';

const socket = io('wss://api.maine1.ai', {
  auth: {
    token: 'your_jwt_token'
  },
  transports: ['websocket'],
});

socket.on('connect', () => {
  console.log('Connected:', socket.id);
});

socket.on('disconnect', () => {
  console.log('Disconnected');
});
```

### Client Events (Client → Server)

#### Send Query

**Event:** `query`

```javascript
socket.emit('query', {
  conversationId: 'conv_123456',
  message: 'How can we scale our database?',
});
```

#### Cancel Request

**Event:** `cancel`

```javascript
socket.emit('cancel', {
  requestId: 'req_xyz',
});
```

### Server Events (Server → Client)

#### Task Started

**Event:** `task_started`

```javascript
socket.on('task_started', (data) => {
  console.log('Task ID:', data.taskId);
  console.log('Estimated time:', data.estimatedSeconds);
});

// Payload
{
  "taskId": "task_xyz",
  "conversationId": "conv_123456",
  "estimatedSeconds": 10
}
```

#### Agent Started

**Event:** `agent_started`

```javascript
socket.on('agent_started', (data) => {
  console.log(`Agent ${data.agentName} started`);
});

// Payload
{
  "agentId": "agent_creative_001",
  "agentName": "Creative Clarity",
  "iteration": 1
}
```

#### Agent Completed

**Event:** `agent_completed`

```javascript
socket.on('agent_completed', (data) => {
  console.log('Agent output:', data.output);
});

// Payload
{
  "agentId": "agent_creative_001",
  "agentName": "Creative Clarity",
  "output": "1. Consider...\n2. Implement...\n3. Test...\n4. Deploy...",
  "tokensUsed": 150,
  "latencyMs": 1850,
  "iteration": 1
}
```

#### Synthesis Started

**Event:** `synthesis_started`

```javascript
socket.on('synthesis_started', (data) => {
  console.log('Synthesizing responses...');
});

// Payload
{
  "iteration": 1
}
```

#### Quality Scored

**Event:** `quality_scored`

```javascript
socket.on('quality_scored', (data) => {
  console.log(`Quality: ${data.score}/10`);
});

// Payload
{
  "score": 8.7,
  "iteration": 1,
  "threshold": 9.0
}
```

#### N² Repair Triggered

**Event:** `n2_triggered`

```javascript
socket.on('n2_triggered', (data) => {
  console.log('N² repair:', data.reason);
});

// Payload
{
  "reason": "Quality below threshold",
  "score": 8.7,
  "iteration": 1,
  "repairDirective": "Provide more specific examples and quantitative data"
}
```

#### Final Output

**Event:** `final_output`

```javascript
socket.on('final_output', (data) => {
  console.log('Final answer:', data.content);
});

// Payload
{
  "messageId": "msg_792",
  "content": "# Database Scaling Strategy\n\n...",
  "qualityScore": 9.3,
  "iterations": 2,
  "tokensUsed": 850,
  "latencyMs": 15200,
  "metadata": {
    "n2_iterations": 2,
    "agent_contributions": [...]
  }
}
```

#### Error

**Event:** `error`

```javascript
socket.on('error', (data) => {
  console.error('Error:', data.message);
});

// Payload
{
  "code": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests. Please try again later.",
  "retryAfter": 60
}
```

---

## Error Handling

### Error Response Format

```json
{
  "detail": "Error message",
  "code": "ERROR_CODE",
  "field": "field_name",  // For validation errors
  "timestamp": "2025-11-20T12:00:00Z"
}
```

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created |
| 202 | Accepted | Request accepted, processing |
| 204 | No Content | Request successful, no content |
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource conflict (duplicate) |
| 422 | Unprocessable Entity | Validation error |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | Service temporarily unavailable |

### Error Codes

| Code | Description |
|------|-------------|
| `INVALID_CREDENTIALS` | Invalid email or password |
| `TOKEN_EXPIRED` | JWT token has expired |
| `TOKEN_INVALID` | JWT token is invalid |
| `RESOURCE_NOT_FOUND` | Requested resource doesn't exist |
| `PERMISSION_DENIED` | User lacks required permission |
| `VALIDATION_ERROR` | Request validation failed |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `QUOTA_EXCEEDED` | Organization quota exceeded |
| `LLM_ERROR` | Error from LLM provider |
| `DATABASE_ERROR` | Database operation failed |

---

## Rate Limiting

### Limits by Plan

| Plan | Requests/Minute | Requests/Day | Concurrent Requests |
|------|----------------|--------------|---------------------|
| Free | 10 | 100 | 1 |
| Pro | 100 | 10,000 | 5 |
| Enterprise | Custom | Custom | Custom |

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1700481600
```

### Rate Limit Response

```json
// 429 Too Many Requests
{
  "detail": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "retry_after": 60,
  "limit": 100,
  "reset_at": "2025-11-20T12:01:00Z"
}
```

---

## Pagination

### Request Parameters

- `page` (integer, default: 1) - Page number (1-indexed)
- `limit` (integer, default: 20) - Items per page
- `sort` (string) - Sort field with direction prefix (`-` for desc)

### Response Format

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "total_pages": 8,
    "has_next": true,
    "has_prev": false
  }
}
```

---

## Data Models

### User

```typescript
interface User {
  id: string;
  email: string;
  name: string;
  organization_id: string;
  role: 'admin' | 'user' | 'viewer';
  avatar_url?: string;
  preferences: {
    theme?: 'light' | 'dark' | 'auto';
    show_debug_info?: boolean;
    [key: string]: any;
  };
  created_at: string;
  last_active_at?: string;
}
```

### Conversation

```typescript
interface Conversation {
  id: string;
  user_id: string;
  title: string;
  status: 'active' | 'archived' | 'deleted';
  message_count: number;
  quality_threshold: number;
  max_n2_iterations: number;
  tags?: string[];
  metadata?: Record<string, any>;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
}
```

### Message

```typescript
interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  
  // Assistant message fields
  quality_score?: number;
  n2_iterations?: number;
  tokens_used?: number;
  latency_ms?: number;
  model_used?: string;
  
  metadata?: {
    agent_contributions?: AgentContribution[];
    synthesis_details?: SynthesisDetails;
    n2_history?: N2Iteration[];
  };
  
  created_at: string;
}
```

### Agent Configuration

```typescript
interface AgentConfiguration {
  id: string;
  name: string;
  role: string;
  goal: string;
  backstory: string;
  output_format: 'sim_4_lines' | 'json' | 'markdown';
  llm_provider: string;
  llm_model: string;
  temperature: number;
  max_tokens: number;
  allow_delegation: boolean;
  is_active: boolean;
  is_public: boolean;
  usage_count: number;
  avg_quality_score?: number;
  created_at: string;
  updated_at: string;
}
```

---

## Examples

### Complete Conversation Flow (REST)

```javascript
// 1. Create conversation
const conversation = await api.post('/conversations', {
  title: 'Product Strategy',
});

// 2. Send message
const response = await api.post(
  `/conversations/${conversation.id}/messages`,
  { content: 'How can we improve retention?' }
);

// 3. Poll for completion
let message = null;
while (!message || message.role !== 'assistant') {
  await new Promise(resolve => setTimeout(resolve, 1000));
  const messages = await api.get(
    `/conversations/${conversation.id}/messages?limit=2`
  );
  message = messages.data[messages.data.length - 1];
}

console.log('Response:', message.content);
```

### Real-Time Conversation (WebSocket)

```javascript
import io from 'socket.io-client';

const socket = io('wss://api.maine1.ai', {
  auth: { token: accessToken },
});

// Set up event listeners
socket.on('agent_started', (data) => {
  console.log(`🤖 ${data.agentName} is thinking...`);
});

socket.on('quality_scored', (data) => {
  console.log(`📊 Quality: ${data.score}/10`);
});

socket.on('n2_triggered', (data) => {
  console.log(`🔄 Refining answer (iteration ${data.iteration})...`);
});

socket.on('final_output', (data) => {
  console.log('✅ Answer:', data.content);
  console.log(`⚡ Completed in ${data.latencyMs}ms`);
});

// Send query
socket.emit('query', {
  conversationId: 'conv_123456',
  message: 'What is product-market fit?',
});
```

### Custom Agent Creation

```javascript
// Create specialized agent
const agent = await api.post('/agents', {
  name: 'Security Analyst',
  role: 'Security Analysis',
  goal: 'Identify security vulnerabilities and recommend mitigations',
  backstory: 'You are an expert cybersecurity analyst with 15+ years of experience in threat modeling and secure architecture design.',
  output_format: 'sim_4_lines',
  llm_model: 'gpt-4-turbo',
  temperature: 0.3,
  max_tokens: 500,
});

// Test the agent
const test = await api.post(`/agents/${agent.id}/test`, {
  query: 'Review this authentication flow for vulnerabilities',
  context: '// code here...',
});

console.log('Agent output:', test.output);
```

---

## SDKs

### Python SDK

```python
from maine1 import MainE1Client

client = MainE1Client(api_key="your_api_key")

# Create conversation
conversation = client.conversations.create(
    title="Strategy Discussion"
)

# Send message and stream response
for event in client.conversations.send_message(
    conversation_id=conversation.id,
    content="How can we scale?",
    stream=True
):
    if event.type == "agent_completed":
        print(f"Agent {event.agent_name}: {event.output}")
    elif event.type == "final_output":
        print(f"Answer: {event.content}")
```

### JavaScript/TypeScript SDK

```typescript
import { MainE1Client } from '@maine1/sdk';

const client = new MainE1Client({
  apiKey: process.env.MAINE1_API_KEY,
});

// Create conversation
const conversation = await client.conversations.create({
  title: 'Strategy Discussion',
});

// Send message with streaming
const stream = client.conversations.sendMessage({
  conversationId: conversation.id,
  content: 'How can we scale?',
});

stream.on('agent_completed', (event) => {
  console.log(`Agent ${event.agentName}: ${event.output}`);
});

stream.on('final_output', (event) => {
  console.log(`Answer: ${event.content}`);
});
```

---

## API Versioning

- Current version: **v1**
- Version specified in URL: `/v1/...`
- Backwards compatibility maintained within major versions
- Deprecation notices: 6 months minimum before removal

---

## Support & Feedback

- **API Status:** https://status.maine1.ai
- **Documentation:** https://docs.maine1.ai
- **Support:** support@maine1.ai
- **Discord:** https://discord.gg/maine1

---

**For interactive API exploration, visit: https://api.maine1.ai/docs**
