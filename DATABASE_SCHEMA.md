# MainE1 Database Schema

> **Complete data model for the N² Overmind Platform**

**Version:** 1.0  
**Database:** PostgreSQL 15+ with pgvector extension  
**ORM:** SQLAlchemy 2.0+  
**Migrations:** Alembic

---

## Overview

The database architecture follows these principles:
- **Normalized design** for data integrity
- **Audit trails** for all critical entities
- **Soft deletes** for data recovery
- **Partitioning** for scalability
- **Indexes** for query performance
- **JSONB** for flexible metadata
- **Vector embeddings** for semantic search

---

## Entity Relationship Diagram

```
┌─────────────┐       ┌──────────────┐       ┌─────────────┐
│Organizations│──1:N─▶│    Users     │──1:N─▶│Conversations│
└─────────────┘       └──────────────┘       └─────────────┘
                                                     │
                                                     │1:N
                                                     ▼
                      ┌──────────────┐       ┌─────────────┐
                      │Agent Configs │       │  Messages   │
                      └──────────────┘       └─────────────┘
                             │                      │
                             │N:M                   │1:N
                             ▼                      ▼
                      ┌──────────────┐       ┌─────────────┐
                      │  Workflows   │       │Agent Events │
                      └──────────────┘       └─────────────┘
                                                     │1:N
                                                     ▼
                                              ┌─────────────┐
                                              │Synthesis    │
                                              │  Events     │
                                              └─────────────┘
```

---

## Core Tables

### 1. organizations

Represents a company or team using the platform (multi-tenancy).

```sql
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    
    -- Subscription
    plan VARCHAR(50) NOT NULL DEFAULT 'free',  -- free, pro, enterprise
    status VARCHAR(50) NOT NULL DEFAULT 'active',  -- active, suspended, cancelled
    
    -- Quotas
    monthly_query_limit INTEGER,
    monthly_token_limit BIGINT,
    max_users INTEGER,
    
    -- Settings
    settings JSONB DEFAULT '{}'::jsonb,
    
    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_plan CHECK (plan IN ('free', 'pro', 'enterprise')),
    CONSTRAINT valid_status CHECK (status IN ('active', 'suspended', 'cancelled'))
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_status ON organizations(status) WHERE deleted_at IS NULL;
```

**Example Settings JSON:**
```json
{
  "default_llm_provider": "openai",
  "default_model": "gpt-4-turbo",
  "quality_threshold": 9.0,
  "max_n2_iterations": 4,
  "enable_analytics": true,
  "data_retention_days": 90
}
```

---

### 2. users

Individual user accounts within organizations.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Authentication
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    email_verified_at TIMESTAMP,
    
    -- Profile
    name VARCHAR(255) NOT NULL,
    avatar_url VARCHAR(500),
    
    -- Authorization
    role VARCHAR(50) NOT NULL DEFAULT 'user',  -- admin, user, viewer
    permissions JSONB DEFAULT '[]'::jsonb,
    
    -- Settings
    preferences JSONB DEFAULT '{}'::jsonb,
    
    -- Activity
    last_login_at TIMESTAMP,
    last_active_at TIMESTAMP,
    
    -- Metadata
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_role CHECK (role IN ('admin', 'user', 'viewer'))
);

CREATE INDEX idx_users_org ON users(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_last_active ON users(last_active_at DESC);
```

**Example Preferences JSON:**
```json
{
  "theme": "dark",
  "show_debug_info": false,
  "notifications_enabled": true,
  "default_conversation_title": "New Conversation",
  "auto_save": true,
  "keyboard_shortcuts_enabled": true
}
```

---

### 3. conversations

Chat sessions between users and the AI system.

```sql
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Content
    title VARCHAR(500) NOT NULL DEFAULT 'New Conversation',
    
    -- Configuration
    workflow_id UUID REFERENCES workflow_templates(id) ON DELETE SET NULL,
    quality_threshold FLOAT DEFAULT 9.0,
    max_n2_iterations INTEGER DEFAULT 4,
    
    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'active',  -- active, archived, deleted
    message_count INTEGER NOT NULL DEFAULT 0,
    
    -- Metadata
    tags VARCHAR(100)[],
    folder VARCHAR(255),
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Embedding for semantic search
    embedding vector(1536),  -- OpenAI ada-002 dimension
    
    -- Activity
    last_activity_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_status CHECK (status IN ('active', 'archived', 'deleted')),
    CONSTRAINT valid_threshold CHECK (quality_threshold >= 0 AND quality_threshold <= 10)
);

