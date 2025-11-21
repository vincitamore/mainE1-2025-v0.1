# CodeMind Implementation Plan

> **Detailed implementation plan from current stub code to production-ready multi-agent system**

**Status**: Phase 2 COMPLETE ✅ (All systems functional)  
**Next Phase**: Polish UI & Build Diff View  
**Estimated Timeline**: 13 weeks to MVP (9 weeks remaining)

---

## 🎯 End Goal: Autonomous Multi-Agent Coding Assistant

**What We're Building**:

Like **Cursor Composer**, but with **6-specialist multi-agent architecture** for higher quality and deeper reasoning.

### User Experience (Target)

```
User: "Add JWT authentication to this Express app"

CodeMind Orchestrator:
  1. Analyzes codebase structure
  2. Creates 8-step execution plan
  3. Shows plan → user approves
  4. Executes autonomously:
     - Installs dependencies (npm)
     - Creates auth middleware
     - Updates routes
     - Adds tests
     - Each step analyzed by 6 specialists
     - Each step validated by N² loop
  5. Shows diff of all changes
  6. User accepts → applied atomically
  
Result: Production-ready auth system in 45 seconds
```

### The Architecture (How It Works)

```
┌──────────────────────────────────────────────────────┐
│         ORCHESTRATOR (Task Completion)                │ ← Weeks 5-6
│  • Takes high-level tasks                             │
│  • Creates execution plans                            │
│  • Coordinates multi-file operations                  │
│  • Runs commands, verifies results                    │
└────────────────────┬──────────────────────────────────┘
                     │
┌────────────────────┴──────────────────────────────────┐
│         N² LOOP (Quality Control)                      │ ← Week 4
│  • Evaluates output quality (0-10)                    │
│  • Triggers refinement if score < 9                   │
└────────────────────┬──────────────────────────────────┘
                     │
┌────────────────────┴──────────────────────────────────┐
│         ODAI SYNTHESIZER (Code Generation)             │ ← Week 3
│  • Integrates 6 agent perspectives                    │
│  • Generates unified code solution                    │
└────────────────────┬──────────────────────────────────┘
                     │
┌────────────────────┴──────────────────────────────────┐
│         6 SPECIALIST AGENTS (Analysis)                 │ ← Weeks 1-2 ✅
│  Architect • Engineer • Security                      │
│  Performance • Testing • Documentation                │
│  • Each analyzes code from their domain               │
│  • Runs in parallel for speed                         │
└────────────────────────────────────────────────────────┘
```

**Key Insight**: We're building **bottom-up**. The 6 agents are the foundation that everything else builds upon.

---

## Current Status

✅ **Completed**:
- VSCode fork cloned and built
- Development environment set up (Node v22, VS Build Tools)
- Basic extension structure created (`vscode/extensions/codemind-agent/`)
- Extension activates and responds to Ctrl+K
- Basic command registration working

📁 **Current Structure**:
```
vscode/extensions/codemind-agent/
├── package.json          (Extension manifest)
├── tsconfig.json         (TypeScript config)
├── src/
│   └── extension.ts      (Basic activation + stub commands)
└── out/
    └── extension.js      (Compiled output)
```

⚠️ **What's Missing**:
- LLM provider integration
- Agent system architecture
- ODAI synthesis layer
- N² self-correction loop
- Code intelligence (AST parsing, indexing)
- UI components (diff view, analysis panel)

---

## Implementation Phases

### Phase 2: Core Agent System (Weeks 1-4) ← **CURRENT**
**Goal**: Build the foundational multi-agent architecture with working N² loop
**Output**: 6 agents can analyze code and suggest improvements (single-file)

### Phase 3: Orchestrator System (Weeks 5-6)
**Goal**: Add autonomous task execution and multi-file coordination
**Output**: Can complete complex tasks like "Add authentication" autonomously
**Reference**: See `ORCHESTRATOR_DESIGN.md` for full specification

### Phase 4: Code Intelligence (Weeks 7-8)
**Goal**: Add AST parsing, symbol indexing, and semantic search
**Output**: Deep codebase understanding for better context gathering

### Phase 5: UI & Polish (Weeks 9-10)
**Goal**: Build beautiful UI for displaying results and accepting changes
**Output**: Professional, polished interface (see `UI_DESIGN_PRINCIPLES.md`)

### Phase 6: Advanced Features (Weeks 11-12)
**Goal**: Add autocomplete, testing integration, local models

---

## Phase 2: Core Agent System (4 Weeks)

### Week 1: LLM Integration & Agent Framework

#### Task 2.1: Create LLM Provider Abstraction
**File**: `vscode/extensions/codemind-agent/src/llm/provider.ts`

