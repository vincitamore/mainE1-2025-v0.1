/**
 * Analysis Panel - Webview displaying all agent insights
 * Beautiful, organized view of multi-agent analysis results
 */

import * as vscode from 'vscode';
import { N2Result } from '../synthesis';
import { AgentAnalysis } from '../agents/agent';

export class AnalysisPanelProvider {
  private static currentPanel: vscode.WebviewPanel | undefined;
  private static readonly viewType = 'codemindAnalysis';
  
  /**
   * Show or update the analysis panel with results
   */
  public static show(
    extensionUri: vscode.Uri,
    result: N2Result,
    context: vscode.ExtensionContext
  ): void {
    const column = vscode.ViewColumn.Two;
    
    // If panel already exists, reveal and update it
    if (AnalysisPanelProvider.currentPanel) {
      AnalysisPanelProvider.currentPanel.reveal(column);
      AnalysisPanelProvider.currentPanel.webview.html = this.getWebviewContent(
        AnalysisPanelProvider.currentPanel.webview,
        extensionUri,
        result
      );
      return;
    }
    
    // Create new panel
    const panel = vscode.window.createWebviewPanel(
      AnalysisPanelProvider.viewType,
      'CodeMind Analysis',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri]
      }
    );
    
    AnalysisPanelProvider.currentPanel = panel;
    
    // Set content
    panel.webview.html = this.getWebviewContent(panel.webview, extensionUri, result);
    
    // Handle panel disposal
    panel.onDidDispose(() => {
      AnalysisPanelProvider.currentPanel = undefined;
    });
    
    // Handle messages from webview
    panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'copy':
            vscode.env.clipboard.writeText(message.text);
            vscode.window.showInformationMessage('Copied to clipboard');
            break;
          case 'jumpToLine':
            this.jumpToLine(message.line);
            break;
        }
      },
      undefined,
      context.subscriptions
    );
  }
  
  /**
   * Jump to a specific line in the active editor
   */
  private static jumpToLine(line: number): void {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const position = new vscode.Position(line - 1, 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(new vscode.Range(position, position));
      vscode.window.showTextDocument(editor.document);
    }
  }
  
  /**
   * Generate HTML content for the webview
   */
  private static getWebviewContent(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
    result: N2Result
  ): string {
    // Get all analyses from the final iteration
    const finalIteration = result.iterations[result.iterations.length - 1];
    const analyses = finalIteration?.analyses || [];
    
    // Calculate statistics
    const stats = this.calculateStats(analyses, result);
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CodeMind Analysis</title>
  <style>
    ${this.getStyles()}
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1>CodeMind Analysis</h1>
      <div class="quality-badge quality-${this.getQualityLevel(result.qualityScore)}">
        ${result.qualityScore.toFixed(1)}/10
      </div>
    </div>
    
    <!-- Summary Stats -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Quality Score</div>
        <div class="stat-value">${result.qualityScore.toFixed(1)}/10</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Issues</div>
        <div class="stat-value">${stats.totalIssues}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Iterations</div>
        <div class="stat-value">${result.iterations.length}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Time</div>
        <div class="stat-value">${(result.totalTime / 1000).toFixed(1)}s</div>
      </div>
    </div>
    
    <!-- Issue Summary -->
    ${this.generateIssueSummary(analyses)}
    
    <!-- Agent Tabs -->
    <div class="tabs">
      <button class="tab active" onclick="showTab('overview')">Overview</button>
      ${analyses.map(a => `
        <button class="tab" onclick="showTab('${a.agent}')">${this.capitalize(a.agent)}</button>
      `).join('')}
    </div>
    
    <!-- Tab Content -->
    <div class="tab-content">
      <!-- Overview Tab -->
      <div id="overview" class="tab-pane active">
        ${this.generateOverviewContent(result, analyses, stats)}
      </div>
      
      <!-- Agent Tabs -->
      ${analyses.map(analysis => `
        <div id="${analysis.agent}" class="tab-pane">
          ${this.generateAgentContent(analysis)}
        </div>
      `).join('')}
    </div>
  </div>
  
  <script>
    ${this.getScripts()}
  </script>
</body>
</html>`;
  }
  
  /**
   * Calculate statistics from analyses
   */
  private static calculateStats(analyses: AgentAnalysis[], result: N2Result) {
    let totalIssues = 0;
    let critical = 0;
    let warnings = 0;
    let suggestions = 0;
    
    analyses.forEach(a => {
      critical += a.issues.critical.length;
      warnings += a.issues.warnings.length;
      suggestions += a.issues.suggestions.length;
    });
    
    totalIssues = critical + warnings + suggestions;
    
    return { totalIssues, critical, warnings, suggestions };
  }
  
  /**
   * Generate issue summary section
   */
  private static generateIssueSummary(analyses: AgentAnalysis[]): string {
    const allIssues: Array<{agent: string; issue: any; severity: string}> = [];
    
    analyses.forEach(a => {
      a.issues.critical.forEach(issue => allIssues.push({ agent: a.agent, issue, severity: 'critical' }));
      a.issues.warnings.forEach(issue => allIssues.push({ agent: a.agent, issue, severity: 'warning' }));
    });
    
    if (allIssues.length === 0) {
      return `<div class="success-banner">✓ No critical issues or warnings found!</div>`;
    }
    
    return `
<div class="section">
  <h2>Top Issues</h2>
  <div class="issues-list">
    ${allIssues.slice(0, 5).map(({ agent, issue, severity }) => `
      <div class="issue-card ${severity}">
        <div class="issue-header">
          <span class="issue-badge ${severity}">${severity}</span>
          <span class="issue-agent">${this.capitalize(agent)}</span>
          ${issue.line ? `<span class="issue-line" onclick="jumpToLine(${issue.line})">Line ${issue.line}</span>` : ''}
        </div>
        <div class="issue-title">${issue.type || 'Issue'}</div>
        <div class="issue-description">${issue.description}</div>
        <div class="issue-fix"><strong>Fix:</strong> ${issue.fix}</div>
        ${issue.impact ? `<div class="issue-impact"><strong>Impact:</strong> ${issue.impact}</div>` : ''}
      </div>
    `).join('')}
  </div>
</div>`;
  }
  
  /**
   * Generate overview tab content
   */
  private static generateOverviewContent(
    result: N2Result,
    analyses: AgentAnalysis[],
    stats: any
  ): string {
    return `
<div class="overview-content">
  <div class="section">
    <h2>Summary</h2>
    <p>${result.explanation}</p>
  </div>
  
  <div class="section">
    <h2>Agent Perspectives</h2>
    <div class="agent-summary-grid">
      ${analyses.map(a => {
        const issueCount = a.issues.critical.length + a.issues.warnings.length;
        return `
          <div class="agent-summary-card" onclick="showTab('${a.agent}')">
            <div class="agent-name">${this.capitalize(a.agent)}</div>
            <div class="agent-confidence">Confidence: ${(a.confidence * 100).toFixed(0)}%</div>
            <div class="agent-issues">${issueCount} issue(s) found</div>
          </div>
        `;
      }).join('')}
    </div>
  </div>
  
  <div class="section">
    <h2>Key Decisions</h2>
    <div class="decisions-grid">
      ${Object.entries(result.keyDecisions).map(([key, value]) => `
        <div class="decision-card">
          <div class="decision-title">${this.capitalize(key)}</div>
          <div class="decision-content">${value}</div>
        </div>
      `).join('')}
    </div>
  </div>
  
  <div class="section">
    <h2>Iteration History</h2>
    ${result.iterations.map((iter, i) => `
      <div class="iteration-card">
        <div class="iteration-header">
          <span>Iteration ${i + 1}</span>
          <span class="iteration-quality">Quality: ${iter.qualityScore.toFixed(1)}/10</span>
        </div>
        <div class="iteration-stats">
          <span>Agent Time: ${iter.agentTime}ms</span>
          <span>Synthesis Time: ${iter.synthesisTime}ms</span>
          <span>Total: ${iter.totalTime}ms</span>
        </div>
      </div>
    `).join('')}
  </div>
</div>`;
  }
  
  /**
   * Generate individual agent tab content
   */
  private static generateAgentContent(analysis: AgentAnalysis): string {
    return `
<div class="agent-content">
  <div class="section">
    <h2>Insights</h2>
    <ul class="insights-list">
      ${analysis.insights.map(insight => `<li>${insight}</li>`).join('')}
    </ul>
  </div>
  
  ${analysis.issues.critical.length > 0 ? `
  <div class="section">
    <h2>Critical Issues</h2>
    ${analysis.issues.critical.map(issue => this.generateIssueCard(issue, 'critical')).join('')}
  </div>
  ` : ''}
  
  ${analysis.issues.warnings.length > 0 ? `
  <div class="section">
    <h2>Warnings</h2>
    ${analysis.issues.warnings.map(issue => this.generateIssueCard(issue, 'warning')).join('')}
  </div>
  ` : ''}
  
  ${analysis.issues.suggestions.length > 0 ? `
  <div class="section">
    <h2>Suggestions</h2>
    ${analysis.issues.suggestions.map(issue => this.generateIssueCard(issue, 'suggestion')).join('')}
  </div>
  ` : ''}
  
  <div class="section">
    <h2>Recommendations</h2>
    <ul class="recommendations-list">
      ${analysis.recommendations.map(rec => `<li>${rec}</li>`).join('')}
    </ul>
  </div>
</div>`;
  }
  
  /**
   * Generate issue card HTML
   */
  private static generateIssueCard(issue: any, severity: string): string {
    return `
<div class="issue-card ${severity}">
  <div class="issue-header">
    <span class="issue-type">${issue.type || 'Issue'}</span>
    ${issue.line ? `<span class="issue-line" onclick="jumpToLine(${issue.line})">Line ${issue.line}</span>` : ''}
  </div>
  <div class="issue-description">${issue.description}</div>
  <div class="issue-fix"><strong>Fix:</strong> ${issue.fix}</div>
  ${issue.impact ? `<div class="issue-impact"><strong>Impact:</strong> ${issue.impact}</div>` : ''}
</div>`;
  }
  
  /**
   * Get quality level for styling
   */
  private static getQualityLevel(score: number): string {
    if (score >= 9) return 'excellent';
    if (score >= 8) return 'good';
    if (score >= 7) return 'fair';
    return 'poor';
  }
  
  /**
   * Capitalize first letter
   */
  private static capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  
  /**
   * CSS styles for the webview
   */
  private static getStyles(): string {
    return `
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: var(--vscode-font-family);
  color: var(--vscode-foreground);
  background: var(--vscode-editor-background);
  padding: 0;
  line-height: 1.6;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--vscode-panel-border);
}