CREATE INDEX idx_conversations_user ON conversations(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_conversations_org ON conversations(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_conversations_last_activity ON conversations(last_activity_at DESC);
CREATE INDEX idx_conversations_tags ON conversations USING GIN(tags);
CREATE INDEX idx_conversations_embedding ON conversations USING ivfflat(embedding vector_cosine_ops);
```

---

### 4. messages

Individual messages within conversations (user queries and AI responses).

```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    
    -- Content
    role VARCHAR(50) NOT NULL,  -- user, assistant, system
    content TEXT NOT NULL,
    
    -- User message metadata
    edited BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMP,
    
    -- Assistant message metadata
    model_used VARCHAR(100),
    quality_score FLOAT,
    n2_iterations INTEGER,
    tokens_used INTEGER,
    latency_ms INTEGER,
    
    -- Detailed metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Embedding for semantic search
    embedding vector(1536),
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_role CHECK (role IN ('user', 'assistant', 'system')),
    CONSTRAINT valid_quality_score CHECK (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 10))
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_messages_role ON messages(role);
CREATE INDEX idx_messages_quality ON messages(quality_score DESC) WHERE quality_score IS NOT NULL;
CREATE INDEX idx_messages_embedding ON messages USING ivfflat(embedding vector_cosine_ops);

-- Partitioning by month for scalability
CREATE TABLE messages_2025_11 PARTITION OF messages
    FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
-- Additional partitions created dynamically
```

**Example Assistant Message Metadata:**
```json
{
  "agent_contributions": [
    {
      "agent_id": "creative",
      "agent_role": "Creative Clarity",
      "output": "1. Consider...\n2. Explore...\n3. Implement...\n4. Validate...",
      "tokens_used": 150,
      "latency_ms": 1200
    }
  ],
  "synthesis_details": {
    "observation": "User seeks productivity improvement strategies",
    "core_insights": ["Focus on automation", "Reduce context switching"],
    "quality_score": 9.2,
    "score_rationale": "Comprehensive, actionable, well-structured"
  },
  "n2_history": [
    {
      "iteration": 1,
      "score": 8.5,
      "repair_directive": "Provide more specific examples"
    },
    {
      "iteration": 2,
      "score": 9.2,
      "accepted": true
    }
  ]
}
```

---

### 5. agent_configurations

Custom agent definitions for organizations.

```sql
CREATE TABLE agent_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Identity
    name VARCHAR(255) NOT NULL,
    role VARCHAR(255) NOT NULL,
    goal TEXT NOT NULL,
    backstory TEXT NOT NULL,
    
    -- Configuration
    output_format VARCHAR(50) NOT NULL DEFAULT 'sim_4_lines',
    llm_provider VARCHAR(50) NOT NULL DEFAULT 'openai',
    llm_model VARCHAR(100) NOT NULL DEFAULT 'gpt-4-turbo',
    temperature FLOAT NOT NULL DEFAULT 0.7,
    max_tokens INTEGER NOT NULL DEFAULT 500,
    
    -- Behavior
    allow_delegation BOOLEAN NOT NULL DEFAULT FALSE,
    verbose BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Settings
    settings JSONB DEFAULT '{}'::jsonb,
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Usage statistics
    usage_count INTEGER NOT NULL DEFAULT 0,
    avg_quality_score FLOAT,
    
    -- Ownership
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_output_format CHECK (output_format IN ('sim_4_lines', 'json', 'markdown')),
    CONSTRAINT valid_temperature CHECK (temperature >= 0 AND temperature <= 2)
);