```typescript
export interface LLMConfig {
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  tokensUsed: number;
  finishReason: 'stop' | 'length' | 'error';
  model: string;
}

export interface LLMProvider {
  name: string;
  models: string[];
  
  generate(
    messages: LLMMessage[],
    config: LLMConfig
  ): Promise<LLMResponse>;
  
  stream(
    messages: LLMMessage[],
    config: LLMConfig
  ): AsyncIterable<string>;
  
  countTokens(text: string): number;
}
```

**Test**: Create a simple test that verifies the interface is correct.

---

#### Task 2.2: Implement OpenRouter Provider
**File**: `vscode/extensions/codemind-agent/src/llm/openrouter-provider.ts`

```typescript
import { LLMProvider, LLMConfig, LLMMessage, LLMResponse } from './provider';

export class OpenRouterProvider implements LLMProvider {
  name = 'openrouter';
  models = [
    'x-ai/grok-4.1-fast',
    'anthropic/claude-3.5-sonnet',
    'meta-llama/llama-3.1-405b-instruct'
  ];
  
  private apiKey: string;
  private baseURL = 'https://openrouter.ai/api/v1';
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  async generate(
    messages: LLMMessage[],
    config: LLMConfig
  ): Promise<LLMResponse> {
    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/yourusername/codemind',
          'X-Title': 'CodeMind'
        },
        body: JSON.stringify({
          model: config.model || 'x-ai/grok-4.1-fast',
          messages: messages,
          temperature: config.temperature,
          max_tokens: config.maxTokens,
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenRouter API error: ${error.error?.message || response.statusText}`);
      }
      
      const data = await response.json();
      
      return {
        content: data.choices[0].message.content || '',
        tokensUsed: data.usage?.total_tokens || 0,
        finishReason: data.choices[0].finish_reason,
        model: data.model
      };
    } catch (error: any) {
      throw new Error(`OpenRouter API error: ${error.message}`);
    }
  }
  
  async *stream(
    messages: LLMMessage[],
    config: LLMConfig
  ): AsyncIterable<string> {
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/yourusername/codemind',
        'X-Title': 'CodeMind'
      },
      body: JSON.stringify({
        model: config.model || 'x-ai/grok-4.1-fast',
        messages: messages,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        stream: true
      })
    });
    
    if (!response.ok || !response.body) {
      throw new Error(`OpenRouter stream error: ${response.statusText}`);
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim().startsWith('data:'));
      
      for (const line of lines) {
        const data = line.replace('data: ', '').trim();
        if (data === '[DONE]') continue;
        
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices[0]?.delta?.content;
          if (content) {
            yield content;
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }
  }
  
  countTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }
}
```

**No Dependencies Needed!** - OpenRouter uses standard fetch API.

**Test**: Add your OpenRouter API key to settings and test with Grok 4.1 Fast.

---

#### Task 2.3: Create Agent Base Class
**File**: `vscode/extensions/codemind-agent/src/agents/agent.ts`

```typescript
import { LLMProvider, LLMConfig, LLMMessage } from '../llm/provider';

export enum AgentRole {
  ARCHITECT = 'architect',
  ENGINEER = 'engineer',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  TESTING = 'testing',
  DOCUMENTATION = 'documentation'
}

export interface Issue {
  type: string;
  line?: number;
  description: string;
  fix: string;
  impact?: string;
}

export interface AgentAnalysis {
  agent: AgentRole;
  insights: string[];
  issues: {
    critical: Issue[];
    warnings: Issue[];
    suggestions: Issue[];
  };
  recommendations: string[];
  confidence: number;
  executionTime: number;
}

export interface CodeContext {
  code: string;
  filePath: string;
  language: string;
  selection?: string;
  framework?: string;
}

export abstract class Agent {
  abstract readonly role: AgentRole;
  abstract readonly perspective: string;
  
  constructor(
    protected llmProvider: LLMProvider,
    protected config: LLMConfig
  ) {}
  
