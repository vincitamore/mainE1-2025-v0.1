/**
 * Analysis Sidebar - Proper sidebar view for displaying agent analysis
 * Shows in dedicated CodeMind sidebar panel
 */

import * as vscode from 'vscode';
import { N2Result } from '../synthesis';
import { AgentAnalysis } from '../agents/agent';

export class AnalysisSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'codemind.analysisView';
  private _view?: vscode.WebviewView;
  private _currentResult?: N2Result;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    if (this._currentResult) {
      webviewView.webview.html = this._getHtmlForWebview(webviewView.webview, this._currentResult);
    } else {
      webviewView.webview.html = this._getWelcomeHtml(webviewView.webview);
    }

    webviewView.webview.onDidReceiveMessage(data => {
      switch (data.command) {
        case 'jumpToLine':
          this._jumpToLine(data.line);
          break;
      }
    });
  }

  /**
   * Update the sidebar with new analysis results
   */
  public updateAnalysis(result: N2Result) {
    this._currentResult = result;
    if (this._view) {
      this._view.webview.html = this._getHtmlForWebview(this._view.webview, result);
      this._view.show?.(true); // Show the sidebar
    }
  }

  /**
   * Jump to a specific line in the active editor
   */
  private _jumpToLine(line: number): void {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const position = new vscode.Position(line - 1, 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(new vscode.Range(position, position));
      vscode.window.showTextDocument(editor.document);
    }
  }

  /**
   * Welcome screen when no analysis yet
   */
  private _getWelcomeHtml(webview: vscode.Webview): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CodeMind Analysis</title>
  <style>${this._getStyles()}</style>
</head>
<body>
  <div class="welcome-container">
    <div class="welcome-icon">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 1.74.63 3.34 1.67 4.58L5.5 15.5C5.19 15.81 5 16.21 5 16.67V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2.33c0-.46-.19-.86-.5-1.17l-1.17-1.92C18.37 12.34 19 10.74 19 9c0-3.87-3.13-7-7-7z"/>
      </svg>
    </div>
    <h2>CodeMind Analysis</h2>
    <p>Select code and press <kbd>Ctrl+K</kbd> to analyze with AI agents</p>
    <div class="feature-list">
      <div class="feature-item">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>6 Specialist Agents</span>
      </div>
      <div class="feature-item">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>ODAI Synthesis</span>
      </div>
      <div class="feature-item">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        <span>N² Self-Correction</span>
      </div>
    </div>
  </div>