h1 {
  font-size: 24px;
  font-weight: 600;
}

h2 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
}

.quality-badge {
  font-size: 20px;
  font-weight: 700;
  padding: 8px 16px;
  border-radius: 6px;
}

.quality-excellent {
  background: var(--vscode-testing-iconPassed);
  color: white;
}

.quality-good {
  background: var(--vscode-notificationsInfoIcon-foreground);
  color: white;
}

.quality-fair {
  background: var(--vscode-editorWarning-foreground);
  color: var(--vscode-editor-background);
}

.quality-poor {
  background: var(--vscode-errorForeground);
  color: white;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: var(--vscode-editor-inactiveSelectionBackground);
  padding: 16px;
  border-radius: 6px;
  border: 1px solid var(--vscode-panel-border);
}

.stat-label {
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
  margin-bottom: 4px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
}

.success-banner {
  background: var(--vscode-testing-iconPassed);
  color: white;
  padding: 16px;
  border-radius: 6px;
  margin-bottom: 24px;
  text-align: center;
  font-weight: 500;
}

.section {
  margin-bottom: 32px;
}

.tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--vscode-panel-border);
  margin-bottom: 24px;
}

.tab {
  background: transparent;
  border: none;
  color: var(--vscode-foreground);
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 150ms;
  font-family: var(--vscode-font-family);
  font-size: 14px;
}