  async analyze(
    request: string,
    context: CodeContext,
    repairDirective?: string
  ): Promise<AgentAnalysis> {
    const startTime = Date.now();
    
    const prompt = this.buildPrompt(request, context, repairDirective);
    const response = await this.llmProvider.generate(
      [
        {
          role: 'system',
          content: `You are an expert ${this.role} agent. Your perspective: ${this.perspective}`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      this.config
    );
    
    const analysis = this.parseResponse(response.content);
    analysis.executionTime = Date.now() - startTime;
    
    return analysis;
  }
  
  protected abstract buildPrompt(
    request: string,
    context: CodeContext,
    repairDirective?: string
  ): string;
  
  protected parseResponse(response: string): AgentAnalysis {
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : response;
      
      const parsed = JSON.parse(jsonStr);
      return {
        agent: this.role,
        insights: parsed.insights || [],
        issues: parsed.issues || { critical: [], warnings: [], suggestions: [] },
        recommendations: parsed.recommendations || [],
        confidence: parsed.confidence || 0.8,
        executionTime: 0
      };
    } catch (error) {
      // Fallback parsing if JSON fails
      return {
        agent: this.role,
        insights: [response.substring(0, 200)],
        issues: { critical: [], warnings: [], suggestions: [] },
        recommendations: [],
        confidence: 0.5,
        executionTime: 0
      };
    }
  }
}
```

**Test**: Verify the base class compiles without errors.

---

### Week 2: Implement Six Specialist Agents

#### Task 2.4: Implement Security Agent
**File**: `vscode/extensions/codemind-agent/src/agents/security-agent.ts`

```typescript
import { Agent, AgentRole, CodeContext, AgentAnalysis } from './agent';

export class SecurityAgent extends Agent {
  readonly role = AgentRole.SECURITY;
  readonly perspective = 'Security vulnerabilities, data protection, threat mitigation';
  
  protected buildPrompt(
    request: string,
    context: CodeContext,
    repairDirective?: string
  ): string {
    return `You are an expert security engineer reviewing code for vulnerabilities.

Your role: ${this.perspective}

User request: ${request}

Code to analyze:
\`\`\`${context.language}
${context.code}
\`\`\`

File: ${context.filePath}
${context.framework ? `Framework: ${context.framework}` : ''}

${repairDirective ? `IMPORTANT - Address these issues from previous iteration:\n${repairDirective}\n` : ''}

Analyze for security issues:
1. Authentication and authorization flaws
2. Input validation and sanitization
3. Injection vulnerabilities (SQL, XSS, command injection)
4. Data exposure (secrets, PII in logs/errors)
5. Cryptographic security
6. Insecure dependencies
7. CSRF, XSS, SSRF vulnerabilities

Return JSON with this EXACT structure:
\`\`\`json
{
  "insights": [
    "Key security observation 1",
    "Key security observation 2"
  ],
  "issues": {
    "critical": [
      {
        "type": "sql_injection",
        "line": 42,
        "description": "User input concatenated directly into SQL query",
        "fix": "Use parameterized queries or ORM",
        "impact": "Allows attacker to execute arbitrary SQL"
      }
    ],
    "warnings": [
      {
        "type": "weak_crypto",
        "line": 15,
        "description": "Using MD5 for password hashing",
        "fix": "Use bcrypt or argon2",
        "impact": "Passwords vulnerable to rainbow table attacks"
      }
    ],
    "suggestions": [
      {
        "type": "rate_limiting",
        "description": "No rate limiting on login endpoint",
        "fix": "Add rate limiting middleware",
        "impact": "Vulnerable to brute force attacks"
      }
    ]
  },
  "recommendations": [
    "Use parameterized queries for all database access",
    "Implement rate limiting on authentication endpoints",
    "Add CSRF tokens to state-changing operations"
  ],
  "confidence": 0.95
}
\`\`\`

Be specific. Reference line numbers. Provide actionable fixes.`;
  }
}
```

**Test**: Create a simple vulnerable code snippet and verify the agent identifies the issues.

---

#### Task 2.5-2.9: Implement Remaining Agents

Create similar files for:
- `architect-agent.ts` - Design patterns, SOLID principles, architecture
- `engineer-agent.ts` - Correctness, edge cases, error handling
- `performance-agent.ts` - Complexity, optimization, scaling
- `testing-agent.ts` - Test coverage, testability, test cases
- `documentation-agent.ts` - Code clarity, naming, documentation

**File**: `vscode/extensions/codemind-agent/src/agents/index.ts`
```typescript
export * from './agent';
export * from './architect-agent';
export * from './engineer-agent';
export * from './security-agent';
export * from './performance-agent';
export * from './testing-agent';
export * from './documentation-agent';
```

**Success Criteria**:
- All 6 agents compile without errors
- Each agent has unique prompt focusing on their domain
- Each agent returns structured JSON

---

### Week 3: ODAI Synthesis Layer

#### Task 2.10: Implement ODAI Synthesizer
**File**: `vscode/extensions/codemind-agent/src/synthesis/odai-synthesizer.ts`

```typescript
import { AgentAnalysis } from '../agents/agent';
import { LLMProvider, LLMConfig } from '../llm/provider';

export interface SynthesisResult {
  success: boolean;
  code?: string;
  explanation?: string;
  qualityScore: number;
  repairDirective?: RepairDirective;
  keyDecisions?: Record<string, string>;
}

export interface RepairDirective {
  overallGuidance: string;
  agentSpecific: Record<string, string>;
  focusAreas: string[];
}

export class ODAISynthesizer {
  constructor(
    private llmProvider: LLMProvider,
    private qualityThreshold: number = 9.0
  ) {}
  