CREATE INDEX idx_agents_org ON agent_configurations(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_agents_active ON agent_configurations(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_agents_public ON agent_configurations(is_public) WHERE is_public = TRUE;
CREATE INDEX idx_agents_usage ON agent_configurations(usage_count DESC);
```

---

### 6. workflow_templates

Pre-configured agent combinations and execution patterns.

```sql
CREATE TABLE workflow_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Identity
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    
    -- Configuration
    agent_ids UUID[] NOT NULL,
    execution_mode VARCHAR(50) NOT NULL DEFAULT 'parallel',
    quality_threshold FLOAT NOT NULL DEFAULT 9.0,
    max_n2_iterations INTEGER NOT NULL DEFAULT 4,
    
    -- Settings
    settings JSONB DEFAULT '{}'::jsonb,
    
    -- Visibility
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    is_template BOOLEAN NOT NULL DEFAULT FALSE,  -- system template vs user workflow
    
    -- Usage statistics
    usage_count INTEGER NOT NULL DEFAULT 0,
    rating_sum INTEGER NOT NULL DEFAULT 0,
    rating_count INTEGER NOT NULL DEFAULT 0,
    
    -- Ownership
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_execution_mode CHECK (execution_mode IN ('parallel', 'sequential')),
    CONSTRAINT valid_threshold CHECK (quality_threshold >= 0 AND quality_threshold <= 10)
);

CREATE INDEX idx_workflows_org ON workflow_templates(organization_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_workflows_public ON workflow_templates(is_public) WHERE is_public = TRUE;
CREATE INDEX idx_workflows_category ON workflow_templates(category);
CREATE INDEX idx_workflows_rating ON workflow_templates((rating_sum::float / NULLIF(rating_count, 0)) DESC);
```

---

## Event & Analytics Tables

### 7. agent_events

Tracks individual agent execution events.

```sql
CREATE TABLE agent_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES agent_configurations(id) ON DELETE CASCADE,
    
    -- Event details
    event_type VARCHAR(50) NOT NULL,  -- started, completed, failed
    iteration INTEGER NOT NULL DEFAULT 1,
    
    -- Output
    output TEXT,
    error_message TEXT,
    
    -- Metrics
    tokens_used INTEGER,
    latency_ms INTEGER,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamp
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_event_type CHECK (event_type IN ('started', 'completed', 'failed'))
);

CREATE INDEX idx_agent_events_conversation ON agent_events(conversation_id);
CREATE INDEX idx_agent_events_message ON agent_events(message_id);
CREATE INDEX idx_agent_events_agent ON agent_events(agent_id);
CREATE INDEX idx_agent_events_created ON agent_events(created_at DESC);

-- Partitioning by month
CREATE TABLE agent_events_2025_11 PARTITION OF agent_events
    FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
```

---

### 8. synthesis_events

Tracks ODAI synthesis and N² loop iterations.

```sql
CREATE TABLE synthesis_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    
    -- Iteration details
    iteration INTEGER NOT NULL DEFAULT 1,
    quality_score FLOAT NOT NULL,
    triggered_n2 BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- ODAI phases
    observation TEXT,
    distillation JSONB,
    repair_directive TEXT,
    final_output TEXT,
    
    -- Metrics
    latency_ms INTEGER,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamp
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_quality_score CHECK (quality_score >= 0 AND quality_score <= 10)
);

