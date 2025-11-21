import * as vscode from 'vscode';
import { OpenRouterProvider } from './llm/openrouter-provider';
import { 
  Agent, 
  CodeContext,
  ArchitectAgent,
  EngineerAgent,
  SecurityAgent,
  PerformanceAgent,
  TestingAgent,
  DocumentationAgent
} from './agents';
import { ODAISynthesizer, N2Controller, N2Result, ProgressEvent } from './synthesis';
import { AnalysisPanelProvider } from './ui/analysis-panel';
import { ResultsPanelProvider } from './ui/results-panel';
import { AnalysisSidebarProvider } from './ui/analysis-sidebar';
import { ProgressPanelProvider } from './ui/progress-panel';
import { classifyTask, TaskType } from './utils/task-classifier';

// Global reference to analysis sidebar provider
let analysisSidebarProvider: AnalysisSidebarProvider | undefined;

/**
 * Create a timeout promise that rejects after specified milliseconds
 */
function createTimeout<T>(ms: number, message: string): Promise<T> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}

/**
 * Get user-friendly error message
 */
function getUserFriendlyError(error: any): string {
  const message = error?.message || String(error);
  
  // API errors
  if (message.includes('API error') || message.includes('OpenRouter')) {
    if (message.includes('401') || message.includes('403')) {
      return 'Invalid API key. Please check your OpenRouter API key in settings.';
    } else if (message.includes('429')) {
      return 'Rate limit exceeded. Please wait a moment and try again.';
    } else if (message.includes('timeout')) {
      return 'Request timed out. The model might be overloaded. Try again in a moment.';
    } else {
      return `API Error: ${message}`;
    }
  }
  
  // Timeout
  if (message.includes('timeout')) {
    return 'Operation timed out (>5 minutes). Try with smaller code selection.';
  }
  
  // Network errors
  if (message.includes('fetch') || message.includes('network')) {
    return 'Network error. Please check your internet connection.';
  }
  
  // Generic
  return `Error: ${message}`;
}

/**
 * Handle successful code generation result
 */
async function handleSuccessResult(
  result: N2Result,
  editor: vscode.TextEditor,
  selection: vscode.Selection,
  originalCode: string,
  document: vscode.TextDocument,
  n2Controller: N2Controller,
  context: vscode.ExtensionContext
): Promise<void> {
  // Show modern results panel with everything
  ResultsPanelProvider.show(
    context.extensionUri,
    result,
    originalCode,
    editor,
    selection,
    context
  );
}

