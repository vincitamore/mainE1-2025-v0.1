/**
 * Orchestrator Type Definitions
 * 
 * The Orchestrator is the high-level conductor that:
 * - Analyzes user requests
 * - Plans multi-file operations
 * - Coordinates specialist agents
 * - Manages execution flow
 */

import { AgentAnalysis } from '../agents/agent';

/**
 * Types of operations the Orchestrator can perform
 */
export enum OrchestratorTaskType {
  CODE_GENERATION = 'code_generation',    // Generate new code/features
  REFACTORING = 'refactoring',            // Restructure existing code
  BUG_FIX = 'bug_fix',                    // Fix specific issues
  FEATURE_ADD = 'feature_add',            // Add new functionality
  DOCUMENTATION = 'documentation',        // Generate/update docs
  TESTING = 'testing',                    // Add/improve tests
  OPTIMIZATION = 'optimization',          // Performance improvements
  SECURITY = 'security',                  // Security enhancements
  GENERAL = 'general'                     // General assistance
}

/**
 * Represents a single file operation
 */
export interface FileOperation {
  type: 'create' | 'modify' | 'delete' | 'rename' | 'terminal';
  filePath: string;
  newPath?: string;           // For rename operations
  content?: string;           // For create/modify operations (or terminal command)
  existingContent?: string;   // Original content for rollback
  reason: string;             // Why this operation is needed
  dependencies?: string[];    // Other files this depends on
  
  // Terminal-specific fields
  command?: string;           // Shell command to execute
  workingDirectory?: string;  // Where to run the command (defaults to workspace root)
  requiresApproval?: boolean; // Whether to ask user before running (default: true)
}

/**
 * A planned change to a specific file
 */
export interface PlannedChange {
  filePath: string;
  operation: FileOperation;
  priority: number;           // Execution order (lower = earlier)
  rationale: string;          // Detailed explanation
  risks: string[];            // Potential issues
  agentInputs?: {             // Which agents contributed to this plan
    agent: string;
    contribution: string;
  }[];
}

/**
 * The complete execution plan for a user request
 */
export interface ExecutionPlan {
  taskType: OrchestratorTaskType;
  summary: string;            // High-level description
  steps: PlannedChange[];     // Ordered list of changes
  requiredFiles: string[];    // Files needed for context
  affectedFiles: string[];    // Files that will be modified
  estimatedComplexity: 'low' | 'medium' | 'high';
  risks: string[];            // Overall risks
  verificationSteps: string[]; // How to verify success
  confidence: number;         // 0-1: Confidence in the plan
}

/**
 * Context gathered from the workspace
 */
export interface WorkspaceContext {
  workspaceRoot: string;      // Absolute path to workspace root
  currentFile?: {
    path: string;
    content: string;
    language: string;
    selection?: {
      start: { line: number; character: number };
      end: { line: number; character: number };
      text: string;
    };
  };
  openFiles: string[];
  recentFiles: string[];
  projectFiles?: string[];    // All files in the project
  gitStatus?: {
    branch: string;
    modified: string[];
    staged: string[];
    untracked: string[];
  };
  diagnostics?: Map<string, any[]>; // Errors/warnings by file
  mentionedFiles?: Array<{    // Files explicitly mentioned with @
    path: string;
    content: string;
    language: string;
  }>;
  terminalResults?: Array<{   // Results from terminal commands (for model feedback)
    command: string;
    exitCode: number;
    stdout: string;
    stderr: string;
    duration: number;
    timestamp: string;
  }>;
  hasTerminalFailures?: boolean; // Flag to indicate if any terminal commands failed
}

/**
 * Result of executing an operation
 */
export interface OperationResult {
  success: boolean;
  operation: FileOperation;
  error?: string;
  changes?: {
    linesAdded: number;
    linesRemoved: number;
    linesModified: number;
  };
}

/**
 * Complete execution result
 */
export interface ExecutionResult {
  plan: ExecutionPlan;
  results: OperationResult[];
  success: boolean;
  failedOperations: OperationResult[];
  rollbackAvailable: boolean;
  rollbackId?: string;        // ID for git worktree snapshot
  diagnosticsDelta?: {        // Change in errors/warnings
    before: number;
    after: number;
    resolved: string[];
    introduced: string[];
  };
}

/**
 * Progress callback for long-running operations
 */
export type OrchestratorProgressCallback = (event: OrchestratorProgressEvent) => void;

/**
 * Progress events during orchestration
 */
export interface OrchestratorProgressEvent {
  phase: 'analyzing' | 'planning' | 'gathering' | 'generating' | 'verifying' | 'applying' | 'complete';
  status: string;
  progress: number;           // 0-100
  currentFile?: string;
  details?: any;
}

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
  maxFilesPerOperation: number;
  enableVerification: boolean;
  enableRollback: boolean;
  requireApproval: boolean;   // Require user approval before applying changes
  timeoutMs: number;
  parallelAgents: boolean;
}