.tab:hover {
  background: var(--vscode-list-hoverBackground);
}

.tab.active {
  border-bottom-color: var(--vscode-focusBorder);
  font-weight: 600;
}

.tab-pane {
  display: none;
}

.tab-pane.active {
  display: block;
}

.issues-list, .agent-summary-grid, .decisions-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.agent-summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.agent-summary-card {
  background: var(--vscode-editor-inactiveSelectionBackground);
  padding: 16px;
  border-radius: 6px;
  border: 1px solid var(--vscode-panel-border);
  cursor: pointer;
  transition: all 150ms;
}

.agent-summary-card:hover {
  transform: translateY(-2px);
  border-color: var(--vscode-focusBorder);
}

.agent-name {
  font-weight: 600;
  margin-bottom: 8px;
}

.agent-confidence, .agent-issues {
  font-size: 13px;
  color: var(--vscode-descriptionForeground);
}

.issue-card {
  background: var(--vscode-editor-inactiveSelectionBackground);
  padding: 16px;
  border-radius: 6px;
  border-left: 4px solid var(--vscode-panel-border);
}

.issue-card.critical {
  border-left-color: var(--vscode-errorForeground);
}

.issue-card.warning {
  border-left-color: var(--vscode-editorWarning-foreground);
}

.issue-card.suggestion {
  border-left-color: var(--vscode-notificationsInfoIcon-foreground);
}