CREATE INDEX idx_synthesis_events_conversation ON synthesis_events(conversation_id);
CREATE INDEX idx_synthesis_events_message ON synthesis_events(message_id);
CREATE INDEX idx_synthesis_events_quality ON synthesis_events(quality_score DESC);
CREATE INDEX idx_synthesis_events_n2 ON synthesis_events(triggered_n2) WHERE triggered_n2 = TRUE;
```

---

### 9. usage_metrics

Aggregated usage statistics (time-series data).

```sql
CREATE TABLE usage_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Time bucket
    metric_date DATE NOT NULL,
    metric_hour INTEGER,  -- 0-23 for hourly metrics, NULL for daily
    
    -- Metrics
    query_count INTEGER NOT NULL DEFAULT 0,
    message_count INTEGER NOT NULL DEFAULT 0,
    token_count BIGINT NOT NULL DEFAULT 0,
    
    -- Quality metrics
    avg_quality_score FLOAT,
    n2_trigger_count INTEGER NOT NULL DEFAULT 0,
    
    -- Performance metrics
    avg_latency_ms INTEGER,
    p95_latency_ms INTEGER,
    error_count INTEGER NOT NULL DEFAULT 0,
    
    -- Cost metrics
    estimated_cost_usd DECIMAL(10, 4),
    
    -- Timestamp
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Unique constraint for time buckets
    UNIQUE(organization_id, user_id, metric_date, metric_hour)
);

CREATE INDEX idx_usage_metrics_org_date ON usage_metrics(organization_id, metric_date DESC);
CREATE INDEX idx_usage_metrics_user_date ON usage_metrics(user_id, metric_date DESC) WHERE user_id IS NOT NULL;

-- Hypertable for TimescaleDB (optional, for time-series optimization)
-- SELECT create_hypertable('usage_metrics', 'metric_date');
```

---

## Authentication & Security Tables

### 10. api_keys

API keys for programmatic access.

```sql
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Key details
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    key_prefix VARCHAR(20) NOT NULL,  -- First 8 chars for display (e.g., "pk_live_abc12345")
    
    -- Permissions
    scopes JSONB NOT NULL DEFAULT '["read"]'::jsonb,
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMP,
    
    -- Usage tracking
    last_used_at TIMESTAMP,
    usage_count BIGINT NOT NULL DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMP
);

