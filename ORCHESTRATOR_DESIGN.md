# CodeMind Orchestrator System

> **Autonomous task execution through intelligent planning and coordination**

**Version**: 1.0  
**Last Updated**: November 2025

---

## Vision

**Goal**: Enable CodeMind to autonomously complete complex, multi-step tasks across multiple files, just like Cursor Composer.

**User Experience**:
```
User: "Add JWT authentication to this Express app"

CodeMind:
1. Analyzes codebase structure
2. Creates execution plan (8 subtasks)
3. Shows plan to user for approval
4. Executes each subtask:
   - Install dependencies
   - Create middleware
   - Update routes
   - Add tests
   - Update docs
5. Verifies each step
6. Reports completion with summary
```

**Result**: User gives high-level intent, CodeMind handles all implementation details.

---

## Architecture

### The Four Layers

```
┌─────────────────────────────────────────────────────────────┐
│                   ORCHESTRATOR LAYER                         │
│          "How do we complete this task?"                     │
│                                                               │
│  • Takes high-level user task                                │
│  • Creates step-by-step execution plan                       │
│  • Coordinates across multiple files                         │
│  • Executes actions (edit, command, test)                    │
│  • Verifies results after each step                          │
│  • Adapts plan based on outcomes                             │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────────┐
│              Meta-Cognitive Layer (N²)                       │
│           "Is this solution good enough?"                    │
│                                                               │
│  • Self-evaluates each subtask output (0-10)                │
│  • Triggers refinement when needed                           │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────────┐
│           Synthesis Layer (ODAI)                             │
│        "How do we integrate all perspectives?"               │
│                                                               │
│  • Synthesizes specialist insights                           │
│  • Generates code for each subtask                           │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────────┐
│         Specialist Layer (6 Agents)                          │
│     "What matters from my specialized viewpoint?"            │
│                                                               │
│  Architecture • Engineering • Security                      │
│  Performance • Testing • Documentation                      │
└───────────────────────────────────────────────────────────────┘
```

---

## Orchestrator Agent

### Core Responsibilities

1. **Task Understanding**
   - Parse user's high-level intent
   - Identify scope and constraints
   - Determine required context

2. **Planning**
   - Break task into atomic subtasks
   - Determine file dependencies
   - Identify required tools (npm, git, test runners)
   - Order subtasks correctly

3. **Execution**
   - For each subtask:
     - Gather context
     - Invoke specialist agents
     - Apply N² quality control
     - Execute action (file edit, command, etc.)
     - Verify success

4. **Adaptation**
   - Detect failures
   - Adjust plan dynamically
   - Retry with different approach
   - Escalate to user if stuck

5. **Communication**
   - Show progress to user
   - Explain what's happening
   - Request clarification when needed
   - Summarize results

---

## Action System

The orchestrator can execute these actions:

### File Operations
```typescript
interface FileAction {
  type: 'create' | 'edit' | 'delete' | 'rename';
  path: string;
  content?: string;
  changes?: CodeChange[];
}

// Create new file
await executeAction({
  type: 'create',
  path: 'src/middleware/auth.ts',
  content: generatedCode
});

// Edit existing file
await executeAction({
  type: 'edit',
  path: 'src/routes/users.ts',
  changes: [
    {
      type: 'insert',
      line: 5,
      content: 'import { authMiddleware } from "../middleware/auth";'
    },
    {
      type: 'replace',
      startLine: 10,
      endLine: 12,
      content: 'router.use(authMiddleware);'
    }
  ]
});
```

### Command Execution
```typescript
interface CommandAction {
  type: 'command';
  command: string;
  cwd?: string;
  expectSuccess: boolean;
}

// Install dependency
await executeAction({
  type: 'command',
  command: 'npm install jsonwebtoken bcrypt',
  expectSuccess: true
});

// Run tests
await executeAction({
  type: 'command',
  command: 'npm test',
  expectSuccess: true
});
```

### Search Operations
```typescript
interface SearchAction {
  type: 'search';
  query: string;
  scope?: string[];
  mode: 'symbol' | 'text' | 'semantic';
}

// Find all API routes
const routes = await executeAction({
  type: 'search',
  query: 'router.get|router.post',
  scope: ['src/routes/'],
  mode: 'text'
});
```

### Verification Actions
```typescript
interface VerifyAction {
  type: 'verify';
  checks: VerificationCheck[];
}

// Verify auth middleware was applied
await executeAction({
  type: 'verify',
  checks: [
    { type: 'file-exists', path: 'src/middleware/auth.ts' },
    { type: 'imports', file: 'src/routes/users.ts', imports: ['authMiddleware'] },
    { type: 'test-passes', test: 'auth.test.ts' }
  ]
});
```

---

## Planning Algorithm

### Step 1: Task Analysis