  async synthesize(
    request: string,
    analyses: AgentAnalysis[],
    context: any
  ): Promise<SynthesisResult> {
    // Phase 1 & 2: Observe and Distill
    const distillation = await this.observeAndDistill(request, analyses);
    
    // Check quality
    if (distillation.qualityScore >= this.qualityThreshold) {
      // Phase 4: Integrate
      return await this.integrate(distillation, context);
    } else {
      // Phase 3: Adapt
      return await this.adapt(distillation);
    }
  }
  
  private async observeAndDistill(
    request: string,
    analyses: AgentAnalysis[]
  ): Promise<any> {
    const prompt = `You are the Central Consciousness analyzing multiple expert perspectives.

User Request: ${request}

Expert Analyses:
${analyses.map(a => `
${a.agent.toUpperCase()}:
Insights: ${a.insights.join('; ')}
Critical Issues: ${a.issues.critical.length}
Warnings: ${a.issues.warnings.length}
Recommendations: ${a.recommendations.join('; ')}
Confidence: ${a.confidence}
`).join('\n')}

Distill the core requirements and assign a quality score:

1. Core requirements (what MUST be in solution)
2. Key constraints (what solution CANNOT violate)
3. Quality score (0-10): How well can we address this request?
   - 9-10: Excellent, ready to implement
   - 7-8: Good, minor gaps
   - 5-6: Mediocre, significant gaps
   - 0-4: Poor, fundamental issues
4. Scoring rationale (WHY that score)

Return JSON:
\`\`\`json
{
  "coreRequirements": [
    "Must handle all user inputs",
    "Must include error handling"
  ],
  "keyConstraints": [
    "Cannot break existing API",
    "Must maintain performance"
  ],
  "qualityScore": 8.5,
  "scoringRationale": "Clear requirements and good coverage from agents, but missing details on error recovery strategy"
}
\`\`\``;

    const response = await this.llmProvider.generate(
      [{ role: 'user', content: prompt }],
      {
        model: 'x-ai/grok-4.1-fast',
        temperature: 0.2,
        maxTokens: 1000
      }
    );
    
    const jsonMatch = response.content.match(/```json\n([\s\S]*?)\n```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : response.content;
    return JSON.parse(jsonStr);
  }
  
  private async integrate(distillation: any, context: any): Promise<SynthesisResult> {
    const prompt = `Generate final code implementation.

Requirements:
${distillation.coreRequirements.map((r: string) => `- ${r}`).join('\n')}

Constraints:
${distillation.keyConstraints.map((c: string) => `- ${c}`).join('\n')}

Context:
- Language: ${context.language}
- File: ${context.filePath}

Existing code:
\`\`\`${context.language}
${context.code}
\`\`\`

Generate production-ready code that satisfies all requirements and constraints.

Return JSON:
\`\`\`json
{
  "code": "... complete implementation ...",
  "explanation": "What was implemented and why",
  "keyDecisions": {
    "architecture": "Design choice made",
    "security": "Security measures taken",
    "performance": "Optimizations applied"
  }
}
\`\`\``;

    const response = await this.llmProvider.generate(
      [{ role: 'user', content: prompt }],
      {
        model: 'gpt-4-turbo-preview',
        temperature: 0.4,
        maxTokens: 2000
      }
    );
    
    const jsonMatch = response.content.match(/```json\n([\s\S]*?)\n```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : response.content;
    const result = JSON.parse(jsonStr);
    
    return {
      success: true,
      code: result.code,
      explanation: result.explanation,
      qualityScore: distillation.qualityScore,
      keyDecisions: result.keyDecisions
    };
  }
  
  private async adapt(distillation: any): Promise<SynthesisResult> {
    const prompt = `Quality score ${distillation.qualityScore} is below threshold ${this.qualityThreshold}.

Current analysis:
${JSON.stringify(distillation, null, 2)}

Generate specific repair directive:
1. What is preventing higher quality?
2. What should each agent focus on in next iteration?

Return JSON:
\`\`\`json
{
  "overallGuidance": "Agents need to provide more specific implementation details",
  "agentSpecific": {
    "architect": "Define specific design patterns to use",
    "engineer": "Provide concrete edge case handling",
    "security": "Specify exact sanitization methods",
    "performance": "Identify specific optimization opportunities",
    "testing": "Outline specific test cases needed",
    "documentation": "Clarify API documentation requirements"
  },
  "focusAreas": ["Error handling", "Input validation", "Performance"]
}
\`\`\``;

    const response = await this.llmProvider.generate(
      [{ role: 'user', content: prompt }],
      {
        model: 'gpt-4-turbo-preview',
        temperature: 0.3,
        maxTokens: 1000
      }
    );
    
    const jsonMatch = response.content.match(/```json\n([\s\S]*?)\n```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : response.content;
    const repairDirective = JSON.parse(jsonStr);
    
    return {
      success: false,
      qualityScore: distillation.qualityScore,
      repairDirective
    };
  }
}
```

**Test**: Run synthesizer with mock agent analyses to verify it produces code or repair directives.

---

### Week 4: N² Loop Controller

#### Task 2.11: Implement N² Controller
**File**: `vscode/extensions/codemind-agent/src/synthesis/n2-controller.ts`

```typescript
import { Agent, AgentAnalysis, CodeContext } from '../agents/agent';
import { ODAISynthesizer, SynthesisResult } from './odai-synthesizer';

export interface N2Result {
  success: boolean;
  output: string;
  explanation: string;
  qualityScore: number;
  iterations: number;
  totalTime: number;
  history: IterationHistory[];
}

export interface IterationHistory {
  iteration: number;
  analyses: AgentAnalysis[];
  synthesis: SynthesisResult;
  qualityScore: number;
}

export class N2Controller {
  constructor(
    private maxIterations: number = 4,
    private qualityThreshold: number = 9.0
  ) {}
  
  async execute(
    request: string,
    agents: Agent[],
    synthesizer: ODAISynthesizer,
    context: CodeContext
  ): Promise<N2Result> {
    const startTime = Date.now();
    const history: IterationHistory[] = [];
    let currentRepairDirective: any;
    
    for (let i = 0; i < this.maxIterations; i++) {
      console.log(`[N² Loop] Iteration ${i + 1}/${this.maxIterations}`);
      
      // Execute all agents in parallel
      const analyses = await Promise.all(
        agents.map(agent =>
          agent.analyze(
            request,
            context,
            currentRepairDirective?.agentSpecific?.[agent.role]
          )
        )
      );
      
      console.log(`[N² Loop] Agents completed in parallel`);
      
      // Synthesize
      const synthesis = await synthesizer.synthesize(request, analyses, context);
      
      console.log(`[N² Loop] Synthesis quality score: ${synthesis.qualityScore}/10`);
      
      // Record history
      history.push({
        iteration: i + 1,
        analyses,
        synthesis,
        qualityScore: synthesis.qualityScore
      });
      
      // Check if quality met
      if (synthesis.success && synthesis.qualityScore >= this.qualityThreshold) {
        console.log(`[N² Loop] Quality threshold met! Accepting solution.`);
        return {
          success: true,
          output: synthesis.code || '',
          explanation: synthesis.explanation || '',
          qualityScore: synthesis.qualityScore,
          iterations: i + 1,
          totalTime: Date.now() - startTime,
          history
        };
      }
      
      // Prepare for next iteration
      if (i < this.maxIterations - 1) {
        currentRepairDirective = synthesis.repairDirective;
        console.log(`[N² Loop] Quality below threshold, refining...`);
      }
    }
    
    // Max iterations reached
    const lastSynthesis = history[history.length - 1].synthesis;
    
    console.log(`[N² Loop] Max iterations reached. Best score: ${lastSynthesis.qualityScore}/10`);
    
    return {
      success: false,
      output: lastSynthesis.code || '',
      explanation: lastSynthesis.explanation || '',
      qualityScore: lastSynthesis.qualityScore,
      iterations: this.maxIterations,
      totalTime: Date.now() - startTime,
      history
    };
  }
}
```

**Test**: Run N² loop with all agents and verify it iterates correctly.

---

#### Task 2.12: Wire Up Extension
**File**: `vscode/extensions/codemind-agent/src/extension.ts`

```typescript
import * as vscode from 'vscode';
import { OpenRouterProvider } from './llm/openrouter-provider';
import { ArchitectAgent } from './agents/architect-agent';
import { EngineerAgent } from './agents/engineer-agent';
import { SecurityAgent } from './agents/security-agent';
import { PerformanceAgent } from './agents/performance-agent';
import { TestingAgent } from './agents/testing-agent';
import { DocumentationAgent } from './agents/documentation-agent';
import { Agent, CodeContext } from './agents/agent';
import { ODAISynthesizer } from './synthesis/odai-synthesizer';
import { N2Controller } from './synthesis/n2-controller';

export function activate(context: vscode.ExtensionContext) {
  console.log('CodeMind extension activated');
  
  // Register inline edit command
  const inlineEdit = vscode.commands.registerCommand(
    'codemind.inlineEdit',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showWarningMessage('CodeMind: No active editor found');
        return;
      }
      
      const selection = editor.selection;
      const selectedText = editor.document.getText(selection);
      
      if (selectedText.length === 0) {
        vscode.window.showWarningMessage('CodeMind: Please select some code first');
        return;
      }
      
      // Get user input
      const instruction = await vscode.window.showInputBox({
        prompt: 'What would you like to do with this code?',
        placeHolder: 'e.g., Add error handling, Optimize performance...'
      });
      
      if (!instruction) {
        return;
      }
      
      // Get configuration
      const config = vscode.workspace.getConfiguration('codemind');
      const apiKey = config.get<string>('openrouter.apiKey');
      
      if (!apiKey) {
        vscode.window.showErrorMessage('CodeMind: Please set your OpenRouter API key in settings');
        return;
      }
      
      // Show progress
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'CodeMind is analyzing with Grok 4.1...',
        cancellable: false
      }, async (progress) => {
        try {
          // Initialize LLM provider (OpenRouter with Grok 4.1 Fast)
          const llmProvider = new OpenRouterProvider(apiKey);
          
          // Create agents - using Grok 4.1 Fast model
          const agentConfig = {
            model: 'x-ai/grok-4.1-fast',
            temperature: 0.7,
            maxTokens: 800
          };
          
          const agents: Agent[] = [
            new ArchitectAgent(llmProvider, agentConfig),
            new EngineerAgent(llmProvider, agentConfig),
            new SecurityAgent(llmProvider, agentConfig),
            new PerformanceAgent(llmProvider, agentConfig),
            new TestingAgent(llmProvider, agentConfig),
            new DocumentationAgent(llmProvider, agentConfig)
          ];
          
          // Create synthesizer and N² controller
          const qualityThreshold = config.get<number>('qualityThreshold') || 9.0;
          const synthesizer = new ODAISynthesizer(llmProvider, qualityThreshold);
          const n2Controller = new N2Controller(4, qualityThreshold);
          
          // Gather context
          const document = editor.document;
          const codeContext: CodeContext = {
            code: selectedText,
            filePath: document.uri.fsPath,
            language: document.languageId,
            selection: selectedText
          };
          
          progress.report({ message: '6 agents analyzing with Grok...' });
          
          // Execute N² loop
          const result = await n2Controller.execute(
            instruction,
            agents,
            synthesizer,
            codeContext
          );
          
          // Show result
          if (result.success) {
            // Replace selection with generated code
            await editor.edit(editBuilder => {
              editBuilder.replace(selection, result.output);
            });
            
            vscode.window.showInformationMessage(
              `CodeMind: ${result.explanation}\n\nQuality: ${result.qualityScore.toFixed(1)}/10 | Iterations: ${result.iterations} | Time: ${(result.totalTime / 1000).toFixed(1)}s`
            );
          } else {
            // Show warning but still allow user to see result
            const action = await vscode.window.showWarningMessage(
              `CodeMind: Generated code but quality score (${result.qualityScore.toFixed(1)}/10) is below threshold. Review carefully.`,
              'Accept Anyway',
              'Reject'
            );
            
            if (action === 'Accept Anyway') {
              await editor.edit(editBuilder => {
                editBuilder.replace(selection, result.output);
              });
            }
          }
        } catch (error: any) {
          vscode.window.showErrorMessage(`CodeMind Error: ${error.message}`);
          console.error('CodeMind error:', error);
        }
      });
    }
  );
  