CREATE INDEX idx_api_keys_org ON api_keys(organization_id);
CREATE INDEX idx_api_keys_user ON api_keys(user_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_active ON api_keys(is_active) WHERE is_active = TRUE;
```

---

### 11. audit_logs

Comprehensive audit trail for security and compliance.

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Event details
    event_type VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    
    -- Action details
    action VARCHAR(50) NOT NULL,  -- create, read, update, delete, execute
    status VARCHAR(50) NOT NULL,  -- success, failure
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    
    -- Changes (for updates)
    old_values JSONB,
    new_values JSONB,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamp
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT valid_action CHECK (action IN ('create', 'read', 'update', 'delete', 'execute')),
    CONSTRAINT valid_status CHECK (status IN ('success', 'failure'))
);

CREATE INDEX idx_audit_logs_org ON audit_logs(organization_id, created_at DESC);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- Partitioning by month
CREATE TABLE audit_logs_2025_11 PARTITION OF audit_logs
    FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
```

---

## Supporting Tables

### 12. sessions

User session management (optional, for multi-device support).

```sql
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Session details
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    refresh_token_hash VARCHAR(255) UNIQUE,
    
    -- Device info
    device_name VARCHAR(255),
    device_type VARCHAR(50),  -- web, mobile, api
    ip_address INET,
    user_agent TEXT,
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMP NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_active_at TIMESTAMP NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMP
);

CREATE INDEX idx_sessions_user ON sessions(user_id) WHERE is_active = TRUE;
CREATE INDEX idx_sessions_token ON sessions(token_hash);
CREATE INDEX idx_sessions_expires ON sessions(expires_at) WHERE is_active = TRUE;
```

---

### 13. invitations

Team member invitation system.

```sql
CREATE TABLE invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Invitation details
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    token VARCHAR(255) UNIQUE NOT NULL,
    
    -- Status
    status VARCHAR(50) NOT NULL DEFAULT 'pending',  -- pending, accepted, expired, cancelled
    expires_at TIMESTAMP NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMP,
    
    -- Constraints
    CONSTRAINT valid_role CHECK (role IN ('admin', 'user', 'viewer')),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled'))
);

CREATE INDEX idx_invitations_org ON invitations(organization_id);
CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_status ON invitations(status) WHERE status = 'pending';
```

---

## Views for Common Queries

### conversation_stats

```sql
CREATE VIEW conversation_stats AS
SELECT 
    c.id,
    c.user_id,
    c.organization_id,
    c.title,
    c.message_count,
    c.last_activity_at,
    COUNT(DISTINCT m.id) AS actual_message_count,
    AVG(m.quality_score) FILTER (WHERE m.role = 'assistant') AS avg_quality_score,
    SUM(m.tokens_used) FILTER (WHERE m.role = 'assistant') AS total_tokens,
    AVG(m.latency_ms) FILTER (WHERE m.role = 'assistant') AS avg_latency_ms,
    MAX(m.n2_iterations) FILTER (WHERE m.role = 'assistant') AS max_n2_iterations
FROM conversations c
LEFT JOIN messages m ON c.id = m.conversation_id AND m.deleted_at IS NULL
WHERE c.deleted_at IS NULL
GROUP BY c.id;
```

### organization_usage

```sql
CREATE VIEW organization_usage AS
SELECT 
    o.id AS organization_id,
    o.name AS organization_name,
    COUNT(DISTINCT u.id) AS user_count,
    COUNT(DISTINCT c.id) AS conversation_count,
    SUM(c.message_count) AS total_messages,
    SUM(um.query_count) AS total_queries,
    SUM(um.token_count) AS total_tokens,
    SUM(um.estimated_cost_usd) AS total_cost_usd,
    AVG(m.quality_score) FILTER (WHERE m.role = 'assistant') AS avg_quality_score
FROM organizations o
LEFT JOIN users u ON o.id = u.organization_id AND u.deleted_at IS NULL
LEFT JOIN conversations c ON o.id = c.organization_id AND c.deleted_at IS NULL
LEFT JOIN messages m ON c.id = m.conversation_id AND m.deleted_at IS NULL
LEFT JOIN usage_metrics um ON o.id = um.organization_id
WHERE o.deleted_at IS NULL
GROUP BY o.id, o.name;
```

---

## Triggers

### Update conversation message count

```sql
CREATE OR REPLACE FUNCTION update_conversation_message_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE conversations 
        SET 
            message_count = message_count + 1,
            last_activity_at = NOW()
        WHERE id = NEW.conversation_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE conversations 
        SET message_count = message_count - 1
        WHERE id = OLD.conversation_id;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_conversation_message_count
AFTER INSERT OR DELETE ON messages
FOR EACH ROW EXECUTE FUNCTION update_conversation_message_count();
```

### Update timestamps

```sql
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER trigger_update_organizations_updated_at
BEFORE UPDATE ON organizations
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ... (apply to all relevant tables)
```

---

## Indexes Summary

### Performance-Critical Indexes

```sql
-- Conversation queries (most frequent)
CREATE INDEX idx_messages_conversation_created 
ON messages(conversation_id, created_at DESC) 
WHERE deleted_at IS NULL;

-- User dashboard
CREATE INDEX idx_conversations_user_activity 
ON conversations(user_id, last_activity_at DESC) 
WHERE deleted_at IS NULL;

-- Semantic search
CREATE INDEX idx_messages_embedding 
ON messages USING ivfflat(embedding vector_cosine_ops) 
WITH (lists = 100);

-- Analytics queries
CREATE INDEX idx_usage_metrics_org_date_range 
ON usage_metrics(organization_id, metric_date) 
INCLUDE (query_count, token_count, estimated_cost_usd);
```

---

## Database Maintenance

### Partitioning Strategy

```sql
-- Automatic partition creation function
CREATE OR REPLACE FUNCTION create_monthly_partitions()
RETURNS void AS $$
DECLARE
    partition_date DATE;
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    FOR i IN 0..3 LOOP
        partition_date := DATE_TRUNC('month', CURRENT_DATE + (i || ' months')::INTERVAL);
        start_date := partition_date;
        end_date := partition_date + INTERVAL '1 month';
        
        partition_name := 'messages_' || TO_CHAR(partition_date, 'YYYY_MM');
        
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I PARTITION OF messages
            FOR VALUES FROM (%L) TO (%L)
        ', partition_name, start_date, end_date);
        
        partition_name := 'agent_events_' || TO_CHAR(partition_date, 'YYYY_MM');
        
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I PARTITION OF agent_events
            FOR VALUES FROM (%L) TO (%L)
        ', partition_name, start_date, end_date);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Schedule with pg_cron (if available)
-- SELECT cron.schedule('create-partitions', '0 0 1 * *', 'SELECT create_monthly_partitions()');
```

### Vacuum and Analyze

```sql
-- Regular maintenance (run via cron)
VACUUM ANALYZE messages;
VACUUM ANALYZE agent_events;
VACUUM ANALYZE synthesis_events;
```

---

## Backup Strategy

### Full Backup (Daily)
```bash
pg_dump -Fc maine1_db > backup_$(date +%Y%m%d).dump
```

### Point-in-Time Recovery
- Enable WAL archiving
- Continuous archiving to S3
- 30-day retention

---

## Migration Strategy

### Initial Schema

```bash
# Initialize Alembic
alembic init alembic

# Create initial migration
alembic revision --autogenerate -m "Initial schema"

# Apply migration
alembic upgrade head
```

### Schema Changes

```python
# Example migration
def upgrade():
    op.add_column('conversations', 
        sa.Column('embedding', Vector(1536), nullable=True))
    op.create_index('idx_conversations_embedding', 
        'conversations', ['embedding'], 
        postgresql_using='ivfflat', 
        postgresql_ops={'embedding': 'vector_cosine_ops'})

def downgrade():
    op.drop_index('idx_conversations_embedding')
    op.drop_column('conversations', 'embedding')
```

---

## Sample Data

### Seed Data for Development

```sql
-- Default system agents
INSERT INTO agent_configurations (id, organization_id, name, role, goal, backstory, is_template, is_public, created_by) VALUES
('creative-001', NULL, 'Creative Clarity', 'Creative Clarity', 'Generate clear, innovative solutions and novel perspectives', 'You are a creative thinker focused on ideation. Output exactly 4 numbered SIM steps only.', TRUE, TRUE, NULL),
('structural-001', NULL, 'Structural Clarity', 'Structural Clarity', 'Organize information and relieve cognitive overload', 'You bring structure to chaos. Output exactly 4 numbered SIM steps only.', TRUE, TRUE, NULL),
-- ... (remaining default agents)
;

-- Sample workflow templates
INSERT INTO workflow_templates (id, name, description, category, agent_ids, is_public, is_template) VALUES
('workflow-general', 'General Problem Solving', 'Balanced approach for diverse queries', 'general', 
 ARRAY['creative-001', 'structural-001', 'alignment-001', 'decision-001', 'recovery-001', 'boundary-001']::UUID[], 
 TRUE, TRUE);
```

---

## Performance Benchmarks

### Expected Query Performance

| Query Type | Target | Notes |
|------------|--------|-------|
| Get conversation | <10ms | With messages (last 50) |
| List conversations | <50ms | With pagination (20 per page) |
| Create message | <100ms | Includes embedding |
| Semantic search | <200ms | Top 10 results |
| Analytics dashboard | <500ms | Daily aggregates |

---

**This schema is designed for production scale. Start simple and add complexity as needed based on actual usage patterns.**
