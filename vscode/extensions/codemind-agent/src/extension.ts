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
import { OrchestratorAgent, ContextManager, FileManager, CodeGenerator, TerminalManager } from './orchestrator';
import { TerminalApprovalPanel } from './ui/terminal-approval-panel';

// Global references
let analysisSidebarProvider: AnalysisSidebarProvider | undefined;
let chatSidebarProvider: ChatSidebarProvider | undefined;
let orchestratorAgent: OrchestratorAgent | undefined;
let contextManager: ContextManager | undefined;
let fileManager: FileManager | undefined;
let codeGenerator: CodeGenerator | undefined;
let terminalManager: TerminalManager | undefined;
let terminalApprovalPanel: TerminalApprovalPanel | undefined;

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
  terminalManager = new TerminalManager();
  terminalApprovalPanel = TerminalApprovalPanel.getInstance();
  
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
    await handleOrchestratorRequest(data.content, data.mentions || [], context);
  });
  
  // Handle apply changes
  chatSidebarProvider.onMessage('applyChanges', async (data) => {
    await handleApplyChanges(data.messageId);
  });
  
  // Handle reject changes
  chatSidebarProvider.onMessage('rejectChanges', async (data) => {
    await handleRejectChanges(data.messageId);
  });
  
  // Handle terminal retry
  chatSidebarProvider.onMessage('retryTerminal', async (data) => {
    await handleTerminalRetry(data.messageId);
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

  // Register open chat command
  const openChat = vscode.commands.registerCommand(
    'codemind.openChat',
    async () => {
      // Focus the CodeMind chat view
      await vscode.commands.executeCommand('codemind.chatView.focus');
    }
  );
  
  context.subscriptions.push(inlineEdit, reviewCode, openChat);

  // Auto-open the chat sidebar on first activation
  setTimeout(async () => {
    try {
      await vscode.commands.executeCommand('codemind.chatView.focus');
    } catch (error) {
      console.log('[CodeMind] Could not auto-open chat (view may not be ready)');
    }
  }, 1000);
}

/**
 * Handle orchestrator request from chat sidebar
 */
async function handleOrchestratorRequest(userRequest: string, mentionedFiles: string[], context: vscode.ExtensionContext) {
  if (!chatSidebarProvider || !contextManager || !fileManager) {
    vscode.window.showErrorMessage('CodeMind: Orchestrator not initialized');
    return;
  }

  try {
    // Load mentioned files into context
    const loadedFiles: Array<{ path: string; content: string; language: string }> = [];
    if (mentionedFiles && mentionedFiles.length > 0) {
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
      const path = require('path');
      
      for (const mentionedPath of mentionedFiles) {
        try {
          let absolutePath: string;
          
          // If it's already an absolute path or contains path separators, use it directly
          if (path.isAbsolute(mentionedPath) || mentionedPath.includes('/') || mentionedPath.includes('\\')) {
            absolutePath = path.isAbsolute(mentionedPath)
              ? mentionedPath
              : path.join(workspaceRoot, mentionedPath);
          } else {
            // It's just a filename - search the workspace for it
            console.log(`[CodeMind] Searching workspace for file: ${mentionedPath}`);
            const foundFiles = await vscode.workspace.findFiles(`**/${mentionedPath}`, '**/node_modules/**', 10);
            
            if (foundFiles.length === 0) {
              throw new Error(`File not found: ${mentionedPath}`);
            }
            
            if (foundFiles.length > 1) {
              console.warn(`[CodeMind] Multiple files found for ${mentionedPath}, using first: ${foundFiles[0].fsPath}`);
            }
            
            absolutePath = foundFiles[0].fsPath;
            console.log(`[CodeMind] Found file at: ${absolutePath}`);
          }
          
          const uri = vscode.Uri.file(absolutePath);
          const document = await vscode.workspace.openTextDocument(uri);
          const language = document.languageId;
          const content = document.getText();
          
          // Use workspace-relative path for display
          const relativePath = path.relative(workspaceRoot, absolutePath);
          
          loadedFiles.push({
            path: relativePath,
            content,
            language
          });
          
          console.log(`[CodeMind] Loaded mentioned file: ${relativePath}`);
        } catch (error) {
          console.error(`[CodeMind] Failed to load mentioned file ${mentionedPath}:`, error);
          chatSidebarProvider.addMessage({
            role: 'system',
            content: `⚠️ Could not load @${mentionedPath}: ${error instanceof Error ? error.message : 'File not found'}`
          });
        }
      }
    }

    // Show loaded files if any
    if (loadedFiles.length > 0) {
      chatSidebarProvider.addMessage({
        role: 'system',
        content: `📎 Loaded ${loadedFiles.length} file(s): ${loadedFiles.map(f => f.path).join(', ')}`
      });
    }

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
    
    const workspaceContext = await contextManager.gatherContext(loadedFiles.length > 0 ? loadedFiles : undefined);

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

    // Phase 2.5: Load additional context files identified by analysis
    if (taskAnalysis.requiredContext && taskAnalysis.requiredContext.length > 0) {
      chatSidebarProvider.updateMessage(thinkingId, {
        content: `📂 Loading additional context files identified by analysis...`
      });

      console.log(`[Orchestrator] Analysis identified ${taskAnalysis.requiredContext.length} additional context file(s):`, taskAnalysis.requiredContext);
      
      try {
        const additionalFiles = await contextManager.loadFiles(taskAnalysis.requiredContext);
        
        // Merge with existing mentioned files
        if (!workspaceContext.mentionedFiles) {
          workspaceContext.mentionedFiles = [];
        }
        
        // Add only files that aren't already in mentionedFiles
        const existingPaths = new Set(workspaceContext.mentionedFiles.map(f => f.path));
        for (const file of additionalFiles) {
          if (!existingPaths.has(file.path)) {
            workspaceContext.mentionedFiles.push(file);
            console.log(`[Orchestrator] Added analysis-requested file to context: ${file.path}`);
          }
        }
      } catch (error) {
        console.error(`[Orchestrator] Failed to load analysis-requested context files:`, error);
        // Continue anyway - planning can proceed with available context
      }
    }

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

    // Display plan to user (without filesAffected metadata - no buttons yet!)
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
      content: planSummary
      // No metadata yet - buttons will appear after code generation
    });

    // Phase 3.5: Load required files for code generation
    chatSidebarProvider.updateMessage(planMessageId, {
      content: planSummary + '\n\n📂 Loading required files...'
    });

    // Combine all files that need to be loaded: requiredFiles + affectedFiles for context
    const filesToLoad = [...new Set([
      ...(plan.requiredFiles || []),
      ...plan.affectedFiles.filter(f => {
        // Only load existing files, not ones we're creating or terminal operations
        const step = plan.steps.find(s => s.filePath === f);
        return step?.operation.type !== 'create' && step?.operation.type !== 'terminal';
      })
    ])];

    let contextFiles: Array<{ path: string; content: string; language: string }> = [];
    if (filesToLoad.length > 0) {
      console.log(`[Orchestrator] Loading ${filesToLoad.length} file(s) for context:`, filesToLoad);
      contextFiles = await contextManager.loadFiles(filesToLoad);
      chatSidebarProvider.addMessage({
        role: 'system',
        content: `📎 Loaded ${contextFiles.length} file(s) for context: ${contextFiles.map(f => f.path).join(', ')}`
      });
    }

    // Update workspace context with loaded files
    if (contextFiles.length > 0) {
      workspaceContext.mentionedFiles = [
        ...(workspaceContext.mentionedFiles || []),
        ...contextFiles
      ];
    }

    // Phase 4: Execute plan steps IN ORDER (respecting dependencies)
    console.log(`[Orchestrator] Executing ${plan.steps.length} steps in order...`);
    
    let generationResults: any[] = [];
    const terminalResults: Array<{
      command: string;
      exitCode: number;
      stdout: string;
      stderr: string;
      duration: number;
      timestamp: Date;
    }> = [];
    
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      const stepNum = i + 1;
      
      if (step.operation.type === 'terminal') {
        // TERMINAL OPERATION
        console.log(`[Orchestrator] Step ${stepNum}/${plan.steps.length}: TERMINAL ${step.filePath}`);
        
        chatSidebarProvider.updateMessage(planMessageId, {
          content: planSummary + `\n\n⚡ Step ${stepNum}/${plan.steps.length}: ${step.operation.command}`
        });
        
        if (!terminalManager || !terminalApprovalPanel) {
        console.error('[Orchestrator] ❌ Terminal manager or approval panel not initialized!');
          chatSidebarProvider.addMessage({
            role: 'system',
            content: '❌ Terminal execution unavailable. Please reload the extension.'
          });
          return; // Critical failure - can't proceed without terminal support
        }
        
        console.log(`[Orchestrator] Processing terminal step ${stepNum}/${plan.steps.length}: ${step.filePath}`);
        
        const command = step.operation.command || step.operation.content || '';
        if (!command) {
          console.warn(`[Orchestrator] Terminal step ${step.filePath} has no command, skipping`);
          chatSidebarProvider.addMessage({
            role: 'system',
            content: `⚠️ Skipping terminal operation "${step.filePath}" - no command specified`
          });
          continue;
        }
        
        console.log(`[Orchestrator] Command: ${command}`);
        
        chatSidebarProvider.addMessage({
          role: 'system',
          content: `🖥️ Requesting approval to run: \`${command}\`\n_${step.rationale}_`
        });
        
        // Show terminal approval modal and execute
        if (terminalManager && terminalApprovalPanel) {
          const tm = terminalManager;
          const tap = terminalApprovalPanel;
          
          try {
            const terminalCommand = {
              command,
              cwd: step.operation.workingDirectory || workspaceContext.workspaceRoot,
              reason: step.rationale,
              timeout: 600000 // 10 minutes default timeout
            };
            
            const approved = await tap.requestApproval(terminalCommand);
            
            if (approved) {
              // Mark as running in the approval panel
              tap.markRunning();
              
              const startTime = Date.now();
              const result = await tm.executeCommand(
                terminalCommand,
                (type, line) => {
                  // Stream output to the approval panel in real-time
                  tap.addOutput(type, line);
                }
              );
              
              const duration = Date.now() - startTime;
              tap.markComplete(result.exitCode || 0, duration);
              
              // Store terminal output in workspace context for model feedback
              const terminalOutput = {
                command,
                exitCode: result.exitCode || 0,
                stdout: result.stdout.join('\n'),
                stderr: result.stderr.join('\n'),
                duration,
                timestamp: new Date().toISOString()
              };
              
              // Add to context for future operations to see
              if (!workspaceContext.terminalResults) {
                (workspaceContext as any).terminalResults = [];
              }
              (workspaceContext as any).terminalResults.push(terminalOutput);
              
              if (result.exitCode === 0) {
                chatSidebarProvider.addMessage({
                  role: 'system',
                  content: `✅ Command completed successfully: \`${command}\`\n` +
                           `⏱️ Duration: ${(duration / 1000).toFixed(1)}s`
                });
                console.log(`[Orchestrator] ✅ Terminal command succeeded:`, command);
              } else {
                const errorOutput = result.stderr.length > 0 
                  ? result.stderr.join('\n')
                  : result.stdout.slice(-10).join('\n');
                  
                chatSidebarProvider.addMessage({
                  role: 'system',
                  content: `❌ Command failed with exit code ${result.exitCode}: \`${command}\`\n\`\`\`\n${errorOutput}\n\`\`\`\n\n💡 The model can see this error and will adjust future operations accordingly.`
                });
                console.error(`[Orchestrator] ❌ Terminal command failed (exit ${result.exitCode}):`, command);
                console.error(`[Orchestrator] stderr:`, result.stderr.join('\n'));
                
                // Mark that we have failures for post-execution analysis
                if (!workspaceContext.hasTerminalFailures) {
                  (workspaceContext as any).hasTerminalFailures = true;
                }
              }
            } else {
              chatSidebarProvider.addMessage({
                role: 'system',
                content: `⏭️ User declined to run: \`${command}\``
              });
            }
          } catch (error) {
            console.error(`[Orchestrator] Terminal command failed:`, error);
            chatSidebarProvider.addMessage({
              role: 'system',
              content: `❌ Error executing command: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
            
            tap.markComplete(-1, 0);
          }
        } else {
          console.warn('[Orchestrator] Terminal manager or approval panel not available');
          chatSidebarProvider.addMessage({
            role: 'system',
            content: `⚠️ Cannot execute terminal command - terminal system not initialized`
          });
        }
      } else {
        // ========== FILE OPERATION ==========
        console.log(`[Orchestrator] Step ${stepNum}/${plan.steps.length}: ${step.operation.type.toUpperCase()} ${step.filePath}`);
        
        chatSidebarProvider.updateMessage(planMessageId, {
          content: planSummary + `\n\n🔧 Step ${stepNum}/${plan.steps.length}: Generating ${step.filePath}...`
        });
        
        try {
          // Create a single-file plan for this step
          const singleFilePlan = {
            ...plan,
            steps: [step],
            affectedFiles: [step.filePath]
          };
          
          const fileResults = await codeGenerator.generateCode(
            singleFilePlan,
            userRequest,
            (event) => {
              chatSidebarProvider?.updateMessage(planMessageId, {
                content: planSummary + `\n\n🔧 Step ${stepNum}/${plan.steps.length}: ${event.status}`
              });
            },
            true,  // applyImmediately
            contextFiles
          );
          
          generationResults.push(...fileResults);
          console.log(`[Orchestrator] ✅ Generated ${step.filePath}`);
          
          chatSidebarProvider.updateMessage(planMessageId, {
            content: planSummary + `\n\n✅ Step ${stepNum}/${plan.steps.length}: ${step.filePath} complete`
          });
        } catch (error) {
          console.error(`[Orchestrator] ❌ Failed to generate ${step.filePath}:`, error);
          chatSidebarProvider.addMessage({
            role: 'system',
            content: `❌ Failed to generate ${step.filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      }
    }
    
    // Phase 4 Complete: Verify terminal results and offer retry if needed
    const allTerminalResults = (workspaceContext as any).terminalResults || [];
    const failedCommands = allTerminalResults.filter((r: any) => r.exitCode !== 0);
      
    if (failedCommands.length > 0) {
      console.log(`[Orchestrator] Detected ${failedCommands.length} failed terminal command(s)`);
      
      const retryMessageId = chatSidebarProvider.addMessage({
        role: 'system',
        content: `⚠️ **${failedCommands.length} terminal command(s) failed.**\n\n` +
                 `The Orchestrator can analyze the errors and suggest fixes.\n\n` +
                 `Failed commands:\n${failedCommands.map((c: any) => `- \`${c.command}\` (exit code ${c.exitCode})`).join('\n')}\n\n` +
                 `Would you like me to analyze the errors and attempt to fix them?`,
        metadata: {
          retryData: {
            originalRequest: userRequest,
            originalPlan: plan,
            terminalResults: allTerminalResults,
            workspaceContext,
            planMessageId
          }
        }
      });
      
      // Interactive retry will be triggered by user clicking button
      console.log(`[Orchestrator] Waiting for user decision on terminal retry (message: ${retryMessageId})...`);
    } else if (allTerminalResults.length > 0) {
      console.log(`[Orchestrator] All ${allTerminalResults.length} terminal command(s) succeeded`);
      chatSidebarProvider.addMessage({
        role: 'system',
        content: `✅ All terminal commands completed successfully!`
      });
    }

    // Update plan with generated content
    for (let i = 0; i < generationResults.length; i++) {
      const result = generationResults[i];
      if (result.converged && plan.steps[i]) {
        plan.steps[i].operation.content = result.generatedContent;
      }
    }

    // Show results with proper metadata for approval
    const avgQuality = generationResults.reduce((sum, r) => sum + r.quality, 0) / generationResults.length;
    const failedFiles = generationResults.filter(r => !r.converged);

    let resultSummary = planSummary + '\n\n## 🎉 Code Generation Complete\n\n';
    resultSummary += `✅ Generated ${generationResults.length} file(s)\n`;
    resultSummary += `📊 Average Quality: ${(avgQuality * 10).toFixed(1)}/10\n`;
    resultSummary += `⏱️ Total Time: ${Math.round((Date.now() - chatSidebarProvider.getCurrentSession().messages.find(m => m.id === planMessageId)!.timestamp) / 1000)}s\n`;
    
    if (failedFiles.length > 0) {
      resultSummary += `\n⚠️ Failed to generate ${failedFiles.length} file(s):\n`;
      failedFiles.forEach(f => {
        resultSummary += `- ${f.filePath}\n`;
      });
    }

    resultSummary += `\n### 📝 Generated Files:\n`;
    generationResults.filter(r => r.converged).forEach(r => {
      resultSummary += `- **${r.filePath}** (${(r.quality * 10).toFixed(1)}/10, ${r.iterations} iterations)\n`;
    });

    resultSummary += `\n**Ready to apply changes?**\n`;
    resultSummary += `These ${generationResults.filter(r => r.converged).length} files are ready to be written to your workspace.`;

    // Store the plan and results for later use when applying
    const sessionData = {
      plan,
      generationResults,
      timestamp: Date.now()
    };

    chatSidebarProvider.updateMessage(planMessageId, {
      content: resultSummary,
      metadata: {
        filesAffected: plan.affectedFiles,
        operationType: plan.taskType,
        quality: avgQuality,
        rollbackId: undefined, // TODO: Create git worktree snapshot
        sessionData // Store for apply/reject handlers
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
    
    if (!message || !message.metadata?.filesAffected || !message.metadata?.sessionData) {
      vscode.window.showWarningMessage('CodeMind: No changes to apply');
      return;
    }

    const { plan, generationResults } = message.metadata.sessionData as any;
    
    // Check if files were already applied immediately
    const appliedImmediately = generationResults.every((r: any) => r.appliedImmediately);
    
    if (appliedImmediately) {
      // Files already written - this is an ACCEPT
      chatSidebarProvider.addMessage({
        role: 'system',
        content: `✅ Changes accepted! ${generationResults.length} file(s) have been saved to disk.`
      });
      
      vscode.window.showInformationMessage(`CodeMind: Changes accepted (${generationResults.length} files)`);
      return;
    }

    // Files not applied yet - show confirmation and apply now
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

    // Add progress message
    const progressMsgId = chatSidebarProvider.addMessage({
      role: 'system',
      content: '⏳ Applying changes...'
    });

    // Build file operations with generated content
    // Convert workspace-relative paths to absolute paths
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    const path = require('path');
    
    const operations = (generationResults as any[])
      .filter((r: any) => r.converged && r.generatedContent)
      .map((r: any) => {
        // Convert relative path to absolute
        const absolutePath = path.isAbsolute(r.operation.filePath)
          ? r.operation.filePath
          : path.join(workspaceRoot, r.operation.filePath);
        
        return {
          ...r.operation,
          filePath: absolutePath,
          newPath: r.operation.newPath ? path.join(workspaceRoot, r.operation.newPath) : undefined,
          content: r.generatedContent
        };
      });

    if (operations.length === 0) {
      chatSidebarProvider.updateMessage(progressMsgId, {
        content: '⚠️ No valid operations to apply'
      });
      return;
    }

    // Execute as atomic transaction
    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    try {
      fileManager.beginTransaction(operations);
      
      const results = await fileManager.executeTransaction((current, total, op) => {
        chatSidebarProvider?.updateMessage(progressMsgId, {
          content: `⏳ Applying changes... (${current}/${total})\n\nCurrent: ${op.type} ${op.filePath}`
        });
      });

      // Count successes and failures
      results.forEach((r: any) => {
        if (r.success) {
          successCount++;
          console.log(`[CodeMind] ✅ Applied ${r.operation.type}: ${r.operation.filePath}`);
        } else {
          failCount++;
          errors.push(`${r.operation.filePath}: ${r.error}`);
          console.error(`[CodeMind] ❌ Failed ${r.operation.filePath}:`, r.error);
        }
      });
    } catch (error: any) {
      // Transaction failed and was rolled back
      failCount = operations.length;
      errors.push(`Transaction failed: ${error.message}`);
      console.error('[CodeMind] Transaction failed:', error);
    }

    // Update progress message with results
    let resultContent = '';
    if (successCount > 0) {
      resultContent += `✅ Successfully applied changes to ${successCount} file(s)\n\n`;
      (generationResults as any[])
        .filter((r: any) => r.converged && r.generatedContent)
        .forEach((r: any) => {
          resultContent += `  ✓ ${r.operation.type.toUpperCase()}: ${r.filePath}\n`;
        });
    }
    
    if (failCount > 0) {
      resultContent += `\n⚠️ Failed to apply ${failCount} file(s):\n`;
      errors.forEach(err => {
        resultContent += `  ✗ ${err}\n`;
      });
    }

    chatSidebarProvider.updateMessage(progressMsgId, {
      content: resultContent
    });

    if (successCount > 0) {
      vscode.window.showInformationMessage(
        `CodeMind: Successfully applied changes to ${successCount} file(s)!`
      );
    }
    
    if (failCount > 0) {
      vscode.window.showWarningMessage(
        `CodeMind: ${failCount} file(s) failed to apply. Check the chat for details.`
      );
    }

  } catch (error: any) {
    console.error('[CodeMind] Error applying changes:', error);
    chatSidebarProvider?.addMessage({
      role: 'system',
      content: `❌ Error applying changes: ${error.message}`
    });
    vscode.window.showErrorMessage(`CodeMind: Failed to apply changes: ${error.message}`);
  }
}

/**
 * Handle reject changes request
 * If files were applied immediately: ROLLBACK (delete created files, restore backups)
 * If files were not applied: just confirm rejection (nothing to undo)
 */
async function handleRejectChanges(messageId: string) {
  if (!chatSidebarProvider) {
    return;
  }

  try {
    const session = chatSidebarProvider.getCurrentSession();
    const message = session.messages.find(m => m.id === messageId);
    
    if (!message || !message.metadata?.sessionData) {
      chatSidebarProvider.addMessage({
        role: 'system',
        content: '❌ Changes rejected. No changes were made.'
      });
      return;
    }

    const { generationResults } = message.metadata.sessionData as any;
    
    // Check if files were already applied immediately
    const appliedImmediately = generationResults.some((r: any) => r.appliedImmediately);
    
    if (!appliedImmediately) {
      // Files never written - simple rejection
      chatSidebarProvider.addMessage({
        role: 'system',
        content: '❌ Changes rejected. The proposed changes will not be applied.'
      });
      vscode.window.showInformationMessage('CodeMind: Changes rejected');
      return;
    }

    // Files were written - need to rollback
    const confirmation = await vscode.window.showWarningMessage(
      `Rollback changes to ${generationResults.length} file(s)? This will delete created files and restore backups.`,
      { modal: true },
      'Rollback', 'Keep Changes'
    );

    if (confirmation !== 'Rollback') {
      chatSidebarProvider.addMessage({
        role: 'system',
        content: '✅ Rollback cancelled. Changes will be kept.'
      });
      return;
    }

    // Perform rollback
    const fs = require('fs').promises;
    const path = require('path');
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    
    let deleted = 0;
    let restored = 0;
    
    for (const result of generationResults) {
      if (!result.appliedImmediately) continue;
      
      const absolutePath = path.isAbsolute(result.filePath)
        ? result.filePath
        : path.join(workspaceRoot, result.filePath);
      
      try {
        if (result.backupContent !== undefined) {
          // File existed before - restore backup
          await fs.writeFile(absolutePath, result.backupContent, 'utf8');
          restored++;
          console.log(`[CodeMind] Restored: ${result.filePath}`);
        } else {
          // File was newly created - delete it
          await fs.unlink(absolutePath);
          deleted++;
          console.log(`[CodeMind] Deleted: ${result.filePath}`);
        }
      } catch (error: any) {
        console.error(`[CodeMind] Rollback failed for ${result.filePath}:`, error);
      }
    }
    
    chatSidebarProvider.addMessage({
      role: 'system',
      content: `🔄 Rollback complete!\n- Deleted ${deleted} new file(s)\n- Restored ${restored} modified file(s)`
    });
    
    vscode.window.showInformationMessage(`CodeMind: Rolled back changes (${deleted} deleted, ${restored} restored)`);
    
  } catch (error: any) {
    console.error('[CodeMind] Rollback failed:', error);
    chatSidebarProvider.addMessage({
      role: 'system',
      content: `❌ Rollback failed: ${error.message}`
    });
    vscode.window.showErrorMessage(`CodeMind: Rollback failed - ${error.message}`);
  }
}

/**
 * Handle terminal retry request
 * Analyze failed terminal commands and execute recovery plan
 */
async function handleTerminalRetry(messageId: string) {
  if (!chatSidebarProvider || !orchestratorAgent || !contextManager || !codeGenerator || !terminalManager || !terminalApprovalPanel) {
    vscode.window.showErrorMessage('CodeMind: System not initialized');
    return;
  }

  try {
    // Get the retry data from the message metadata
    const message = chatSidebarProvider.getCurrentSession().messages.find(m => m.id === messageId);
    if (!message || !message.metadata?.retryData) {
      vscode.window.showErrorMessage('CodeMind: Retry data not found');
      return;
    }

    const { originalRequest, originalPlan, terminalResults, workspaceContext, planMessageId } = message.metadata.retryData;

    // Update message to show we're analyzing
    chatSidebarProvider.updateMessage(messageId, {
      content: message.content + '\n\n🔄 Analyzing failures and creating recovery plan...'
    });

    console.log('[Orchestrator] Starting terminal failure analysis...');

    // Analyze failures and get recovery plan
    const analysis = await orchestratorAgent.analyzeTerminalFailures(
      originalRequest,
      originalPlan,
      terminalResults,
      workspaceContext,
      (event) => {
        chatSidebarProvider?.updateMessage(messageId, {
          content: message.content + `\n\n🔄 ${event.status} (${event.progress}%)`
        });
      }
    );

    console.log('[Orchestrator] Analysis complete:', analysis);

    if (!analysis.needsRetry) {
      chatSidebarProvider.updateMessage(messageId, {
        content: message.content + `\n\n✅ Analysis complete:\n${analysis.analysis}\n\n_No retry needed - failures are not recoverable._`
      });
      return;
    }

    // Show analysis results
    const analysisMessageId = chatSidebarProvider.addMessage({
      role: 'assistant',
      content: `## 🔍 Terminal Failure Analysis\n\n${analysis.analysis}\n\n` +
               (analysis.recoveryPlan ? 
                 `I've created a recovery plan to fix these issues.\n\n` +
                 `### Recovery Plan:\n**${analysis.recoveryPlan.summary}**\n\n` +
                 `Steps:\n${analysis.recoveryPlan.steps.map((s, i) => `${i + 1}. ${s.operation.type.toUpperCase()}: ${s.filePath} - ${s.rationale}`).join('\n')}` :
                 `_These failures cannot be automatically recovered. Manual intervention required._`)
    });

    chatSidebarProvider.updateMessage(messageId, {
      content: message.content + '\n\n✅ Analysis complete. See details below.'
    });

    if (analysis.recoveryPlan) {
      // Execute the recovery plan immediately
      chatSidebarProvider.addMessage({
        role: 'system',
        content: '🔄 Executing recovery plan...'
      });

      console.log('[Orchestrator] Executing recovery plan:', analysis.recoveryPlan);

      // Load required files for recovery
      const recoveryContextFiles = await contextManager!.loadFiles(analysis.recoveryPlan.requiredFiles);
      
      // Update workspace context with loaded files
      if (recoveryContextFiles.length > 0) {
        workspaceContext.mentionedFiles = [
          ...(workspaceContext.mentionedFiles || []),
          ...recoveryContextFiles
        ];
      }

      // Clear terminal results for fresh execution
      (workspaceContext as any).terminalResults = [];
      (workspaceContext as any).hasTerminalFailures = false;

      // Execute file operations (if any)
      const recoveryFileSteps = analysis.recoveryPlan.steps.filter(s => s.operation.type !== 'terminal');
      const recoveryTerminalSteps = analysis.recoveryPlan.steps.filter(s => s.operation.type === 'terminal');

      if (recoveryFileSteps.length > 0) {
        const recoveryFilePlan = { ...analysis.recoveryPlan, steps: recoveryFileSteps };
        
        try {
          const recoveryResults = await codeGenerator!.generateCode(
            recoveryFilePlan,
            `Recovery: ${analysis.analysis}`,
            (event) => {
              chatSidebarProvider?.updateMessage(analysisMessageId, {
                content: chatSidebarProvider.getCurrentSession().messages.find(m => m.id === analysisMessageId)!.content + 
                         `\n\n${event.status} (${event.progress}%)`
              });
            },
            true, // Apply immediately
            recoveryContextFiles
          );

          const successCount = recoveryResults.filter(r => r.converged).length;
          chatSidebarProvider.addMessage({
            role: 'system',
            content: `✅ Recovery file operations complete: ${successCount}/${recoveryResults.length} successful`
          });
        } catch (error) {
          console.error('[Orchestrator] Recovery file generation failed:', error);
          chatSidebarProvider.addMessage({
            role: 'system',
            content: `❌ Recovery file generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
          return; // Don't proceed to terminal operations if files failed
        }
      }

      // Execute terminal operations (if any)
      if (recoveryTerminalSteps.length > 0 && terminalManager && terminalApprovalPanel) {
        chatSidebarProvider.addMessage({
          role: 'system',
          content: '⚡ Executing recovery terminal commands...'
        });

        for (let i = 0; i < recoveryTerminalSteps.length; i++) {
          const step = recoveryTerminalSteps[i];
          const command = step.operation.command || '';
          
          if (!command) {
            console.warn(`[Orchestrator] Recovery terminal step ${step.filePath} has no command`);
            continue;
          }

          const terminalCommand = {
            command,
            cwd: step.operation.workingDirectory || workspaceContext.workspaceRoot,
            reason: `Recovery: ${step.rationale}`,
            timeout: 600000
          };

          const approved = await terminalApprovalPanel!.requestApproval(terminalCommand);
          
          if (approved) {
            terminalApprovalPanel!.markRunning();
            const startTime = Date.now();
            const result = await terminalManager!.executeCommand(
              terminalCommand,
              (type, line) => terminalApprovalPanel!.addOutput(type, line)
            );
            
            const duration = Date.now() - startTime;
            terminalApprovalPanel!.markComplete(result.exitCode || 0, duration);

            if (result.exitCode === 0) {
              chatSidebarProvider.addMessage({
                role: 'system',
                content: `✅ Recovery command succeeded: \`${command}\``
              });
            } else {
              chatSidebarProvider.addMessage({
                role: 'system',
                content: `❌ Recovery command failed: \`${command}\` (exit ${result.exitCode})\n\nThe issue may require manual intervention.`
              });
              // Don't retry again to avoid infinite loop
              return;
            }
          } else {
            chatSidebarProvider.addMessage({
              role: 'system',
              content: `⏭️ User declined recovery command: \`${command}\``
            });
            return;
          }
        }

        chatSidebarProvider.addMessage({
          role: 'system',
          content: '🎉 Recovery complete! All operations succeeded.'
        });
      }
    }


  } catch (error: any) {
    console.error('[Orchestrator] Terminal retry failed:', error);
    chatSidebarProvider?.addMessage({
      role: 'system',
      content: `❌ Error during retry analysis: ${error.message}`
    });
    vscode.window.showErrorMessage(`CodeMind: Terminal retry failed - ${error.message}`);
  }
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