export function activate(context: vscode.ExtensionContext) {
  console.log('CodeMind extension activated');
  
  // Register Analysis Sidebar Provider
  analysisSidebarProvider = new AnalysisSidebarProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      AnalysisSidebarProvider.viewType,
      analysisSidebarProvider
    )
  );
  
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
      
      // Get user instruction
      const instruction = await vscode.window.showInputBox({
        prompt: 'What would you like to do with this code?',
        placeHolder: 'e.g., Add error handling, Optimize performance, Review for security...'
      });
      
      if (!instruction) {
        return;
      }
      
      // Classify task type for task-aware agent prompts and relevance weighting
      const taskType = classifyTask(instruction);
      console.log(`[CodeMind] Task classified as: ${taskType}`);
      
      // Get configuration
      const config = vscode.workspace.getConfiguration('codemind');
      const apiKey = config.get<string>('openrouter.apiKey');
      const qualityThreshold = config.get<number>('qualityThreshold', 9.0);
      
      if (!apiKey) {
        vscode.window.showErrorMessage(
          'CodeMind: Please set your OpenRouter API key in settings (codemind.openrouter.apiKey)'
        );
        return;
      }
      
      // Show beautiful progress panel
      ProgressPanelProvider.show(context.extensionUri);
      
      try {
        // Initialize LLM provider
        const llmProvider = new OpenRouterProvider(apiKey);
        
        // Create agent configuration
        const model = config.get<string>('openrouter.model') || 'x-ai/grok-4.1-fast';
        const agentConfig = {
          model: model,
          temperature: 0.7,
          maxTokens: 50000  // High limit to prevent truncation
        };
        
        // Create all 6 specialist agents
        const agents: Agent[] = [
          new ArchitectAgent(llmProvider, agentConfig),
          new EngineerAgent(llmProvider, agentConfig),
          new SecurityAgent(llmProvider, agentConfig),
          new PerformanceAgent(llmProvider, agentConfig),
          new TestingAgent(llmProvider, agentConfig),
          new DocumentationAgent(llmProvider, agentConfig)
        ];
        
        // Create ODAI synthesizer
        const synthesizer = new ODAISynthesizer(llmProvider, qualityThreshold, model);
        
        // Create N² controller
        const n2Controller = new N2Controller(4, qualityThreshold);
        
      // Gather code context - provide FULL file for context
      const document = editor.document;
      const fullFileContent = document.getText(); // Get entire file
      
      // Gather diagnostics (linter/compiler errors and warnings)
      const diagnostics = vscode.languages.getDiagnostics(document.uri);
      const formattedDiagnostics = diagnostics.map(diag => ({
        line: diag.range.start.line,
        character: diag.range.start.character,
        severity: diag.severity === vscode.DiagnosticSeverity.Error ? 'error' as const :
                  diag.severity === vscode.DiagnosticSeverity.Warning ? 'warning' as const :
                  diag.severity === vscode.DiagnosticSeverity.Information ? 'info' as const :
                  'hint' as const,
        message: diag.message,
        source: diag.source,
        code: diag.code ? String(diag.code) : undefined
      }));
      
      console.log(`[CodeMind] Found ${formattedDiagnostics.length} diagnostics in file`);
      if (formattedDiagnostics.length > 0) {
        const errors = formattedDiagnostics.filter(d => d.severity === 'error').length;
        const warnings = formattedDiagnostics.filter(d => d.severity === 'warning').length;
        console.log(`[CodeMind] Errors: ${errors}, Warnings: ${warnings}`);
      }
      
      const codeContext: CodeContext = {
        code: fullFileContent,  // Full file for context
        filePath: document.uri.fsPath,
        language: document.languageId,
        selectionRange: {
          start: {
            line: selection.start.line,
            character: selection.start.character
          },
          end: {
            line: selection.end.line,
            character: selection.end.character
          },
          text: selectedText  // The specific selection
        },
        diagnostics: formattedDiagnostics  // Include linter/compiler issues
      };
        
        // Progress callback for real-time updates to beautiful panel
        const progressCallback = (event: ProgressEvent) => {
          ProgressPanelProvider.update(event);
        };
        
        // Execute N² loop with timeout protection (5 minutes max)
        const result = await Promise.race([
          n2Controller.execute(instruction, agents, synthesizer, codeContext, taskType, progressCallback),
          createTimeout<N2Result>(300000, 'N² loop exceeded 5 minute timeout')
        ]) as N2Result;
          
        // Close progress panel
        ProgressPanelProvider.close();
        
        // Display results
        if (result.success && result.converged) {
          // Success - show the improved code with multiple options
          await handleSuccessResult(
            result,
            editor,
            selection,
            selectedText,
            document,
            n2Controller,
            context
          );
        } else {
          // Did not converge or failed
          vscode.window.showWarningMessage(
            `CodeMind: ${result.explanation}\n\n` +
            `Best Quality: ${result.qualityScore.toFixed(1)}/10\n` +
            `Iterations: ${result.iterations.length}\n` +
            `Time: ${(result.totalTime / 1000).toFixed(1)}s`,
            { modal: true }
          );
        }
        
        // Always log to console
        console.log('=== CodeMind N² Execution ===');
        console.log(n2Controller.getSummary(result));
        
      } catch (error: any) {
        ProgressPanelProvider.close();
        const friendlyMessage = getUserFriendlyError(error);
        vscode.window.showErrorMessage(`CodeMind: ${friendlyMessage}`);
        console.error('[CodeMind] Error details:', error);
        console.error('[CodeMind] Stack trace:', error.stack);
      }
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
  analysisSidebarProvider = undefined;
  
  // Clean up inline diff decorations
  const { InlineDiffViewer } = require('./ui/inline-diff');
  InlineDiffViewer.dispose();
}

/**
 * Get the analysis sidebar provider instance
 */
export function getAnalysisSidebarProvider(): AnalysisSidebarProvider | undefined {
  return analysisSidebarProvider;
}
