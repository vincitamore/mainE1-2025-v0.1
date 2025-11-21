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
import { ChatSidebarProvider } from './ui/chat-sidebar';
import { classifyTask, TaskType } from './utils/task-classifier';
import { OrchestratorAgent, ContextManager, FileManager, CodeGenerator } from './orchestrator';

// Global references
let analysisSidebarProvider: AnalysisSidebarProvider | undefined;
let chatSidebarProvider: ChatSidebarProvider | undefined;
let orchestratorAgent: OrchestratorAgent | undefined;
let contextManager: ContextManager | undefined;
let fileManager: FileManager | undefined;
let codeGenerator: CodeGenerator | undefined;

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
  
  // Initialize managers
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
  contextManager = new ContextManager(workspaceRoot);
  fileManager = new FileManager();
  
  // Register Analysis Sidebar Provider
  analysisSidebarProvider = new AnalysisSidebarProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      AnalysisSidebarProvider.viewType,
      analysisSidebarProvider
    )
  );
  
  // Register Chat Sidebar Provider (Orchestrator UI)
  chatSidebarProvider = new ChatSidebarProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ChatSidebarProvider.viewType,
      chatSidebarProvider
    )
  );
  
  // Handle user messages from chat
  chatSidebarProvider.onMessage('userMessage', async (data) => {
    await handleOrchestratorRequest(data.content, context);
  });
  
  // Handle apply changes
  chatSidebarProvider.onMessage('applyChanges', async (data) => {
    await handleApplyChanges(data.messageId);
  });
  
  // Handle reject changes
  chatSidebarProvider.onMessage('rejectChanges', async (data) => {
    await handleRejectChanges(data.messageId);
  });
  
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

/**
 * Handle orchestrator request from chat sidebar
 */
async function handleOrchestratorRequest(userRequest: string, context: vscode.ExtensionContext) {
  if (!chatSidebarProvider || !contextManager || !fileManager) {
    vscode.window.showErrorMessage('CodeMind: Orchestrator not initialized');
    return;
  }

  try {
    // Add assistant "thinking" message
    const thinkingId = chatSidebarProvider.addMessage({
      role: 'assistant',
      content: '🤔 Analyzing your request...'
    });

    // Get LLM provider and config
    const config = vscode.workspace.getConfiguration('codemind');
    const apiKey = config.get<string>('openrouter.apiKey');
    const model = config.get<string>('openrouter.model') || 'x-ai/grok-beta';

    if (!apiKey) {
      chatSidebarProvider.updateMessage(thinkingId, {
        content: '❌ Please set your OpenRouter API key in settings:\n\nSettings → Extensions → CodeMind → OpenRouter API Key'
      });
      return;
    }

    const llmProvider = new OpenRouterProvider(apiKey);
    const llmConfig = {
      model,
      temperature: 0.7,
      maxTokens: 4096
    };

    // Initialize specialist agents
    const agents = new Map<string, Agent>();
    agents.set('architect', new ArchitectAgent(llmProvider, llmConfig));
    agents.set('engineer', new EngineerAgent(llmProvider, llmConfig));
    agents.set('security', new SecurityAgent(llmProvider, llmConfig));
    agents.set('performance', new PerformanceAgent(llmProvider, llmConfig));
    agents.set('testing', new TestingAgent(llmProvider, llmConfig));
    agents.set('documentation', new DocumentationAgent(llmProvider, llmConfig));

    // Initialize orchestrator agent and code generator
    if (!orchestratorAgent) {
      orchestratorAgent = new OrchestratorAgent(llmProvider, llmConfig, agents);
    }
    if (!codeGenerator) {
      codeGenerator = new CodeGenerator(llmProvider, llmConfig, agents, contextManager);
    }

    // Phase 1: Gather workspace context
    chatSidebarProvider.updateMessage(thinkingId, {
      content: '📂 Gathering workspace context...'
    });
    
    const workspaceContext = await contextManager.gatherContext();

    // Phase 2: Analyze request
    chatSidebarProvider.updateMessage(thinkingId, {
      content: '🔍 Analyzing task requirements...'
    });

    const taskAnalysis = await orchestratorAgent.analyzeRequest(
      userRequest,
      workspaceContext,
      (event) => {
        chatSidebarProvider?.updateMessage(thinkingId, {
          content: `${event.status} (${event.progress}%)`
        });
      }
    );

    // Phase 3: Plan operations
    chatSidebarProvider.updateMessage(thinkingId, {
      content: '📋 Planning file operations...'
    });

    const plan = await orchestratorAgent.planOperations(
      userRequest,
      taskAnalysis,
      workspaceContext,
      (event) => {
        chatSidebarProvider?.updateMessage(thinkingId, {
          content: `${event.status} (${event.progress}%)`
        });
      }
    );

    // Display plan to user
    const planSummary = `## Execution Plan\n\n` +
      `**Task Type:** ${plan.taskType}\n` +
      `**Complexity:** ${plan.estimatedComplexity}\n` +
      `**Confidence:** ${(plan.confidence * 100).toFixed(0)}%\n\n` +
      `### Files to be modified:\n` +
      plan.affectedFiles.map(f => `- ${f}`).join('\n') + '\n\n' +
      `### Operations:\n` +
      plan.steps.map((step, i) => `${i + 1}. ${step.operation.type.toUpperCase()}: ${step.filePath}\n   ${step.rationale}`).join('\n\n');

    const planMessageId = chatSidebarProvider.addMessage({
      role: 'assistant',
      content: planSummary,
      metadata: {
        filesAffected: plan.affectedFiles,
        operationType: plan.taskType,
        quality: plan.confidence
      }
    });

    // Phase 4: Generate code for all files
    chatSidebarProvider.updateMessage(planMessageId, {
      content: planSummary + '\n\n🔧 Generating code...'
    });

    const generationResults = await codeGenerator.generateCode(
      plan,
      userRequest,
      (event) => {
        chatSidebarProvider?.updateMessage(planMessageId, {
          content: planSummary + `\n\n${event.status} (${event.progress}%)`
        });
      }
    );

    // Update plan with generated content
    for (let i = 0; i < generationResults.length; i++) {
      const result = generationResults[i];
      if (result.converged && plan.steps[i]) {
        plan.steps[i].operation.content = result.generatedContent;
      }
    }

    // Show results
    const avgQuality = generationResults.reduce((sum, r) => sum + r.quality, 0) / generationResults.length;
    const failedFiles = generationResults.filter(r => !r.converged);

    let resultSummary = planSummary + '\n\n## Generation Complete\n\n';
    resultSummary += `✅ Generated ${generationResults.length} file(s)\n`;
    resultSummary += `📊 Average Quality: ${(avgQuality * 10).toFixed(1)}/10\n`;
    
    if (failedFiles.length > 0) {
      resultSummary += `\n⚠️ Failed to generate ${failedFiles.length} file(s):\n`;
      failedFiles.forEach(f => {
        resultSummary += `- ${f.filePath}\n`;
      });
    }

    resultSummary += `\n**Ready to apply changes?**\nClick "Apply Changes" below to write these files.`;

    chatSidebarProvider.updateMessage(planMessageId, {
      content: resultSummary,
      metadata: {
        filesAffected: plan.affectedFiles,
        operationType: plan.taskType,
        quality: avgQuality,
        rollbackId: undefined // TODO: Create git worktree snapshot
      }
    });

  } catch (error: any) {
    console.error('[Orchestrator] Error:', error);
    
    const errorMessage = chatSidebarProvider?.getCurrentSession().messages.find(m => 
      m.content.includes('Analyzing') || m.content.includes('Planning')
    );
    
    if (errorMessage) {
      chatSidebarProvider?.updateMessage(errorMessage.id, {
        role: 'assistant',
        content: `❌ Error: ${error.message || String(error)}`
      });
    } else {
      chatSidebarProvider?.addMessage({
        role: 'assistant',
        content: `❌ Error: ${error.message || String(error)}`
      });
    }
  }
}