  // Register code review command
  const reviewCode = vscode.commands.registerCommand(
    'codemind.reviewCode',
    async () => {
      vscode.window.showInformationMessage('CodeMind: Code review feature coming soon!');
    }
  );
  
  context.subscriptions.push(inlineEdit, reviewCode);
}

export function deactivate() {
  console.log('CodeMind extension deactivated');
}
```

**Test**: 
1. Add OpenAI API key to VSCode settings
2. Select some code
3. Press Ctrl+K
4. Enter instruction
5. Verify 6 agents run, synthesis occurs, and code is generated

---

## Phase 3: Code Intelligence (Weeks 5-6)

### Week 5: AST Parsing & Symbol Indexing

#### Task 3.1: Install Tree-sitter
```bash
cd vscode/extensions/codemind-agent
npm install tree-sitter tree-sitter-typescript tree-sitter-javascript tree-sitter-python
npm install --save-dev @types/tree-sitter
```

#### Task 3.2: Create AST Parser
**File**: `vscode/extensions/codemind-agent/src/intelligence/ast-parser.ts`

```typescript
import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import JavaScript from 'tree-sitter-javascript';
import Python from 'tree-sitter-python';

export interface Symbol {
  name: string;
  type: 'function' | 'class' | 'variable' | 'method';
  line: number;
  code: string;
}