.issue-header {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.issue-badge, .issue-type {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: 3px;
}

.issue-badge.critical, .issue-type {
  background: var(--vscode-errorForeground);
  color: white;
}

.issue-badge.warning {
  background: var(--vscode-editorWarning-foreground);
  color: var(--vscode-editor-background);
}

.issue-agent {
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
}

.issue-line {
  font-size: 12px;
  color: var(--vscode-textLink-foreground);
  cursor: pointer;
  text-decoration: underline;
}

.issue-line:hover {
  color: var(--vscode-textLink-activeForeground);
}

.issue-title {
  font-weight: 600;
  margin-bottom: 8px;
}

.issue-description, .issue-fix, .issue-impact {
  font-size: 14px;
  margin-bottom: 8px;
}

.insights-list, .recommendations-list {
  list-style: none;
  padding-left: 0;
}

.insights-list li, .recommendations-list li {
  padding: 8px 0 8px 24px;
  position: relative;
}

.insights-list li::before, .recommendations-list li::before {
  content: "•";
  position: absolute;
  left: 8px;
  color: var(--vscode-focusBorder);
  font-weight: bold;
}

.decision-card, .iteration-card {
  background: var(--vscode-editor-inactiveSelectionBackground);
  padding: 16px;
  border-radius: 6px;
  border: 1px solid var(--vscode-panel-border);
  margin-bottom: 12px;
}

.decision-title, .iteration-header {
  font-weight: 600;
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
}

.decision-content {
  color: var(--vscode-descriptionForeground);
}

.iteration-stats {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: var(--vscode-descriptionForeground);
}

.iteration-quality {
  color: var(--vscode-testing-iconPassed);
  font-weight: 600;
}
`;
  }
  
  /**
   * JavaScript for webview interactivity
   */
  private static getScripts(): string {
    return `
const vscode = acquireVsCodeApi();

function showTab(tabId) {
  // Hide all tabs
  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.remove('active');
  });
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.remove('active');
  });
  
  // Show selected tab
  const selectedPane = document.getElementById(tabId);
  if (selectedPane) {
    selectedPane.classList.add('active');
  }
  
  // Highlight selected tab button
  event.target.classList.add('active');
}

function jumpToLine(line) {
  vscode.postMessage({
    command: 'jumpToLine',
    line: line
  });
}

function copyText(text) {
  vscode.postMessage({
    command: 'copy',
    text: text
  });
}
`;
  }
}


