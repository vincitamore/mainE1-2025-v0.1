/**
 * Results Panel - Modern UI for displaying code generation results
 * Shows diff, accept/reject buttons, and access to analysis
 */

import * as vscode from 'vscode';
import { N2Result } from '../synthesis';
import { InlineDiffViewer } from './inline-diff';

export class ResultsPanelProvider {
  private static currentPanel: vscode.WebviewPanel | undefined;
  private static readonly viewType = 'codeMindResults';
  private static pendingResult: {
    result: N2Result;
    originalCode: string;
    documentUri: vscode.Uri;
    selectionRange: vscode.Range;
    language: string;
  } | undefined;

  /**
   * Show results panel with diff and action buttons
   */
  public static show(
    extensionUri: vscode.Uri,
    result: N2Result,
    originalCode: string,
    editor: vscode.TextEditor,
    selection: vscode.Selection,
    context: vscode.ExtensionContext
  ): void {
    const column = vscode.ViewColumn.Beside;

    // Store pending result for accept/reject actions
    const docUri = editor.document.uri;
    console.log('[CodeMind] Storing document URI:', docUri.toString());
    console.log('[CodeMind] Document scheme:', docUri.scheme);
    console.log('[CodeMind] Document path:', docUri.fsPath);
    console.log('[CodeMind] Selection range:', selection.start.line, selection.start.character, '->', selection.end.line, selection.end.character);
    
    ResultsPanelProvider.pendingResult = {
      result,
      originalCode,
      documentUri: docUri,
      selectionRange: new vscode.Range(selection.start, selection.end),
      language: editor.document.languageId
    };

    // If panel already exists, reveal and update it
    if (ResultsPanelProvider.currentPanel) {
      ResultsPanelProvider.currentPanel.reveal(column);
      ResultsPanelProvider.currentPanel.webview.html = this.getWebviewContent(
        ResultsPanelProvider.currentPanel.webview,
        extensionUri,
        result,
        originalCode
      );
      return;
    }

    // Create new panel
    const panel = vscode.window.createWebviewPanel(
      ResultsPanelProvider.viewType,
      `CodeMind: Results (${result.qualityScore.toFixed(1)}/10)`,
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri]
      }
    );

    ResultsPanelProvider.currentPanel = panel;

    // Set content
    panel.webview.html = this.getWebviewContent(panel.webview, extensionUri, result, originalCode);

    // Handle panel disposal
    panel.onDidDispose(() => {
      ResultsPanelProvider.currentPanel = undefined;
      ResultsPanelProvider.pendingResult = undefined;
    });

    // Handle messages from webview
    panel.webview.onDidReceiveMessage(
      async message => {
        switch (message.command) {
          case 'accept':
            await this.acceptChanges(context);
            break;
          case 'reject':
            this.rejectChanges();
            break;
          case 'viewAnalysis':
            // Update the sidebar with analysis
            const { getAnalysisSidebarProvider } = await import('../extension');
            const sidebar = getAnalysisSidebarProvider();
            if (sidebar) {
              sidebar.updateAnalysis(result);
              // Show the CodeMind sidebar
              vscode.commands.executeCommand('workbench.view.extension.codemind-sidebar');
            }
            break;
          case 'viewDiff':
            await this.showInlineDiff(context);
            break;
          case 'copy':
            vscode.env.clipboard.writeText(message.text);
            vscode.window.showInformationMessage('Copied to clipboard');
            break;
        }
      },
      undefined,
      context.subscriptions
    );
  }

  /**
   * Accept changes and apply to editor
   */
  private static async acceptChanges(context: vscode.ExtensionContext): Promise<void> {
    if (!ResultsPanelProvider.pendingResult) {
      vscode.window.showErrorMessage('No pending changes to apply');
      return;
    }

    const { result, documentUri, selectionRange } = ResultsPanelProvider.pendingResult;

    try {
      console.log('[CodeMind] Applying changes to:', documentUri.toString());
      console.log('[CodeMind] Selection range:', selectionRange);
      console.log('[CodeMind] New code length:', result.finalCode.length);

      // Ensure we're working with the actual file URI (not temp/untitled)
      if (documentUri.scheme === 'untitled' || documentUri.path.includes('vscode-userdata')) {
        vscode.window.showErrorMessage('Cannot apply changes to temporary document. Please save your file first.');
        return;
      }

      // Open the document
      const document = await vscode.workspace.openTextDocument(documentUri);
      console.log('[CodeMind] Opened document:', document.uri.toString());
      console.log('[CodeMind] Document has', document.lineCount, 'lines');

      // Show the document in editor
      const editor = await vscode.window.showTextDocument(document, {
        viewColumn: vscode.ViewColumn.One,
        preserveFocus: false,
        preview: false
      });

      // Wait for editor to be fully ready
      await new Promise(resolve => setTimeout(resolve, 200));

      console.log('[CodeMind] Applying edit...');

      // Apply the edit using WorkspaceEdit
      const edit = new vscode.WorkspaceEdit();
      edit.replace(documentUri, selectionRange, result.finalCode);
      
      const success = await vscode.workspace.applyEdit(edit);

      console.log('[CodeMind] Edit applied:', success);

      if (success) {
        // Save the document
        const saved = await document.save();
        console.log('[CodeMind] Document saved:', saved);

        vscode.window.showInformationMessage(
          `✓ Changes applied and saved! Quality: ${result.qualityScore.toFixed(1)}/10`
        );
        
        // Close the results panel
        ResultsPanelProvider.currentPanel?.dispose();
      } else {
        vscode.window.showErrorMessage('Failed to apply changes - edit was not accepted');
        console.error('[CodeMind] WorkspaceEdit.applyEdit returned false');
      }
    } catch (error: any) {
      vscode.window.showErrorMessage(`Failed to apply changes: ${error.message}`);
      console.error('[CodeMind] Accept changes error:', error);
      console.error('[CodeMind] Stack:', error.stack);
    }
  }

  /**
   * Reject changes and close panel
   */
  private static rejectChanges(): void {
    vscode.window.showInformationMessage('Changes rejected');
    ResultsPanelProvider.currentPanel?.dispose();
  }

  /**
   * Show native VSCode diff view in main editor column
   */
  /**
   * Show inline diff in the original editor with decorations
   */
  private static async showInlineDiff(context: vscode.ExtensionContext): Promise<void> {
    if (!ResultsPanelProvider.pendingResult) {
      vscode.window.showErrorMessage('No pending changes to preview');
      return;
    }

    const { result, originalCode, documentUri, selectionRange } = ResultsPanelProvider.pendingResult;

    try {
      // Open the original document
      const document = await vscode.workspace.openTextDocument(documentUri);
      const editor = await vscode.window.showTextDocument(document, {
        viewColumn: vscode.ViewColumn.One,
        preserveFocus: false,
        preview: false
      });

      // Wait for editor to be ready
      await new Promise(resolve => setTimeout(resolve, 150));

      // Set quality score for display
      InlineDiffViewer.setQualityScore(result.qualityScore);

      // Show inline diff with interactive buttons
      await InlineDiffViewer.showInlineDiffWithButtons(
        editor,
        selectionRange,
        originalCode,
        result.finalCode,
        result.qualityScore,
        async () => {
          // On accept
          vscode.window.showInformationMessage(
            `✓ Changes accepted and saved! Quality: ${result.qualityScore.toFixed(1)}/10`
          );
          ResultsPanelProvider.currentPanel?.dispose();
        },
        async () => {
          // On reject
          vscode.window.showInformationMessage('Changes rejected.');
          ResultsPanelProvider.currentPanel?.dispose();
        }
      );

    } catch (error: any) {
      vscode.window.showErrorMessage(`Failed to show inline diff: ${error.message}`);
      console.error('[CodeMind] Inline diff error:', error);
    }
  }

  private static async showNativeDiff(
    originalCode: string,
    result: N2Result,
    language: string
  ): Promise<void> {
    // Create temporary documents for diff view
    const originalDoc = await vscode.workspace.openTextDocument({
      content: originalCode,
      language: language
    });
    
    const modifiedDoc = await vscode.workspace.openTextDocument({
      content: result.finalCode,
      language: language
    });
    
    // Show diff in the main editor column
    await vscode.commands.executeCommand(
      'vscode.diff',
      originalDoc.uri,
      modifiedDoc.uri,
      `CodeMind: Changes (Quality: ${result.qualityScore.toFixed(1)}/10)`,
      { 
        preview: false,
        viewColumn: vscode.ViewColumn.One
      }
    );
  }

  /**
   * Get line count of code
   */
  private static getLineCount(code: string): number {
    return code.split('\n').length;
  }

  /**
   * Generate HTML content for the webview
   */
  private static getWebviewContent(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
    result: N2Result,
    originalCode: string
  ): string {
    const qualityLevel = this.getQualityLevel(result.qualityScore);
    const qualityColor = this.getQualityColor(qualityLevel);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CodeMind Results</title>
  <style>
    ${this.getStyles()}
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="header-left">
        <h1>CodeMind Results</h1>
        <div class="quality-badge" style="background: ${qualityColor}">
          ${result.qualityScore.toFixed(1)}/10
        </div>
      </div>
      <div class="header-stats">
        <div class="stat">
          <span class="stat-label">Iterations</span>
          <span class="stat-value">${result.iterations.length}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Time</span>
          <span class="stat-value">${(result.totalTime / 1000).toFixed(1)}s</span>
        </div>
      </div>
    </div>

    <!-- Explanation -->
    <div class="explanation-card">
      <div class="card-header">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 16v-4"></path>
          <path d="M12 8h.01"></path>
        </svg>
        <h2>What Changed</h2>
      </div>
      <p>${result.explanation}</p>
    </div>

    <!-- Code Summary -->
    <div class="code-summary">
      <h2>Code Preview</h2>
      <div class="summary-stats">
        <div class="stat-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
          </svg>
          <span>${this.getLineCount(originalCode)} → ${this.getLineCount(result.finalCode)} lines</span>
        </div>
        <div class="stat-item">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="16 18 22 12 16 6"></polyline>
            <polyline points="8 6 2 12 8 18"></polyline>
          </svg>
          <span>${result.finalCode.length - originalCode.length} characters changed</span>
        </div>
      </div>
      <p class="summary-hint">Click "Preview Inline" to see changes directly in your editor</p>
    </div>

    <!-- Key Decisions -->
    ${Object.keys(result.keyDecisions).length > 0 ? `
    <div class="decisions-section">
      <h2>Key Decisions</h2>
      <div class="decisions-grid">
        ${Object.entries(result.keyDecisions).map(([key, value]) => `
          <div class="decision-card">
            <div class="decision-icon">
              ${this.getDecisionIcon(key)}
            </div>
            <div class="decision-content">
              <div class="decision-title">${this.capitalize(key)}</div>
              <div class="decision-text">${value || 'No specific decisions'}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
    ` : ''}

    <!-- Action Buttons -->
    <div class="action-bar">
      <div class="action-buttons-left">
        <button class="btn btn-secondary" onclick="viewDiff()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"></path>
            <circle cx="12" cy="12" r="3"></circle>
          </svg>
          Preview Inline
        </button>
        <button class="btn btn-secondary" onclick="viewAnalysis()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
          </svg>
          View Analysis
        </button>
      </div>
      <div class="action-buttons">
        <button class="btn btn-reject" onclick="reject()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
          Reject
        </button>
        <button class="btn btn-accept" onclick="accept()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          Accept Changes
        </button>
      </div>
    </div>
  </div>

  <script>
    ${this.getScripts()}
  </script>
</body>
</html>`;
  }

  private static getQualityLevel(score: number): string {
    if (score >= 9) return 'excellent';
    if (score >= 8) return 'good';
    if (score >= 7) return 'fair';
    return 'poor';
  }

  private static getQualityColor(level: string): string {
    switch (level) {
      case 'excellent': return '#10b981';
      case 'good': return '#3b82f6';
      case 'fair': return '#f59e0b';
      default: return '#ef4444';
    }
  }

  private static getDecisionIcon(key: string): string {
    const icons: Record<string, string> = {
      architecture: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 4v16"/><path d="M15 4v16"/></svg>',
      security: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
      performance: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>',
      testing: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
      documentation: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>'
    };
    return icons[key] || icons.architecture;
  }

  private static capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private static escapeHtml(text: string): string {
    const div = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, (m) => div[m as keyof typeof div]);
  }

  private static getStyles(): string {
    return `
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  color: var(--vscode-foreground);
  background: var(--vscode-editor-background);
  line-height: 1.6;
}

.container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 32px;
}

/* Header */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 2px solid var(--vscode-panel-border);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

h1 {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.quality-badge {
  font-size: 18px;
  font-weight: 700;
  padding: 8px 16px;
  border-radius: 8px;
  color: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.header-stats {
  display: flex;
  gap: 24px;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.stat-label {
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
}

/* Cards */
.explanation-card, .decision-card {
  background: var(--vscode-editor-inactiveSelectionBackground);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.card-header h2 {
  font-size: 18px;
  font-weight: 600;
}

.card-header svg {
  color: var(--vscode-focusBorder);
}

.explanation-card p {
  color: var(--vscode-descriptionForeground);
  line-height: 1.7;
}

/* Code Summary */
.code-summary {
  margin-bottom: 24px;
}

.code-summary h2 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
}

.summary-stats {
  display: flex;
  gap: 24px;
  margin-bottom: 12px;
  padding: 16px;
  background: var(--vscode-editor-inactiveSelectionBackground);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 8px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.stat-item svg {
  color: var(--vscode-focusBorder);
}

.summary-hint {
  font-size: 13px;
  color: var(--vscode-descriptionForeground);
  font-style: italic;
}

/* Decisions Grid */
.decisions-section {
  margin-bottom: 32px;
}

.decisions-section h2 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
}

.decisions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
}

.decision-card {
  display: flex;
  gap: 16px;
  padding: 16px;
}

.decision-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  background: var(--vscode-focusBorder);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.decision-content {
  flex: 1;
  min-width: 0;
}

.decision-title {
  font-weight: 600;
  margin-bottom: 4px;
}

.decision-text {
  font-size: 14px;
  color: var(--vscode-descriptionForeground);
  line-height: 1.5;
}

/* Action Bar */
.action-bar {
  position: sticky;
  bottom: 0;
  background: var(--vscode-editor-background);
  padding: 24px 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 2px solid var(--vscode-panel-border);
  gap: 16px;
}

.action-buttons-left {
  display: flex;
  gap: 12px;
}

.action-buttons {
  display: flex;
  gap: 12px;
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.btn:active {
  transform: translateY(0);
}

.btn-accept {
  background: #10b981;
  color: white;
}

.btn-accept:hover {
  background: #059669;
}

.btn-reject {
  background: var(--vscode-editor-inactiveSelectionBackground);
  color: var(--vscode-foreground);
  border: 1px solid var(--vscode-panel-border);
}

.btn-reject:hover {
  background: var(--vscode-list-hoverBackground);
}

.btn-secondary {
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
}

.btn-secondary:hover {
  background: var(--vscode-button-secondaryHoverBackground);
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

::-webkit-scrollbar-track {
  background: var(--vscode-editor-background);
}

::-webkit-scrollbar-thumb {
  background: var(--vscode-scrollbarSlider-background);
  border-radius: 5px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--vscode-scrollbarSlider-hoverBackground);
}
`;
  }

  private static getScripts(): string {
    return `
const vscode = acquireVsCodeApi();

function accept() {
  vscode.postMessage({ command: 'accept' });
}

function reject() {
  vscode.postMessage({ command: 'reject' });
}

function viewAnalysis() {
  vscode.postMessage({ command: 'viewAnalysis' });
}

function viewDiff() {
  vscode.postMessage({ command: 'viewDiff' });
}
`;
  }
}