```typescript
interface Task {
  intent: string;              // User's high-level goal
  scope: 'file' | 'module' | 'project';
  constraints: string[];       // "Don't break existing tests"
  context: CodeContext;        // Relevant files, symbols
}

async function analyzeTask(userInput: string): Promise<Task> {
  // Use LLM to understand intent
  const analysis = await llm.generate({
    prompt: `
      User wants: "${userInput}"
      
      Codebase context:
      ${await gatherRelevantContext()}
      
      Analyze:
      1. What is the high-level intent?
      2. What scope is affected? (single file / module / whole project)
      3. What are the constraints?
      4. What files/symbols are relevant?
      
      Return JSON.
    `
  });
  
  return parseTaskAnalysis(analysis);
}
```

### Step 2: Plan Generation

```typescript
interface Subtask {
  id: string;
  description: string;
  type: 'create' | 'edit' | 'command' | 'test';
  dependencies: string[];      // IDs of subtasks that must complete first
  files: string[];             // Files involved
  estimatedComplexity: number; // 1-10
}

interface ExecutionPlan {
  goal: string;
  subtasks: Subtask[];
  estimatedSteps: number;
  affectedFiles: string[];
}

async function createPlan(task: Task): Promise<ExecutionPlan> {
  // Use 6 specialists + ODAI to generate plan
  const agentPlans = await Promise.all(
    agents.map(agent => agent.suggestPlan(task))
  );
  
  // Synthesize into unified plan
  const plan = await odaiSynthesize({
    type: 'planning',
    inputs: agentPlans,
    goal: task.intent
  });
  
  // Validate plan (N² check)
  const quality = await n2Evaluate(plan);
  if (quality.score < 9.0) {
    return createPlan(task); // Refine
  }
  
  return plan;
}
```

### Step 3: User Approval

```typescript
async function presentPlan(plan: ExecutionPlan): Promise<boolean> {
  const response = await vscode.window.showInformationMessage(
    `CodeMind will execute ${plan.subtasks.length} steps to: ${plan.goal}`,
    {
      modal: true,
      detail: formatPlanForUser(plan)
    },
    'Proceed', 'Customize', 'Cancel'
  );
  
  if (response === 'Customize') {
    return await customizePlan(plan);
  }
  
  return response === 'Proceed';
}

function formatPlanForUser(plan: ExecutionPlan): string {
  return plan.subtasks.map((st, i) => 
    `${i + 1}. ${st.description}\n   Files: ${st.files.join(', ')}`
  ).join('\n\n');
}
```

### Step 4: Execution

```typescript
async function executePlan(plan: ExecutionPlan): Promise<ExecutionResult> {
  const results: SubtaskResult[] = [];
  const completed = new Set<string>();
  
  // Show progress
  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: `CodeMind: ${plan.goal}`,
    cancellable: true
  }, async (progress, token) => {
    
    while (completed.size < plan.subtasks.length) {
      // Find subtasks ready to execute (dependencies met)
      const ready = plan.subtasks.filter(st =>
        !completed.has(st.id) &&
        st.dependencies.every(dep => completed.has(dep))
      );
      
      for (const subtask of ready) {
        // Check for cancellation
        if (token.isCancellationRequested) {
          throw new Error('User cancelled');
        }
        
        // Update progress
        progress.report({
          message: `Step ${completed.size + 1}/${plan.subtasks.length}: ${subtask.description}`,
          increment: (1 / plan.subtasks.length) * 100
        });
        
        // Execute subtask
        const result = await executeSubtask(subtask);
        results.push(result);
        
        if (result.success) {
          completed.add(subtask.id);
        } else {
          // Handle failure
          const recovery = await handleFailure(subtask, result);
          if (recovery.shouldRetry) {
            // Retry with modified approach
            continue;
          } else {
            // Escalate to user
            throw new Error(`Failed: ${subtask.description}\nReason: ${result.error}`);
          }
        }
      }
    }
  });
  
  return {
    success: true,
    subtasks: results,
    summary: generateSummary(results)
  };
}
```

### Step 5: Subtask Execution

```typescript
async function executeSubtask(subtask: Subtask): Promise<SubtaskResult> {
  try {
    // 1. Gather context for this specific subtask
    const context = await gatherSubtaskContext(subtask);
    
    // 2. Run 6 specialist agents
    const analyses = await Promise.all(
      agents.map(agent => agent.analyze(subtask.description, context))
    );
    
    // 3. ODAI synthesis
    const synthesis = await odaiSynthesize({
      type: 'code-generation',
      analyses: analyses,
      goal: subtask.description,
      context: context
    });
    
    // 4. N² quality check
    const quality = await n2Evaluate(synthesis);
    if (quality.score < 9.0) {
      // Refine with repair directives
      return executeSubtask({
        ...subtask,
        repairDirective: quality.issues
      });
    }
    
    // 5. Execute the action
    const actionResult = await executeAction(synthesis.action);
    
    // 6. Verify success
    const verified = await verifyAction(subtask, actionResult);
    
    if (!verified.success) {
      return {
        success: false,
        error: verified.reason,
        suggestion: verified.fix
      };
    }
    
    return {
      success: true,
      changes: actionResult.changes,
      output: actionResult.output
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}
```

