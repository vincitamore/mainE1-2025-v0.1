/**
 * Code Generator
 * 
 * Generates code for multiple files using the N² system:
 * 1. For each file in the plan
 * 2. Gather relevant context
 * 3. Run specialist agents
 * 4. Synthesize with ODAI
 * 5. Apply N² loop for quality
 */

import * as vscode from 'vscode';
import { LLMProvider, LLMConfig } from '../llm/provider';
import { Agent, CodeContext } from '../agents/agent';
import { ODAISynthesizer } from '../synthesis/odai-synthesizer';
import { N2Controller } from '../synthesis/n2-controller';
import { N2Result } from '../synthesis/types';
import { ExecutionPlan, PlannedChange, FileOperation, OrchestratorProgressCallback } from './types';
import { ContextManager } from './context-manager';
import { TaskType } from '../utils/task-classifier';

/**
 * Result of generating code for a single file
 */
export interface FileGenerationResult {
  filePath: string;
  operation: FileOperation;
  generatedContent: string;
  quality: number;
  converged: boolean;
  iterations: number;
  insights: string[];
}

/**
 * Code Generator
 */
export class CodeGenerator {
  constructor(
    private llmProvider: LLMProvider,
    private llmConfig: LLMConfig,
    private agents: Map<string, Agent>,
    private contextManager: ContextManager
  ) {}

  /**
   * Generate code for all files in the execution plan
   * @param applyImmediately - If true, write files as soon as they're generated (better UX)
   */
  async generateCode(
    plan: ExecutionPlan,
    userRequest: string,
    progressCallback?: OrchestratorProgressCallback,
    applyImmediately: boolean = false
  ): Promise<FileGenerationResult[]> {
    const results: FileGenerationResult[] = [];
    const totalSteps = plan.steps.length;

    progressCallback?.({
      phase: 'generating',
      status: 'Generating code for multiple files...',
      progress: 0
    });

    // Generate code for each file
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      const progress = Math.floor(((i + 1) / totalSteps) * 100);

      progressCallback?.({
        phase: 'generating',
        status: `Generating ${step.operation.type}: ${step.filePath}`,
        progress,
        currentFile: step.filePath
      });

      try {
        const result = await this.generateFileCode(step, userRequest, plan);
        results.push(result);

        // Optionally apply immediately for better UX (user sees files appear during generation)
        if (applyImmediately && result.converged && result.generatedContent) {
          try {
            const vscode = require('vscode');
            const path = require('path');
            const fs = require('fs').promises;
            
            // Ensure directory exists
            const dir = path.dirname(result.filePath);
            await fs.mkdir(dir, { recursive: true });
            
            // Write file
            await fs.writeFile(result.filePath, result.generatedContent, 'utf8');
            
            console.log(`[CodeGenerator] ✅ Immediately applied: ${result.filePath}`);
            
            progressCallback?.({
              phase: 'generating',
              status: `✅ Created ${step.filePath}`,
              progress,
              currentFile: step.filePath
            });
          } catch (error) {
            console.error(`[CodeGenerator] Failed to immediately apply ${result.filePath}:`, error);
            // Don't fail the whole operation, just log the error
          }
        }
      } catch (error) {
        console.error(`[CodeGenerator] Failed to generate ${step.filePath}:`, error);
        // Continue with other files
        results.push({
          filePath: step.filePath,
          operation: step.operation,
          generatedContent: '',
          quality: 0,
          converged: false,
          iterations: 0,
          insights: [`Failed to generate: ${error}`]
        });
      }
    }

    progressCallback?.({
      phase: 'generating',
      status: 'Code generation complete',
      progress: 100
    });

