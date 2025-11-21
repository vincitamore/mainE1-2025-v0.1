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
import { extractJSON } from '../utils/text-extraction';
import { parseJSONWithTechnician } from '../utils/json-technician';
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

⚠️ CRITICAL: You MUST return ONLY valid JSON.
- NO markdown code fences
- All string values on a SINGLE line
- Use \\n for newlines (NOT actual newline characters)
- Escape special characters: \\n \\t \\" \\\\
- No trailing commas
- Double quotes only

JSON WILL BE PARSED BY JSON.parse() - if it's malformed, the entire operation fails!`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      this.config
    );

    const jsonStr = extractJSON(response.content);
    const parsed = await parseJSONWithTechnician<any>(
      jsonStr,
      this.llmProvider,
      this.config,
      'task analysis',
      `{
  "taskType": "code_generation" | "refactoring" | "bug_fix" | etc.,
  "intent": "brief description",
  "scope": "single-file" | "multi-file" | "project-wide",
  "requiredContext": ["file paths or patterns"],
  "complexity": "low" | "medium" | "high"
}`
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

Your plans must be:
- Specific: Exact file paths and operations
- Ordered: Dependencies resolved, proper sequence
- Safe: No data loss, rollback possible
- Verified: Include verification steps

⚠️ JSON FORMAT REQUIREMENTS (NON-NEGOTIABLE):
1. Return ONLY valid JSON (NO markdown, NO code fences, NO extra text)
2. All string values MUST be on a SINGLE line
3. Use \\n for newlines in strings (NOT actual newline characters)
4. Escape ALL special characters: \\n \\t \\" \\\\
5. NO trailing commas anywhere
6. Use double quotes ONLY (never single quotes)
7. For "content" fields: Use SHORT placeholders (actual code generation happens later)

EXAMPLE OF CORRECT "content" field:
"content": "// Placeholder - full implementation will be generated"

EXAMPLE OF WRONG (WILL FAIL):
"content": "Line 1
Line 2
Line 3"

Your JSON will be parsed by JSON.parse() - if it fails, the entire operation fails!`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      { ...this.config, temperature: 0.3 } // Lower temperature for planning
    );

    const jsonStr = extractJSON(response.content);
    const parsed = await parseJSONWithTechnician<any>(
      jsonStr,
      this.llmProvider,
      this.config,
      'execution plan',
      `{
  "taskType": "operation type",
  "summary": "brief description",
  "steps": [
    {
      "filePath": "path/to/file",
      "operation": {
        "type": "create" | "modify" | "delete" | "rename",
        "filePath": "same as parent",
        "content": "brief placeholder - NOT full code",
        "reason": "why this operation"
      },
      "priority": 1,
      "rationale": "detailed explanation",
      "risks": ["potential issues"]
    }
  ],
  "affectedFiles": ["list of file paths"],
  "estimatedComplexity": "low" | "medium" | "high",
  "confidence": 0.85
}`
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

Consider:
- Dependencies between files (imports, references)
- Order of operations (create before modify, etc.)
- Rollback strategy (how to undo if something fails)
- Verification (how to check if changes work)

## Response Format:
Return ONLY valid JSON (no markdown code fences, no extra text):

⚠️ CRITICAL JSON RULES:
- All string values must be on a SINGLE line
- Use \\n for newlines within strings (NOT actual newlines)
- Escape all special characters: \\n \\t \\" \\\\
- No trailing commas
- Double quotes only (no single quotes)
- For the "content" field: Use a brief placeholder like "// Content will be generated by specialist agents"
- Do NOT try to generate full file content in the plan - that comes later

{
  "taskType": "code_generation",
  "summary": "Create a new utility function and add tests",
  "steps": [
    {
      "filePath": "src/utils/helper.ts",
      "operation": {
        "type": "create",
        "filePath": "src/utils/helper.ts",
        "content": "// Helper utility function - full implementation will be generated",
        "reason": "Create new utility function"
      },
      "priority": 1,
      "rationale": "Need utility function before tests can reference it",
      "risks": ["May conflict with existing utilities"],
      "agentInputs": []
    },
    {
      "filePath": "tests/helper.test.ts",
      "operation": {
        "type": "create",
        "filePath": "tests/helper.test.ts",
        "content": "// Test suite - full tests will be generated",
        "reason": "Add test coverage"
      },
      "priority": 2,
      "rationale": "Tests should be created after implementation",
      "risks": ["Tests may need adjustment after implementation"],
      "agentInputs": []
    }
  ],
  "requiredFiles": ["src/utils/index.ts"],
  "affectedFiles": ["src/utils/helper.ts", "tests/helper.test.ts"],
  "estimatedComplexity": "medium",
  "risks": ["May need to update imports in other files"],
  "verificationSteps": [
    "Run TypeScript compiler to check for errors",
    "Run tests to verify functionality",
    "Check that no existing functionality is broken"
  ],
  "confidence": 0.85
}

⚠️ REMINDER: Keep "content" fields SHORT. Full code generation happens in a later phase!`;

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

