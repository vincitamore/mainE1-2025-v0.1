/**
 * Orchestrator Agent
 * 
 * The high-level conductor that:
 * 1. Analyzes user requests
 * 2. Plans multi-file operations
 * 3. Gathers required context
 * 4. Coordinates specialist agents
 * 5. Generates execution plans
 */

import { LLMProvider, LLMConfig } from '../llm/provider';
import { Agent, AgentAnalysis, CodeContext } from '../agents/agent';
import { parseYAMLWithTechnician } from '../utils/yaml-technician';
import { toYAML } from '../utils/yaml-parser';
import {
  OrchestratorTaskType,
  ExecutionPlan,
  PlannedChange,
  WorkspaceContext,
  FileOperation,
  OrchestratorProgressCallback
} from './types';

/**
 * The Orchestrator Agent
 * Unlike specialist agents, this agent:
 * - Has a broader view of the codebase
 * - Plans multi-file changes
 * - Coordinates other agents
 * - Manages execution flow
 */
export class OrchestratorAgent {
  constructor(
    private llmProvider: LLMProvider,
    private config: LLMConfig,
    private agents: Map<string, Agent>
  ) {}

  /**
   * Phase 1: Analyze user request
   * Understand intent, classify task, identify scope
   */
  async analyzeRequest(
    userRequest: string,
    workspaceContext: WorkspaceContext,
    progressCallback?: OrchestratorProgressCallback
  ): Promise<{
    taskType: OrchestratorTaskType;
    intent: string;
    scope: 'single-file' | 'multi-file' | 'project-wide';
    requiredContext: string[];
    complexity: 'low' | 'medium' | 'high';
  }> {
    progressCallback?.({
      phase: 'analyzing',
      status: 'Analyzing user request...',
      progress: 10
    });

    const prompt = this.buildAnalysisPrompt(userRequest, workspaceContext);

    const response = await this.llmProvider.generate(
      [
        {
          role: 'system',
          content: `You are the Orchestrator - a high-level planning agent that analyzes user requests and plans multi-file operations.

Your task: Analyze the user's request and classify it.
- Determine the task type (code generation, refactoring, bug fix, etc.)
- Understand the user's intent
- Assess the scope (single-file, multi-file, project-wide)
- Identify required context files
- Estimate complexity

Output Format: YAML (2-space indentation, no code fences)`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      this.config
    );

    const expectedStructure = toYAML({
      taskType: 'code_generation',
      intent: 'brief description',
      scope: 'multi-file',
      requiredContext: ['file paths'],
      complexity: 'medium'
    });

    const parsed = await parseYAMLWithTechnician<any>(
      response.content,
      this.llmProvider,
      this.config,
      'task analysis',
      expectedStructure
    );

    if (parsed && typeof parsed === 'object') {
      return {
        taskType: this.parseTaskType(parsed.taskType),
        intent: parsed.intent || userRequest,
        scope: parsed.scope || 'single-file',
        requiredContext: parsed.requiredContext || [],
        complexity: parsed.complexity || 'medium'
      };
    }

    // Fallback: Basic classification
    return {
      taskType: OrchestratorTaskType.GENERAL,
      intent: userRequest,
      scope: 'single-file',
      requiredContext: [],
      complexity: 'medium'
    };
  }

  /**
   * Phase 2: Plan file operations
   * Determine which files need to be created/modified/deleted
   */
  async planOperations(
    userRequest: string,
    taskAnalysis: {
      taskType: OrchestratorTaskType;
      intent: string;
      scope: string;
      requiredContext: string[];
      complexity: string;
    },
    workspaceContext: WorkspaceContext,
    progressCallback?: OrchestratorProgressCallback
  ): Promise<ExecutionPlan> {
    progressCallback?.({
      phase: 'planning',
      status: 'Planning file operations...',
      progress: 30
    });

    const prompt = this.buildPlanningPrompt(userRequest, taskAnalysis, workspaceContext);

    const response = await this.llmProvider.generate(
      [
        {
          role: 'system',
          content: `You are the Orchestrator's planning module. Create detailed, executable plans for multi-file operations.

Requirements:
- Specific file paths and operations
- Proper dependency ordering
- Rollback strategy
- Verification steps

Output Format: YAML

Structure:
- 2-space indentation
- Multiline strings: | or > blocks
- Lists: - syntax
- Forward slashes in paths`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      { ...this.config, temperature: 0.3 } // Lower temperature for planning
    );

    console.log(`[Orchestrator] Raw LLM response (first 300 chars):`, response.content.substring(0, 300));
    
    // Parse YAML with automatic technician repair on failure
    const expectedStructure = toYAML({
      taskType: 'code_generation',
      summary: 'brief description',
      steps: [{
        filePath: 'path/to/file',
        operation: {
          type: 'create',
          filePath: 'path/to/file',
          reason: 'why needed'
        },
        priority: 1,
        rationale: 'explanation',
        risks: []
      }],
      requiredFiles: [],
      affectedFiles: [],
      estimatedComplexity: 'medium',
      confidence: 0.85
    });
    
    const parsed = await parseYAMLWithTechnician<any>(
      response.content,
      this.llmProvider,
      this.config,
      'execution plan',
      expectedStructure
    );

    if (parsed && typeof parsed === 'object') {
      return this.validateAndRepairPlan(parsed, taskAnalysis, workspaceContext);
    }

    // Fallback: Single-file operation
    return this.createFallbackPlan(userRequest, taskAnalysis, workspaceContext);
  }

  /**
   * Phase 3: Gather specialist insights
   * Run relevant specialist agents on affected files
   */
  async gatherSpecialistInsights(
    plan: ExecutionPlan,
    progressCallback?: OrchestratorProgressCallback
  ): Promise<Map<string, AgentAnalysis[]>> {
    progressCallback?.({
      phase: 'gathering',
      status: 'Consulting specialist agents...',
      progress: 50
    });

    const insights = new Map<string, AgentAnalysis[]>();

    // Determine which agents are relevant based on task type
    const relevantAgents = this.selectRelevantAgents(plan.taskType);

    // For each affected file, get specialist analysis
    // This is a simplified version - full implementation would read file contents
    for (const filePath of plan.affectedFiles.slice(0, 3)) {
      // Limit to avoid excessive API calls
      progressCallback?.({
        phase: 'gathering',
        status: `Analyzing ${filePath}...`,
        progress: 50,
        currentFile: filePath
      });

      // TODO: Read file content and create CodeContext
      // For now, just store the file path for later implementation
      insights.set(filePath, []);
    }

    return insights;
  }

  /**
   * Build prompt for request analysis
   */
  private buildAnalysisPrompt(userRequest: string, workspaceContext: WorkspaceContext): string {
    let prompt = `# Task: Analyze User Request

## User Request:
"${userRequest}"

## Current Context:
`;

    if (workspaceContext.currentFile) {
      prompt += `- Current file: ${workspaceContext.currentFile.path} (${workspaceContext.currentFile.language})
`;
      if (workspaceContext.currentFile.selection) {
        prompt += `- User has selected: lines ${workspaceContext.currentFile.selection.start.line + 1}-${workspaceContext.currentFile.selection.end.line + 1}
`;
      }
    }

    if (workspaceContext.openFiles.length > 0) {
      prompt += `- Open files: ${workspaceContext.openFiles.slice(0, 5).join(', ')}${workspaceContext.openFiles.length > 5 ? ` (+${workspaceContext.openFiles.length - 5} more)` : ''}
`;
    }

    if (workspaceContext.gitStatus) {
      prompt += `- Git status: ${workspaceContext.gitStatus.modified.length} modified, ${workspaceContext.gitStatus.staged.length} staged
`;
    }

    prompt += `
## Your Task:
Analyze the user's request and determine:

1. **Task Type**: What kind of operation is this?
   - code_generation: Creating new code/features
   - refactoring: Restructuring existing code
   - bug_fix: Fixing specific issues
   - feature_add: Adding new functionality
   - documentation: Generating/updating docs
   - testing: Adding/improving tests
   - optimization: Performance improvements
   - security: Security enhancements
   - general: General assistance

2. **Intent**: What is the user trying to accomplish? (1-2 sentences)

3. **Scope**: How many files will be affected?
   - single-file: Only one file
   - multi-file: 2-5 files
   - project-wide: 6+ files or structural changes

4. **Required Context**: What files/information do you need to complete this task?
   List specific file paths if known, or patterns like "*.config.ts" or "all test files"

5. **Complexity**: How complex is this task?
   - low: Simple, straightforward change
   - medium: Moderate complexity, some dependencies
   - high: Complex, many dependencies, requires careful planning

## Response Format:
Return ONLY valid JSON (no markdown code fences, no extra text):

⚠️ CRITICAL JSON RULES:
- All string values must be on a SINGLE line
- Use \\n for newlines within strings (NOT actual newlines)
- Escape all special characters: \\n \\t \\" \\\\
- No trailing commas
- Double quotes only (no single quotes)

{
  "taskType": "code_generation",
  "intent": "User wants to...",
  "scope": "multi-file",
  "requiredContext": ["src/utils/*.ts", "tests/utils.test.ts"],
  "complexity": "medium"
}

Example of CORRECT multi-line content:
"content": "Line 1\\nLine 2\\nLine 3"

Example of WRONG (will fail):
"content": "Line 1
Line 2
Line 3"`;

    return prompt;
  }

  /**
   * Build prompt for operation planning
   */
  private buildPlanningPrompt(
    userRequest: string,
    taskAnalysis: any,
    workspaceContext: WorkspaceContext
  ): string {
    let prompt = `# Task: Plan File Operations

## User Request:
"${userRequest}"

## Task Analysis:
- Type: ${taskAnalysis.taskType}
- Intent: ${taskAnalysis.intent}
- Scope: ${taskAnalysis.scope}
- Complexity: ${taskAnalysis.complexity}

## Workspace Context:
`;

    if (workspaceContext.currentFile) {
      prompt += `### Current File: ${workspaceContext.currentFile.path}
\`\`\`${workspaceContext.currentFile.language}
${workspaceContext.currentFile.content.substring(0, 1000)}${workspaceContext.currentFile.content.length > 1000 ? '\n... (truncated)' : ''}
\`\`\`
`;
    }

    prompt += `
## Workspace Root:
${workspaceContext.workspaceRoot || 'No workspace open'}

⚠️⚠️⚠️ CRITICAL FILE PATH RULES ⚠️⚠️⚠️
ALL file paths MUST be RELATIVE to the workspace root shown above!

CORRECT: "README.md", "src/utils/helper.ts", "docs/guide.md"
WRONG: "C:\\README.md", "/Users/name/project/README.md", "C:/Users/..."

If user says "create README.md" → use "README.md" (workspace root)
If user says "create in src/" → use "src/filename.ext"
NEVER use absolute paths starting with C:\\ or /

## Your Task:
Create a detailed execution plan with specific file operations.

For each file that needs to be changed:
1. Specify the WORKSPACE-RELATIVE file path (e.g., "src/index.ts", NOT "C:\\src\\index.ts")
2. Operation type (create, modify, delete, rename)
3. Why this change is needed
4. What risks it involves
5. Priority/order (lower number = earlier)

⚠️⚠️⚠️ CRITICAL: SURGICAL MODIFICATIONS ⚠️⚠️⚠️

**Operation Types - Choose Carefully:**

- **"create"**: New file that doesn't exist yet
  → Agents will generate complete file from scratch

- **"modify"**: File exists and needs TARGETED changes
  → Agents will make SURGICAL modifications, preserving all unrelated code
  → ⚠️ Be conservative! Only use "modify" if changes are necessary
  → In rationale, specify WHAT needs to change (e.g., "Add error handling to parseJSON function")
  → Agents will preserve everything else in the file

- **"delete"**: Remove file completely

- **"rename"**: Move/rename file

- **"terminal"**: Execute shell command (e.g., install packages, run build, compile, test)
  → Use for: npm/pnpm install, build commands, running tests, git operations, etc.
  → User will be prompted to approve before execution
  → Command output will be streamed to user in real-time
  → Use workspace-relative paths in commands
  → For "terminal" operations:
    * Set "command" field with the shell command
    * Set "workingDirectory" if needed (defaults to workspace root)
    * filePath can be a descriptive name (e.g., "install-dependencies")
    * Specify in rationale WHY this command is needed

**When to use "modify" vs "create":**
- Existing file, add one function → "modify" (surgical)
- Existing file, refactor entire architecture → Consider multiple "modify" operations or new files
- File doesn't exist → "create"
- Stub/empty file (<50 lines) → Often better to "create" (regenerate completely)

CRITICAL - Two types of files:
1. **affectedFiles**: Files that will be MODIFIED/CREATED/DELETED by this operation
2. **requiredFiles**: Files needed for CONTEXT (imports, types, related code that agents should read to understand the codebase)

Consider:
- Dependencies between files (imports, references) → Add to requiredFiles
- Order of operations (create before modify, etc.)
- Rollback strategy (how to undo if something fails)
- Verification (how to check if changes work)
- What existing code do agents need to see? → Add to requiredFiles
- BE CONSERVATIVE with "modify" operations - existing code works, don't break it!

## Response Format:
Return YAML format only. No markdown code fences, no extra text.

**YAML Rules:**
- 2-space indentation
- Multiline strings: use | (literal) or > (folded)
- Lists: use - (dash) syntax
- Paths: forward slashes (src/utils/file.ts)
- Terminal operations: include command and workingDirectory fields

**Examples:**

Example 1 - CREATE new files:
taskType: code_generation
summary: Create a new utility function and add tests
steps:
  - filePath: src/utils/helper.ts
    operation:
      type: create
      filePath: src/utils/helper.ts
      content: // Helper utility function
      reason: Create new utility function
    priority: 1
    rationale: |
      New file - need utility function before tests can reference it.
      This will be used across multiple components.
    risks:
      - May conflict with existing utilities
    agentInputs: []
requiredFiles:
  - src/utils/index.ts
  - src/types.ts
affectedFiles:
  - src/utils/helper.ts
estimatedComplexity: medium
risks:
  - May need to update imports in other files
verificationSteps:
  - Run TypeScript compiler
  - Run tests
confidence: 0.85

Example 2 - MODIFY existing file (SURGICAL):
taskType: refactoring
summary: Add error handling to existing parseJSON function
steps:
  - filePath: src/utils/json.ts
    operation:
      type: modify
      filePath: src/utils/json.ts
      content: // Add try-catch
      reason: Add error handling to parseJSON function only
    priority: 1
    rationale: |
      SURGICAL CHANGE: Only modify parseJSON function.
      Preserve all other functions in file exactly as they are.
      Add try-catch block while maintaining existing behavior.
    risks:
      - May affect code that relies on parseJSON throwing errors
    agentInputs: []
requiredFiles:
  - src/types.ts
affectedFiles:
  - src/utils/json.ts
estimatedComplexity: low
risks:
  - Breaking change if callers expect exceptions
verificationSteps:
  - Check all callers of parseJSON
  - Run unit tests
confidence: 0.9

Example 3 - TERMINAL operations:
taskType: code_generation
summary: Initialize new Next.js project with dependencies
steps:
  - filePath: package.json
    operation:
      type: create
      filePath: package.json
      content: // Package.json
      reason: Define project dependencies
    priority: 1
    rationale: Need package.json before installing dependencies
    risks: []
    agentInputs: []
  - filePath: install-dependencies
    operation:
      type: terminal
      filePath: install-dependencies
      command: pnpm install
      workingDirectory: .
      reason: Install project dependencies defined in package.json
    priority: 2
    rationale: |
      Must install dependencies after creating package.json.
      User will approve this command before execution.
    risks:
      - Network failure
      - Incompatible versions
    agentInputs: []
  - filePath: compile-project
    operation:
      type: terminal
      filePath: compile-project
      command: pnpm run build
      reason: Verify project compiles successfully
    priority: 3
    rationale: Verify all files compile after installation
    risks:
      - TypeScript errors
      - Missing dependencies
    agentInputs: []
requiredFiles: []
affectedFiles:
  - package.json
estimatedComplexity: medium
risks:
  - Dependency conflicts
  - Build failures
verificationSteps:
  - Check pnpm install success
  - Verify build output
  - Run type check
confidence: 0.85

**Critical:**
- Keep content fields brief (full generation happens later)
- requiredFiles: context files (imports, types, related code)
- affectedFiles: files to be modified/created
- modify: surgical changes only, preserve existing code
- create: new files
- Output: raw YAML, no code fences`;

    return prompt;
  }

  /**
   * Validate and repair execution plan
   */
  private validateAndRepairPlan(
    parsed: any,
    taskAnalysis: any,
    workspaceContext: WorkspaceContext
  ): ExecutionPlan {
    const plan: ExecutionPlan = {
      taskType: this.parseTaskType(parsed.taskType || taskAnalysis.taskType),
      summary: parsed.summary || 'Execute user request',
      steps: [],
      requiredFiles: Array.isArray(parsed.requiredFiles) ? parsed.requiredFiles.map((f: string) => this.normalizeFilePath(f, workspaceContext)) : [],
      affectedFiles: Array.isArray(parsed.affectedFiles) ? parsed.affectedFiles.map((f: string) => this.normalizeFilePath(f, workspaceContext)) : [],
      estimatedComplexity: parsed.estimatedComplexity || taskAnalysis.complexity || 'medium',
      risks: Array.isArray(parsed.risks) ? parsed.risks : [],
      verificationSteps: Array.isArray(parsed.verificationSteps) ? parsed.verificationSteps : [],
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7
    };

    // Validate steps
    if (Array.isArray(parsed.steps)) {
      plan.steps = parsed.steps
        .filter((step: any) => step && typeof step === 'object' && step.operation)
        .map((step: any, index: number) => {
          const filePath = this.normalizeFilePath(step.filePath || step.operation.filePath || `unknown-${index}`, workspaceContext);
          return {
            filePath,
            operation: {
              type: step.operation.type || 'modify',
              filePath,
              newPath: step.operation.newPath ? this.normalizeFilePath(step.operation.newPath, workspaceContext) : undefined,
              content: step.operation.content,
              reason: step.operation.reason || 'User requested change',
              dependencies: Array.isArray(step.operation.dependencies) 
                ? step.operation.dependencies.map((d: string) => this.normalizeFilePath(d, workspaceContext))
                : []
            },
            priority: typeof step.priority === 'number' ? step.priority : index + 1,
            rationale: step.rationale || step.operation.reason || 'Required for user request',
            risks: Array.isArray(step.risks) ? step.risks : [],
            agentInputs: step.agentInputs || []
          };
        });
    }

    // Sort steps by priority
    plan.steps.sort((a, b) => a.priority - b.priority);

    // Ensure affectedFiles includes all step file paths
    const stepFiles = new Set(plan.steps.map((s: any) => s.filePath));
    stepFiles.forEach((file: string) => {
      if (!plan.affectedFiles.includes(file)) {
        plan.affectedFiles.push(file);
      }
    });

    return plan;
  }

  /**
   * Normalize file path to be workspace-relative
   * Converts absolute paths (C:\path, /path) to relative paths
   */
  private normalizeFilePath(filePath: string, workspaceContext: WorkspaceContext): string {
    if (!filePath) {
      return '';
    }

    const path = require('path');
    const workspaceRoot = workspaceContext.workspaceRoot;

    // If no workspace root, return as-is (shouldn't happen)
    if (!workspaceRoot) {
      console.warn('[Orchestrator] No workspace root, cannot normalize path:', filePath);
      return filePath;
    }

    // If already relative (doesn't start with drive letter or /), return as-is
    if (!path.isAbsolute(filePath)) {
      // Clean up ./ prefix if present
      return filePath.replace(/^\.\//, '').replace(/^\.\\/, '');
    }

    // Convert absolute path to workspace-relative
    try {
      const relativePath = path.relative(workspaceRoot, filePath);
      console.log(`[Orchestrator] Normalized ${filePath} → ${relativePath}`);
      return relativePath.replace(/\\/g, '/'); // Use forward slashes for consistency
    } catch (error) {
      console.error('[Orchestrator] Failed to normalize path:', filePath, error);
      // Fall back to extracting just the filename
      return path.basename(filePath);
    }
  }

  /**
   * Create a fallback plan for when parsing fails
   */
  private createFallbackPlan(
    userRequest: string,
    taskAnalysis: any,
    workspaceContext: WorkspaceContext
  ): ExecutionPlan {
    const currentFile = workspaceContext.currentFile;

    return {
      taskType: this.parseTaskType(taskAnalysis.taskType),
      summary: `Apply user request: ${userRequest.substring(0, 100)}`,
      steps: currentFile
        ? [
            {
              filePath: currentFile.path,
              operation: {
                type: 'modify',
                filePath: currentFile.path,
                reason: 'User requested change',
                dependencies: []
              },
              priority: 1,
              rationale: 'Modify current file based on user request',
              risks: ['May need to verify changes'],
              agentInputs: []
            }
          ]
        : [],
      requiredFiles: currentFile ? [currentFile.path] : [],
      affectedFiles: currentFile ? [currentFile.path] : [],
      estimatedComplexity: taskAnalysis.complexity || 'medium',
      risks: ['Plan generation failed - using fallback single-file operation'],
      verificationSteps: ['Manually verify changes'],
      confidence: 0.5
    };
  }

  /**
   * Parse task type string
   */
  private parseTaskType(taskTypeStr: string): OrchestratorTaskType {
    const normalized = (taskTypeStr || '').toLowerCase().replace(/[_-]/g, '_');
    return (OrchestratorTaskType as any)[normalized.toUpperCase()] || OrchestratorTaskType.GENERAL;
  }

  /**
   * Select relevant agents based on task type
   */
  private selectRelevantAgents(taskType: OrchestratorTaskType): string[] {
    const agentMap: Record<OrchestratorTaskType, string[]> = {
      [OrchestratorTaskType.CODE_GENERATION]: ['architect', 'engineer', 'testing'],
      [OrchestratorTaskType.REFACTORING]: ['architect', 'engineer', 'performance', 'testing'],
      [OrchestratorTaskType.BUG_FIX]: ['engineer', 'testing', 'security'],
      [OrchestratorTaskType.FEATURE_ADD]: ['architect', 'engineer', 'security', 'testing', 'documentation'],
      [OrchestratorTaskType.DOCUMENTATION]: ['documentation', 'architect'],
      [OrchestratorTaskType.TESTING]: ['testing', 'engineer'],
      [OrchestratorTaskType.OPTIMIZATION]: ['performance', 'architect', 'engineer'],
      [OrchestratorTaskType.SECURITY]: ['security', 'engineer', 'testing'],
      [OrchestratorTaskType.GENERAL]: ['architect', 'engineer', 'security', 'performance', 'testing', 'documentation']
    };

    return agentMap[taskType] || agentMap[OrchestratorTaskType.GENERAL];
  }
}

