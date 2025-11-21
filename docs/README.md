# CodeMind Documentation

Welcome to the CodeMind documentation! This directory contains all technical documentation, design documents, implementation guides, and historical fix logs.

## 📁 Directory Structure

### [`design/`](./design/)
Core architecture and design philosophy documents:
- **DESIGN_PRINCIPLES.md** - Core design philosophy and principles
- **AGENT_SYSTEM.md** - Multi-agent system architecture
- **UI_DESIGN_PRINCIPLES.md** - UI/UX guidelines and standards
- **ORCHESTRATOR_DESIGN.md** - Orchestrator agent design (Composer analog)

### [`implementation/`](./implementation/)
Implementation plans, roadmaps, and development guides:
- **IMPLEMENTATION_GUIDE.md** - VSCode fork setup and build instructions
- **IMPLEMENTATION_PLAN.md** - Detailed implementation phases and progress
- **ORCHESTRATOR_TODO.md** - Comprehensive Orchestrator + Chat roadmap
- **ROADMAP.md** - High-level project roadmap
- **NEXT_STEPS.md** - Immediate next steps and priorities

### [`fixes/`](./fixes/)
Historical documentation of bugs fixed and features added:
- Technical implementation details for each major fix
- Problem descriptions, root causes, and solutions
- Organized chronologically as development progressed

### [`guides/`](./guides/)
User and developer quick start guides:
- **QUICK_START.md** - Quick setup guide for OpenRouter integration

## 🚀 Getting Started

1. **New to CodeMind?** Start with [`../README.md`](../README.md) in the project root
2. **Setting up development?** See [`implementation/IMPLEMENTATION_GUIDE.md`](./implementation/IMPLEMENTATION_GUIDE.md)
3. **Want to understand the architecture?** Read [`design/AGENT_SYSTEM.md`](./design/AGENT_SYSTEM.md) and [`design/ORCHESTRATOR_DESIGN.md`](./design/ORCHESTRATOR_DESIGN.md)
4. **Ready to use CodeMind?** Check [`guides/QUICK_START.md`](./guides/QUICK_START.md)

## 📊 Project Status

**Phase 1-2: COMPLETE ✅**
- Multi-agent system with 6 specialists
- ODAI synthesis cycle
- N² self-correction loop
- Task-aware agents with relevance scoring
- Beautiful custom UI components
- Robust LLM integration

**Phase 3: IN PLANNING 📋**
- Orchestrator agent (multi-file operations)
- Chat/Composer interface
- Git worktree integration (instant rollback)
- Session management

See [`implementation/ORCHESTRATOR_TODO.md`](./implementation/ORCHESTRATOR_TODO.md) for the complete roadmap.

## 🏛️ Architecture Overview

CodeMind is a hierarchical multi-agent cognitive architecture for code intelligence:

```
User Request
    ↓
Orchestrator Agent (Task Analysis & Planning)
    ↓
Specialist Agents (6 perspectives)
    ├── Architect (structure & patterns)
    ├── Engineer (implementation)
    ├── Security (vulnerabilities)
    ├── Performance (optimization)
    ├── Testing (quality assurance)
    └── Documentation (clarity)
    ↓
ODAI Synthesis (Observe → Distill → Adapt → Integrate)
    ↓
N² Loop (Iterative refinement until quality threshold)
    ↓
Verified Code Output
```

## 🎯 Key Features

- **Task-Aware Agents**: Agents self-assess relevance and adapt prompts based on task type
- **Weighted Quality**: Agent contributions weighted by relevance × confidence
- **Early Stopping**: N² loop stops on quality plateaus or regression
- **Robust JSON Parsing**: Multiple fallback strategies for malformed LLM output
- **Full Context**: Agents receive complete file + selection + diagnostics
- **Beautiful UI**: Custom progress panel, results panel, analysis sidebar
- **Inline Diff**: GitHub-style diff viewer with decorations

## 📝 Contributing

When adding new documentation:
- **Design decisions** → `design/`
- **Implementation plans** → `implementation/`
- **Bug fixes/features** → `fixes/` (with descriptive filename)
- **User guides** → `guides/`

Keep documentation up-to-date as the codebase evolves!