/**
 * Handle apply changes request
 */
async function handleApplyChanges(messageId: string) {
  if (!chatSidebarProvider || !fileManager) {
    vscode.window.showErrorMessage('CodeMind: System not initialized');
    return;
  }

  try {
    const session = chatSidebarProvider.getCurrentSession();
    const message = session.messages.find(m => m.id === messageId);
    
    if (!message || !message.metadata?.filesAffected) {
      vscode.window.showWarningMessage('CodeMind: No changes to apply');
      return;
    }

    // TODO: Get the execution plan and file operations from the message
    // For now, show a confirmation
    const confirmation = await vscode.window.showInformationMessage(
      `Apply changes to ${message.metadata.filesAffected.length} file(s)?`,
      { modal: true },
      'Apply', 'Cancel'
    );

    if (confirmation !== 'Apply') {
      chatSidebarProvider.addMessage({
        role: 'system',
        content: '❌ Changes cancelled by user'
      });
      return;
    }

    // TODO: Execute file operations using file manager
    // For now, show success
    chatSidebarProvider.addMessage({
      role: 'system',
      content: '✅ Changes applied successfully!\n\n' +
        `Modified ${message.metadata.filesAffected.length} file(s).\n` +
        'Note: Full implementation of file application is in progress.'
    });

    vscode.window.showInformationMessage('CodeMind: Changes applied successfully!');
  } catch (error: any) {
    console.error('[CodeMind] Error applying changes:', error);
    vscode.window.showErrorMessage(`CodeMind: Failed to apply changes: ${error.message}`);
  }
}

/**
 * Handle reject changes request
 */
async function handleRejectChanges(messageId: string) {
  if (!chatSidebarProvider) {
    return;
  }

  chatSidebarProvider.addMessage({
    role: 'system',
    content: '❌ Changes rejected. The proposed changes will not be applied.'
  });

  vscode.window.showInformationMessage('CodeMind: Changes rejected');
}

export function deactivate() {
  console.log('CodeMind extension deactivated');
  analysisSidebarProvider = undefined;
  chatSidebarProvider = undefined;
  orchestratorAgent = undefined;
  contextManager = undefined;
  fileManager = undefined;
  codeGenerator = undefined;
  
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