export class ASTParser {
  private parsers: Map<string, Parser>;
  
  constructor() {
    this.parsers = new Map();
    
    // TypeScript
    const tsParser = new Parser();
    tsParser.setLanguage(TypeScript.typescript);
    this.parsers.set('typescript', tsParser);
    
    // JavaScript
    const jsParser = new Parser();
    jsParser.setLanguage(JavaScript);
    this.parsers.set('javascript', jsParser);
    
    // Python
    const pyParser = new Parser();
    pyParser.setLanguage(Python);
    this.parsers.set('python', pyParser);
  }
  
  parse(code: string, language: string): Parser.Tree | null {
    const parser = this.parsers.get(language);
    if (!parser) return null;
    return parser.parse(code);
  }
  
  extractSymbols(code: string, language: string): Symbol[] {
    const tree = this.parse(code, language);
    if (!tree) return [];
    
    const symbols: Symbol[] = [];
    const cursor = tree.walk();
    
    const visit = () => {
      const node = cursor.currentNode;
      
      // Extract functions
      if (node.type === 'function_declaration' || node.type === 'function') {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          symbols.push({
            name: nameNode.text,
            type: 'function',
            line: node.startPosition.row + 1,
            code: node.text
          });
        }
      }
      
      // Extract classes
      if (node.type === 'class_declaration') {
        const nameNode = node.childForFieldName('name');
        if (nameNode) {
          symbols.push({
            name: nameNode.text,
            type: 'class',
            line: node.startPosition.row + 1,
            code: node.text
          });
        }
      }
      
      // Recursively visit children
      if (cursor.gotoFirstChild()) {
        do {
          visit();
        } while (cursor.gotoNextSibling());
        cursor.gotoParent();
      }
    };
    