</body>
</html>`;
  }

  /**
   * Generate HTML for analysis results
   */
  private _getHtmlForWebview(webview: vscode.Webview, result: N2Result): string {
    const finalIteration = result.iterations[result.iterations.length - 1];
    const analyses = finalIteration?.analyses || [];
    const stats = this._calculateStats(analyses);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CodeMind Analysis</title>
  <style>${this._getStyles()}</style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h2>Analysis Results</h2>
      <div class="quality-badge quality-${this._getQualityLevel(result.qualityScore)}">
        ${result.qualityScore.toFixed(1)}/10
      </div>
    </div>

    <!-- Quick Stats -->
    <div class="stats-row">
      <div class="stat-item">
        <div class="stat-value">${result.iterations.length}</div>
        <div class="stat-label">Iterations</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${stats.totalIssues}</div>
        <div class="stat-label">Issues</div>
      </div>
      <div class="stat-item">
        <div class="stat-value">${(result.totalTime / 1000).toFixed(1)}s</div>
        <div class="stat-label">Time</div>
      </div>
    </div>

    <!-- Agents Summary -->
    <div class="section">
      <h3>Agents</h3>
      ${analyses.map(a => {
        const issueCount = a.issues.critical.length + a.issues.warnings.length;
        return `
          <div class="agent-card">
            <div class="agent-header">
              <span class="agent-name">${this._capitalize(a.agent)}</span>
              <span class="agent-confidence">${(a.confidence * 100).toFixed(0)}%</span>
            </div>
            ${issueCount > 0 ? `<div class="agent-issues">${issueCount} issue(s)</div>` : ''}
          </div>
        `;
      }).join('')}
    </div>

    <!-- Top Issues -->
    ${this._generateTopIssues(analyses)}

    <!-- Insights -->
    <div class="section">
      <h3>Key Insights</h3>
      ${analyses.flatMap(a => a.insights.slice(0, 2).map(insight => `
        <div class="insight-item">
          <div class="insight-agent">${this._capitalize(a.agent)}</div>
          <div class="insight-text">${insight}</div>
        </div>
      `)).join('')}
    </div>
  </div>

  <script>${this._getScripts()}</script>
</body>
</html>`;
  }

  private _calculateStats(analyses: AgentAnalysis[]): { totalIssues: number; critical: number; warnings: number } {
    let critical = 0;
    let warnings = 0;
    analyses.forEach(a => {
      critical += a.issues.critical.length;
      warnings += a.issues.warnings.length;
    });
    return { totalIssues: critical + warnings, critical, warnings };
  }

  private _generateTopIssues(analyses: AgentAnalysis[]): string {
    const allIssues: Array<{agent: string; issue: any; severity: string}> = [];
    
    analyses.forEach(a => {
      a.issues.critical.forEach(issue => allIssues.push({ agent: a.agent, issue, severity: 'critical' }));
      a.issues.warnings.slice(0, 2).forEach(issue => allIssues.push({ agent: a.agent, issue, severity: 'warning' }));
    });

    if (allIssues.length === 0) {
      return `<div class="success-message">No critical issues found</div>`;
    }

    return `
<div class="section">
  <h3>Top Issues</h3>
  ${allIssues.slice(0, 5).map(({ agent, issue, severity }) => `
    <div class="issue-card ${severity}">
      <div class="issue-header">
        <span class="issue-badge ${severity}">${severity}</span>
        ${issue.line ? `<span class="issue-line" onclick="jumpToLine(${issue.line})">Line ${issue.line}</span>` : ''}
      </div>
      <div class="issue-description">${issue.description}</div>
      <div class="issue-fix"><strong>Fix:</strong> ${issue.fix}</div>
    </div>
  `).join('')}
</div>`;
  }

  private _getQualityLevel(score: number): string {
    if (score >= 9) return 'excellent';
    if (score >= 8) return 'good';
    if (score >= 7) return 'fair';
    return 'poor';
  }

  private _capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private _getStyles(): string {
    return `
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: var(--vscode-font-family);
  color: var(--vscode-foreground);
  background: var(--vscode-sideBar-background);
  font-size: 13px;
  line-height: 1.6;
  padding: 16px;
}

.container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Welcome Screen */
.welcome-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 32px 16px;
  min-height: 400px;
}

.welcome-icon {
  color: var(--vscode-focusBorder);
  margin-bottom: 16px;
  opacity: 0.8;
}

.welcome-container h2 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
}

.welcome-container p {
  color: var(--vscode-descriptionForeground);
  margin-bottom: 24px;
}

kbd {
  background: var(--vscode-keybindingLabel-background);
  color: var(--vscode-keybindingLabel-foreground);
  border: 1px solid var(--vscode-keybindingLabel-border);
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 11px;
  font-family: monospace;
}

.feature-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--vscode-descriptionForeground);
}

.feature-item svg {
  color: var(--vscode-testing-iconPassed);
  flex-shrink: 0;
}

/* Header */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--vscode-panel-border);
}

h2, h3 {
  font-size: 14px;
  font-weight: 600;
}

.quality-badge {
  font-size: 13px;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 4px;
  color: white;
}

.quality-excellent {
  background: #10b981;
}

.quality-good {
  background: #3b82f6;
}

.quality-fair {
  background: #f59e0b;
}

.quality-poor {
  background: #ef4444;
}

/* Stats */
.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.stat-item {
  background: var(--vscode-editor-inactiveSelectionBackground);
  padding: 12px;
  border-radius: 6px;
  text-align: center;
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
  text-transform: uppercase;
}

/* Section */
.section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section h3 {
  margin-bottom: 4px;
}

/* Agent Cards */
.agent-card {
  background: var(--vscode-editor-inactiveSelectionBackground);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 6px;
  padding: 10px;
}

.agent-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.agent-name {
  font-weight: 600;
  font-size: 12px;
}

.agent-confidence {
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
}

.agent-issues {
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
}

/* Issues */
.issue-card {
  background: var(--vscode-editor-inactiveSelectionBackground);
  border-left: 3px solid var(--vscode-panel-border);
  border-radius: 4px;
  padding: 10px;
}

.issue-card.critical {
  border-left-color: #ef4444;
}

.issue-card.warning {
  border-left-color: #f59e0b;
}

.issue-header {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 6px;
}

.issue-badge {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 3px;
}

.issue-badge.critical {
  background: #ef4444;
  color: white;
}

.issue-badge.warning {
  background: #f59e0b;
  color: white;
}

.issue-line {
  font-size: 11px;
  color: var(--vscode-textLink-foreground);
  cursor: pointer;
  text-decoration: underline;
}

.issue-line:hover {
  color: var(--vscode-textLink-activeForeground);
}

.issue-description {
  font-size: 12px;
  margin-bottom: 6px;
}

.issue-fix {
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
}

.success-message {
  color: var(--vscode-testing-iconPassed);
  font-size: 12px;
  padding: 10px;
  background: var(--vscode-editor-inactiveSelectionBackground);
  border-radius: 6px;
  text-align: center;
}

/* Insights */
.insight-item {
  background: var(--vscode-editor-inactiveSelectionBackground);
  border-radius: 6px;
  padding: 10px;
}

.insight-agent {
  font-size: 11px;
  font-weight: 600;
  color: var(--vscode-focusBorder);
  margin-bottom: 4px;
}

.insight-text {
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}
`;
  }

  private _getScripts(): string {
    return `
const vscode = acquireVsCodeApi();

function jumpToLine(line) {
  vscode.postMessage({
    command: 'jumpToLine',
    line: line
  });
}
`;
  }
}