    return results;
  }

  /**
   * Generate code for a single file using N² system
   */
  private async generateFileCode(
    step: PlannedChange,
    userRequest: string,
    plan: ExecutionPlan
  ): Promise<FileGenerationResult> {
    const { filePath, operation, rationale } = step;

    // Build instruction for this file
    const instruction = this.buildFileInstruction(userRequest, step, plan);

    // Gather context for this file
    const codeContext = await this.gatherFileContext(filePath, operation);

    // Initialize synthesis components
    const synthesizer = new ODAISynthesizer(
      this.llmProvider,
      8.5, // qualityThreshold - slightly lower for multi-file operations
      this.llmConfig.model
    );
    const n2Controller = new N2Controller(
      3,   // maxIterations - fewer iterations for speed in multi-file context
      8.5  // qualityThreshold - slightly lower for multi-file operations
    );

    // Convert agents map to array
    const agentsArray = Array.from(this.agents.values());

    // Run N² loop with 10 minute timeout per file (complex code needs time!)
    let result: N2Result;
    try {
      result = await Promise.race([
        n2Controller.execute(
          instruction,
          agentsArray,
          synthesizer,
          codeContext,
          this.classifyOperationType(operation.type)
        ),
        this.createTimeout(600000, 'Code generation exceeded 10 minute timeout')
      ]) as N2Result;
    } catch (error: any) {
      console.error(`[CodeGenerator] Timeout or error for ${filePath}:`, error.message);
      // Return a failure result instead of throwing
      return {
        filePath,
        operation,
        generatedContent: '',
        quality: 0,
        converged: false,
        iterations: 0,
        insights: [`Timeout: ${error.message}`]
      };
    }

    // Validate result
    if (!result || !result.iterations || result.iterations.length === 0) {
      console.error(`[CodeGenerator] Invalid N² result for ${filePath}`);
      return {
        filePath,
        operation,
        generatedContent: '',
        quality: 0,
        converged: false,
        iterations: 0,
        insights: ['Invalid N² result']
      };
    }

    const lastIteration = result.iterations[result.iterations.length - 1];
    const keyDecisions = lastIteration?.synthesis?.keyDecisions;
    
    // Even if not converged, return what we have
    const quality = typeof result.qualityScore === 'number' ? result.qualityScore : 0;
    const code = result.finalCode || '';
    
    if (!code) {
      console.warn(`[CodeGenerator] No code generated for ${filePath} (quality: ${quality})`);
    }
    
    return {
      filePath,
      operation,
      generatedContent: code,
      quality,
      converged: result.converged,
      iterations: result.iterations.length,
      insights: keyDecisions ? Object.values(keyDecisions).filter(v => typeof v === 'string') : []
    };
  }

  /**
   * Create a timeout promise
   */
  private createTimeout(ms: number, message: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }

  /**
   * Build instruction for a specific file
   */
  private buildFileInstruction(
    userRequest: string,
    step: PlannedChange,
    plan: ExecutionPlan
  ): string {
    let instruction = `# User Request\n${userRequest}\n\n`;

    instruction += `# Overall Plan\n${plan.summary}\n\n`;

    instruction += `# Your Task for This File\n`;
    instruction += `File: ${step.filePath}\n`;
    instruction += `Operation: ${step.operation.type.toUpperCase()}\n`;
    instruction += `Rationale: ${step.rationale}\n\n`;

    if (step.operation.dependencies && step.operation.dependencies.length > 0) {
      instruction += `# Dependencies\n`;
      instruction += `This file depends on:\n`;
      step.operation.dependencies.forEach(dep => {
        instruction += `- ${dep}\n`;
      });
      instruction += '\n';
    }

    if (step.risks && step.risks.length > 0) {
      instruction += `# Risks to Avoid\n`;
      step.risks.forEach(risk => {
        instruction += `- ${risk}\n`;
      });
      instruction += '\n';
    }

    switch (step.operation.type) {
      case 'create':
        instruction += `Generate complete, production-ready code for this new file.\n`;
        instruction += `Include all necessary imports, type definitions, and documentation.\n`;
        break;

      case 'modify':
        instruction += `Modify the existing code according to the rationale.\n`;
        instruction += `Preserve existing functionality unless explicitly changing it.\n`;
        instruction += `Maintain the file's current style and patterns.\n`;
        break;

      case 'delete':
        instruction += `This file will be deleted. No code generation needed.\n`;
        break;

      case 'rename':
        instruction += `This file will be renamed to ${step.operation.newPath}.\n`;
        instruction += `Update any internal references if needed.\n`;
        break;
    }

    return instruction;
  }

  /**
   * Gather context for a specific file
   */
  private async gatherFileContext(
    filePath: string,
    operation: FileOperation
  ): Promise<CodeContext> {
    let content = '';
    let language = 'typescript'; // Default

    // Convert workspace-relative path to absolute
    const path = require('path');
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    const absolutePath = path.isAbsolute(filePath) 
      ? filePath 
      : path.join(workspaceRoot, filePath);

    // For modify operations, read existing content
    if (operation.type === 'modify' || operation.type === 'rename') {
      try {
        const uri = vscode.Uri.file(absolutePath);
        const document = await vscode.workspace.openTextDocument(uri);
        content = document.getText();
        language = document.languageId;
      } catch (error) {
        console.warn(`[CodeGenerator] Could not read ${filePath}, treating as new file`);
      }
    }

    // For create operations, use empty content
    if (operation.type === 'create') {
      // Infer language from file extension
      const ext = filePath.split('.').pop()?.toLowerCase();
      const langMap: Record<string, string> = {
        'ts': 'typescript',
        'tsx': 'typescriptreact',
        'js': 'javascript',
        'jsx': 'javascriptreact',
        'py': 'python',
        'go': 'go',
        'rs': 'rust',
        'java': 'java',
        'cs': 'csharp',
        'cpp': 'cpp',
        'c': 'c',
        'rb': 'ruby',
        'php': 'php',
        'swift': 'swift',
        'kt': 'kotlin',
        'md': 'markdown',
        'json': 'json',
        'yaml': 'yaml',
        'yml': 'yaml',
        'html': 'html',
        'css': 'css',
        'scss': 'scss',
        'sql': 'sql'
      };
      language = langMap[ext || 'ts'] || 'plaintext';
    }

    // Get diagnostics for this file if it exists
    const diagnostics = await this.getFileDiagnostics(filePath);

    return {
      code: content,
      filePath,
      language,
      diagnostics
    };
  }

  /**
   * Get diagnostics for a specific file
   */
  private async getFileDiagnostics(filePath: string): Promise<CodeContext['diagnostics']> {
    try {
      // Convert workspace-relative path to absolute
      const path = require('path');
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
      const absolutePath = path.isAbsolute(filePath) 
        ? filePath 
        : path.join(workspaceRoot, filePath);

      const uri = vscode.Uri.file(absolutePath);
      const vscDiagnostics = vscode.languages.getDiagnostics(uri);

      return vscDiagnostics.map(d => ({
        line: d.range.start.line,
        character: d.range.start.character,
        severity: this.mapSeverity(d.severity),
        message: d.message,
        source: d.source,
        code: d.code as string | number | undefined
      }));
    } catch {
      return [];
    }
  }

  /**
   * Map VSCode diagnostic severity
   */
  private mapSeverity(severity: vscode.DiagnosticSeverity): 'error' | 'warning' | 'info' | 'hint' {
    switch (severity) {
      case vscode.DiagnosticSeverity.Error:
        return 'error';
      case vscode.DiagnosticSeverity.Warning:
        return 'warning';
      case vscode.DiagnosticSeverity.Information:
        return 'info';
      case vscode.DiagnosticSeverity.Hint:
        return 'hint';
      default:
        return 'info';
    }
  }

  /**
   * Classify operation type for task classification
   */
  private classifyOperationType(operationType: string): TaskType {
    switch (operationType) {
      case 'create':
        return TaskType.CODE_GENERATION;
      case 'modify':
        return TaskType.REFACTORING;
      case 'delete':
        return TaskType.REFACTORING;
      case 'rename':
        return TaskType.REFACTORING;
      default:
        return TaskType.GENERAL;
    }
  }
}