    visit();
    return symbols;
  }
}
```

---

### Week 6: Context Gathering

#### Task 3.3: Create Context Gatherer
**File**: `vscode/extensions/codemind-agent/src/intelligence/context-gatherer.ts`

```typescript
import * as vscode from 'vscode';
import { ASTParser, Symbol } from './ast-parser';
import { CodeContext } from '../agents/agent';

export class ContextGatherer {
  private astParser: ASTParser;
  
  constructor() {
    this.astParser = new ASTParser();
  }
  
  async gatherContext(
    document: vscode.TextDocument,
    selection: vscode.Selection
  ): Promise<CodeContext> {
    const selectedText = document.getText(selection);
    const fullText = document.getText();
    const filePath = document.uri.fsPath;
    const language = this.normalizeLanguage(document.languageId);
    
    // Extract symbols from file
    const symbols = this.astParser.extractSymbols(fullText, language);
    
    // Detect framework
    const framework = this.detectFramework(fullText);
    
    return {
      code: selectedText,
      filePath,
      language,
      selection: selectedText,
      framework
    };
  }
  
  private normalizeLanguage(languageId: string): string {
    if (languageId === 'typescriptreact') return 'typescript';
    if (languageId === 'javascriptreact') return 'javascript';
    return languageId;
  }
  
  private detectFramework(code: string): string | undefined {
    if (code.includes('import React') || code.includes("from 'react'")) {
      return 'React';
    }
    if (code.includes('import Vue') || code.includes("from 'vue'")) {
      return 'Vue';
    }
    if (code.includes('@angular/core')) {
      return 'Angular';
    }
    if (code.includes('express')) {
      return 'Express';
    }
    return undefined;
  }
}
```

#### Task 3.4: Integrate Context Gatherer into Extension

Update `extension.ts` to use ContextGatherer for richer context.

---

## Phase 4: UI & Polish (Weeks 7-8)

**Critical**: Follow `UI_DESIGN_PRINCIPLES.md` for ALL UI work. High bar for aesthetics and UX.

**Rules**:
- ❌ NO emojis - Use Lucide icons exclusively
- ✅ Beautiful, polished components
- ✅ Match VSCode design language
- ✅ Smooth animations (<300ms)
- ✅ Progressive disclosure (simple by default)
- ✅ Keyboard accessible (WCAG AA)

### Week 7: Diff View & Analysis Panel

#### Task 4.1: Create Diff View
**File**: `vscode/extensions/codemind-agent/src/ui/diff-view.ts`

**Design Requirements** (per UI_DESIGN_PRINCIPLES.md):
```typescript
import { VSCodeDiffEditor } from '@vscode/diff-editor';
import { ChevronLeft, GitCompare, Info, Check, X, Eye } from 'lucide-react';

// Clean, beautiful diff view
// - Use VSCode's native diff editor
// - Custom header with Lucide icons
// - Action buttons (Accept/Reject/Details)
// - Show quality score prominently
// - Smooth animations
```

**Features**:
- Side-by-side diff (original vs. generated)
- Syntax highlighting
- Line-by-line comparison
- Inline annotations for agent insights
- Quality score display
- Accept/Reject/View Details buttons

**Inspiration**: GitHub diff view, GitLens extension

---

#### Task 4.2: Create Analysis Panel
**File**: `vscode/extensions/codemind-agent/src/ui/analysis-panel.ts`

**Design Requirements**:
```typescript
import { 
  Building2, Wrench, Shield, Zap, FlaskConical, FileText,
  TrendingUp, ChevronRight
} from 'lucide-react';