---

## Example Flows

### Example 1: Add Authentication

**User Input**: "Add JWT authentication to this Express app"

**Plan Generated**:
```
1. Install dependencies (jsonwebtoken, bcrypt)
2. Create auth utility (src/utils/auth.ts)
3. Create auth middleware (src/middleware/auth.ts)
4. Update User model with password hashing (src/models/User.ts)
5. Add login route (src/routes/auth.ts)
6. Add signup route (src/routes/auth.ts)
7. Protect existing routes with middleware (src/routes/users.ts, src/routes/posts.ts)
8. Write tests (src/tests/auth.test.ts)
```

**Execution**:
- Each step analyzed by 6 specialists
- Code generated via ODAI
- Validated via N²
- Executed and verified
- Total time: ~45 seconds

---

### Example 2: Refactor Database Layer

**User Input**: "Refactor direct SQL queries to use repository pattern"

**Plan Generated**:
```
1. Create IRepository interface (src/repositories/IRepository.ts)
2. Create BaseRepository class (src/repositories/BaseRepository.ts)
3. Create UserRepository (src/repositories/UserRepository.ts)
4. Create PostRepository (src/repositories/PostRepository.ts)
5. Update UserService to use UserRepository (src/services/UserService.ts)
6. Update PostService to use PostRepository (src/services/PostService.ts)
7. Update tests (src/tests/repositories/)
8. Remove old SQL helper (src/utils/sql.ts)
```

**Execution**:
- Multi-file refactoring
- Maintains test coverage
- Gradual migration
- Total time: ~90 seconds

---

### Example 3: Fix Security Vulnerability

**User Input**: "Fix the SQL injection in login endpoint"

**Plan Generated**:
```
1. Analyze vulnerability (src/routes/auth.ts:45)
2. Replace string concatenation with parameterized query
3. Add input validation
4. Add rate limiting to login endpoint
5. Update tests to include injection attempts
6. Run security scan
```

**Execution**:
- Security agent leads analysis
- Engineer agent validates correctness
- Testing agent ensures coverage
- Total time: ~20 seconds

---

## Safety & Control

### User Confirmation Points

1. **Plan Approval** - User must approve execution plan
2. **Risky Actions** - Require confirmation for:
   - Deleting files
   - Modifying package.json
   - Running install commands
   - Modifying git config
3. **Failure Handling** - User decides on retry/skip/abort

### Sandboxing

- All actions reversible via git
- Create automatic commits before major changes
- Show diff before applying
- Allow step-by-step execution (user controls pace)

### Limits

- Max subtasks per plan: 20
- Max iterations per subtask: 3
- Timeout per subtask: 30 seconds
- User can cancel anytime

---

## Integration with Existing System

### Phase 1-2 (Current): Analysis Only
```
User selects code → 6 agents analyze → Show results
```

### Phase 3: Add Orchestrator
```
User gives task → Orchestrator plans → User approves → Execute
```

### The Orchestrator Uses:
- ✅ Existing 6 specialist agents (for analysis)
- ✅ Existing ODAI synthesizer (for code generation)
- ✅ Existing N² loop (for quality control)
- ➕ NEW: Planning capability
- ➕ NEW: Action execution
- ➕ NEW: Multi-file coordination
- ➕ NEW: Verification system

---

## Implementation Priority

### Week 5-6: Orchestrator Foundation
1. Task analysis and planning
2. Basic action execution (file edits)
3. Single-task end-to-end flow

### Week 7-8: Multi-file Operations
1. Dependency resolution
2. Parallel vs. sequential execution
3. Failure recovery

### Week 9-10: Advanced Features
1. Command execution (npm, git)
2. Test verification
3. Semantic search integration

### Week 11-12: Polish
1. User control and confirmation UX
2. Progress visualization
3. Rollback capabilities

---

## Success Metrics

**Orchestrator Quality**:
- ✅ Plans are accurate (>90% user approval)
- ✅ Execution succeeds (>85% completion rate)
- ✅ No breaking changes (tests still pass)
- ✅ Performance (<60s for typical tasks)

**User Experience**:
- ✅ Clear progress indication
- ✅ Easy to understand plans
- ✅ Safe to cancel/rollback
- ✅ Minimal user intervention needed

---

## Competitive Positioning

### Cursor Composer
- **Their Strength**: Fast, integrated, good UX
- **Their Weakness**: Single-model, no verification, sometimes wrong

### CodeMind Advantage
- ✅ 6-perspective analysis (better quality)
- ✅ N² self-correction (catches mistakes)
- ✅ Transparent reasoning (see why decisions made)
- ✅ Specialized agents (deeper domain expertise)

**Result**: Slower but far more reliable and correct.

---

**The Orchestrator is the conductor. The 6 agents are the instruments. The N² loop is the quality control. Together, they create symphonies of code.** 🎵