// Beautiful webview panel
// - Tabbed interface (Overview / Security / Performance / Full Report)
// - Collapsible agent sections with Lucide icons
// - Issue badges (critical/warning counts)
// - Progressive disclosure (hide details until clicked)
```

**Features**:
- **Overview Tab**: High-level summary, quality score, key issues
- **Agent Tabs**: Individual agent perspectives (6 tabs)
- **Full Report Tab**: Complete detailed analysis
- Collapsible issue lists
- Badge indicators for severity
- Smooth expand/collapse animations
- Filter/sort capabilities

**Inspiration**: Linear's issue panel, Vercel's deployment logs

---

#### Task 4.3: Progress Indicators
**File**: `vscode/extensions/codemind-agent/src/ui/progress-indicator.ts`

**Design Requirements**:
```typescript
import { Loader, Check, Circle } from 'lucide-react';

// Rich progress visualization
// Show stages: Context → Analysis → Synthesis → Quality Check
// Each stage has status: pending/active/complete
// Smooth transitions between stages
```

---

#### Task 4.4: Inline Suggestions
**File**: `vscode/extensions/codemind-agent/src/ui/inline-suggestions.ts`

**Design Requirements**:
- Ghost text in editor (like GitHub Copilot)
- Lucide icons in gutter for agent suggestions
- Hover cards with detailed explanations
- Keyboard shortcuts for quick actions
- Non-intrusive, elegant appearance

---

### Week 8: Testing & Refinement

#### Task 4.5: UI Component Library
**File**: `vscode/extensions/codemind-agent/src/ui/components/`

Build reusable components:
- `Button.tsx` - Primary/Secondary/Ghost variants with Lucide icons
- `Badge.tsx` - Severity indicators (critical/warning/info)
- `Card.tsx` - Container component with elevation
- `Accordion.tsx` - Collapsible sections
- `Tabs.tsx` - Tab navigation
- `ProgressBar.tsx` - Linear progress indicator
- `Spinner.tsx` - Loading animation (using Lucide Loader icon)

**Base**: `@vscode/webview-ui-toolkit` with custom styling

---

#### Task 4.6: Theme Support
**File**: `vscode/extensions/codemind-agent/src/ui/theme.ts`

```typescript
// Semantic colors that adapt to user's VSCode theme
export const theme = {
  colors: {
    primary: 'var(--vscode-button-background)',
    danger: 'var(--vscode-errorForeground)',
    warning: 'var(--vscode-editorWarning-foreground)',
    success: 'var(--vscode-testing-iconPassed)',
    muted: 'var(--vscode-descriptionForeground)'
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px'
  },
  transitions: {
    fast: '100ms ease-out',
    normal: '150ms cubic-bezier(0.4, 0.0, 0.2, 1)',
    slow: '300ms ease-in-out'
  }
};
```

---

#### Task 4.7: Accessibility Testing
- Keyboard navigation (Tab, Enter, Escape)
- Screen reader support (aria-labels)
- Focus indicators
- High contrast mode support
- WCAG 2.1 AA compliance

---

#### Task 4.8: Performance Testing
- UI renders in <100ms
- Smooth 60fps animations
- No jank during transitions
- Lazy loading for large datasets
- Virtual scrolling for long lists

---

#### Task 4.9: User Testing
Test with real developers:
- Is the UI intuitive?
- Can they find agent insights easily?
- Do they understand the quality scores?
- Are the animations smooth?
- Does it feel native to VSCode?

**Success criteria**: "Wow" factor + zero learning curve

---

## Success Metrics

### Phase 2 (Agent System)
- ✅ All 6 agents produce structured JSON
- ✅ N² loop iterates correctly
- ✅ Code generation works end-to-end
- ✅ Average quality score >8.5/10
- ✅ Response time <10s for full analysis

### Phase 3 (Intelligence)
- ✅ AST parsing works for TS/JS/Python
- ✅ Symbol extraction accurate
- ✅ Context gathering <200ms
- ✅ Framework detection >90% accurate

### Phase 4 (UI)
- ✅ Diff view clearly shows changes
- ✅ User can accept/reject changes
- ✅ Analysis panel displays all agent insights
- ✅ UI renders in <100ms

---

## Next Steps

1. **Start Week 1 Tasks** - Build LLM provider abstraction
2. **Test Incrementally** - Test each component as you build
3. **Update This Document** - Mark tasks complete as you go
4. **Create Issues** - Track bugs and enhancements
5. **Get Feedback** - Test with real code examples

---

**Let's build the future of AI-powered coding, one agent at a time!** 🚀

