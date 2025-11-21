/**
 * Progress Panel - Beautiful, professional progress tracking for N² loop
 * Shows real-time agent execution, synthesis progress, and quality scores
 */

import * as vscode from 'vscode';
import { ProgressEvent } from '../synthesis';

export class ProgressPanelProvider {
  private static currentPanel: vscode.WebviewPanel | undefined;
  private static readonly viewType = 'codeMindProgress';
  private static agentStates = new Map<string, { 
    status: 'pending' | 'running' | 'complete';
    time?: number;
    confidence?: number;
    insights?: string[];
    issueCount?: number;
  }>();
  private static currentIteration = 0;
  private static currentPhase: 'agents' | 'synthesis' | 'complete' = 'agents';
  private static qualityScores: number[] = [];
  private static synthesisPreview: string = '';

  /**
   * Show or create the progress panel
   */
  public static show(extensionUri: vscode.Uri): void {
    const column = vscode.ViewColumn.Two;

    // Reset state for new execution
    this.agentStates.clear();
    this.currentIteration = 0;
    this.currentPhase = 'agents';
    this.qualityScores = [];
    this.synthesisPreview = '';

    // Initialize agent states
    const agents = ['architect', 'engineer', 'security', 'performance', 'testing', 'documentation'];
    agents.forEach(agent => this.agentStates.set(agent, { status: 'pending' }));

    // If panel already exists, reveal and update it
    if (ProgressPanelProvider.currentPanel) {
      ProgressPanelProvider.currentPanel.reveal(column);
      ProgressPanelProvider.currentPanel.webview.html = this.getWebviewContent(
        ProgressPanelProvider.currentPanel.webview,
        extensionUri
      );
      return;
    }

    // Create new panel
    const panel = vscode.window.createWebviewPanel(
      ProgressPanelProvider.viewType,
      'CodeMind: Analyzing...',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [extensionUri]
      }
    );

    ProgressPanelProvider.currentPanel = panel;

    // Set content
    panel.webview.html = this.getWebviewContent(panel.webview, extensionUri);

    // Handle panel disposal
    panel.onDidDispose(() => {
      ProgressPanelProvider.currentPanel = undefined;
    });
  }

  /**
   * Update progress based on event
   */
  public static update(event: ProgressEvent): void {
    if (!ProgressPanelProvider.currentPanel) return;

    switch (event.type) {
      case 'iteration_start':
        this.currentIteration = event.iteration || 0;
        this.currentPhase = 'agents';
        // Reset agent states
        this.agentStates.forEach((_, key) => {
          this.agentStates.set(key, { status: 'pending' });
        });
        break;

      case 'agents_start':
        this.currentPhase = 'agents';
        this.agentStates.forEach((_, key) => {
          this.agentStates.set(key, { status: 'running' });
        });
        break;

      case 'agent_complete':
        if (event.agent) {
          this.agentStates.set(event.agent, { 
            status: 'complete', 
            time: event.elapsed,
            confidence: event.confidence,
            insights: event.insights,
            issueCount: event.issueCount
          });
        }
        break;

      case 'synthesis_start':
        this.currentPhase = 'synthesis';
        this.synthesisPreview = 'Synthesizing insights from all agents...';
        break;

      case 'synthesis_complete':
        if (event.qualityScore !== undefined) {
          this.qualityScores.push(event.qualityScore);
        }
        if (event.synthesisPreview) {
          this.synthesisPreview = event.synthesisPreview;
        }
        break;

      case 'iteration_complete':
        this.currentPhase = 'complete';
        break;
    }

    // Update the webview
    this.sendUpdate();
  }

  /**
   * Close the progress panel
   */
  public static close(): void {
    ProgressPanelProvider.currentPanel?.dispose();
  }

  /**
   * Send update to webview
   */
  private static sendUpdate(): void {
    if (!ProgressPanelProvider.currentPanel) return;

    const agents = Array.from(this.agentStates.entries()).map(([name, state]) => ({
      name,
      status: state.status,
      time: state.time,
      confidence: state.confidence,
      insights: state.insights,
      issueCount: state.issueCount
    }));

    const completedCount = agents.filter(a => a.status === 'complete').length;
    const progress = (completedCount / agents.length) * 100;

    ProgressPanelProvider.currentPanel.webview.postMessage({
      type: 'update',
      data: {
        iteration: this.currentIteration,
        phase: this.currentPhase,
        agents,
        progress,
        qualityScores: this.qualityScores,
        synthesisPreview: this.synthesisPreview
      }
    });
  }

  /**
   * Generate HTML content for the webview
   */
  private static getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    const agents = Array.from(this.agentStates.entries()).map(([name, state]) => ({
      name,
      status: state.status,
      time: state.time,
      confidence: state.confidence,
      insights: state.insights,
      issueCount: state.issueCount
    }));

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CodeMind Progress</title>
  <style>
    ${this.getStyles()}
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="logo">
        <svg class="brain-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 1.74.63 3.34 1.67 4.58L5.5 15.5C5.19 15.81 5 16.21 5 16.67V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2.33c0-.46-.19-.86-.5-1.17l-1.17-1.92C18.37 12.34 19 10.74 19 9c0-3.87-3.13-7-7-7z"/>
        </svg>
        <div class="header-text">
          <h1>CodeMind AI Agent</h1>
          <p id="status-text">Initializing...</p>
        </div>
      </div>
      <div class="iteration-badge" id="iteration-badge">
        Iteration <span id="iteration-num">1</span>
      </div>
    </div>

    <!-- Progress Bar -->
    <div class="progress-section">
      <div class="progress-bar-container">
        <div class="progress-bar" id="progress-bar" style="width: 0%"></div>
      </div>
      <div class="progress-text" id="progress-text">0% Complete</div>
    </div>

    <!-- Phase Indicator -->
    <div class="phase-section">
      <div class="phase-item" id="phase-agents">
        <div class="phase-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
        </div>
        <span>Agents</span>
      </div>
      <div class="phase-divider"></div>
      <div class="phase-item" id="phase-synthesis">
        <div class="phase-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M12 1v6m0 6v6m5.2-13.2l-4.2 4.2m0 6l4.2 4.2m6-10.2h-6m-6 0H1m17.2 5.2l-4.2-4.2m0-6l4.2-4.2"></path>
          </svg>
        </div>
        <span>Synthesis</span>
      </div>
      <div class="phase-divider"></div>
      <div class="phase-item" id="phase-complete">
        <div class="phase-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <span>Complete</span>
      </div>
    </div>

    <!-- Agents Grid -->
    <div class="agents-section">
      <h2>Specialist Agents</h2>
      <div class="agents-grid">
        ${agents.map(agent => `
          <div class="agent-card ${agent.status}" id="agent-${agent.name}" data-agent="${agent.name}">
            <div class="agent-status-icon">
              ${this.getAgentStatusIcon(agent.status)}
            </div>
            <div class="agent-info">
              <div class="agent-name">${this.capitalize(agent.name)}</div>
              <div class="agent-status">${this.getStatusText(agent.status)}</div>
              ${agent.confidence !== undefined ? `
                <div class="agent-confidence">
                  <div class="confidence-bar-container">
                    <div class="confidence-bar" style="width: ${(agent.confidence * 100).toFixed(0)}%"></div>
                  </div>
                  <span class="confidence-text">${(agent.confidence * 100).toFixed(0)}% confidence</span>
                </div>
              ` : ''}
              ${agent.issueCount !== undefined ? `
                <div class="agent-issues">${agent.issueCount} issue${agent.issueCount !== 1 ? 's' : ''} found</div>
              ` : ''}
            </div>
            ${agent.time ? `<div class="agent-time">${(agent.time / 1000).toFixed(1)}s</div>` : ''}
            ${agent.insights && agent.insights.length > 0 ? `
              <div class="agent-insights" id="insights-${agent.name}">
                ${agent.insights.map((insight, i) => `
                  <div class="insight-item" style="animation-delay: ${i * 0.1}s">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <path d="M12 16v-4"></path>
                      <path d="M12 8h.01"></path>
                    </svg>
                    <span>${insight}</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Synthesis Preview -->
    <div class="synthesis-section" id="synthesis-section" style="display: none;">
      <h2>Synthesis Preview</h2>
      <div class="synthesis-content" id="synthesis-content">
        Synthesizing insights...
      </div>
    </div>

    <!-- Quality Scores -->
    <div class="quality-section" id="quality-section" style="display: none;">
      <h2>Quality Scores</h2>
      <div class="quality-chart" id="quality-chart"></div>
    </div>
  </div>

  <script>
    ${this.getScripts()}
  </script>
</body>
</html>`;
  }

  private static getAgentStatusIcon(status: string): string {
    switch (status) {
      case 'complete':
        return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>';
      case 'running':
        return '<div class="spinner"></div>';
      default:
        return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg>';
    }
  }

  private static getStatusText(status: string): string {
    switch (status) {
      case 'complete': return 'Complete';
      case 'running': return 'Analyzing...';
      default: return 'Waiting';
    }
  }

  private static capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
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
  padding: 0;
  overflow-x: hidden;
}

.container {
  max-width: 900px;
  margin: 0 auto;
  padding: 32px;
}

/* Header */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
  animation: slideDown 0.4s ease-out;
}

.logo {
  display: flex;
  align-items: center;
  gap: 16px;
}

.brain-icon {
  color: var(--vscode-focusBorder);
  animation: pulse 2s ease-in-out infinite;
}

.header-text h1 {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-bottom: 4px;
}

.header-text p {
  font-size: 14px;
  color: var(--vscode-descriptionForeground);
}

.iteration-badge {
  background: var(--vscode-badge-background);
  color: var(--vscode-badge-foreground);
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
}

/* Progress Bar */
.progress-section {
  margin-bottom: 32px;
  animation: slideDown 0.5s ease-out;
}

.progress-bar-container {
  height: 8px;
  background: var(--vscode-editor-inactiveSelectionBackground);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #8b5cf6);
  border-radius: 4px;
  transition: width 0.3s ease-out;
  position: relative;
  overflow: hidden;
}

.progress-bar::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
  animation: shimmer 1.5s infinite;
}

.progress-text {
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
  text-align: right;
}

/* Phase Indicator */
.phase-section {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-bottom: 32px;
  padding: 24px;
  background: var(--vscode-editor-inactiveSelectionBackground);
  border-radius: 12px;
  animation: slideDown 0.6s ease-out;
}

.phase-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border-radius: 8px;
  transition: all 0.3s ease;
  opacity: 0.5;
}

.phase-item.active {
  opacity: 1;
  background: var(--vscode-list-activeSelectionBackground);
  transform: scale(1.1);
}

.phase-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--vscode-button-secondaryBackground);
  color: var(--vscode-button-secondaryForeground);
}

.phase-item.active .phase-icon {
  background: var(--vscode-focusBorder);
  color: white;
}

.phase-item span {
  font-size: 12px;
  font-weight: 600;
}

.phase-divider {
  width: 40px;
  height: 2px;
  background: var(--vscode-panel-border);
}

/* Agents Grid */
.agents-section {
  margin-bottom: 32px;
  animation: slideUp 0.7s ease-out;
}

.agents-section h2 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
}

.agents-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
}

.agent-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: var(--vscode-editor-inactiveSelectionBackground);
  border: 2px solid var(--vscode-panel-border);
  border-radius: 10px;
  transition: all 0.3s ease;
}

.agent-card.running {
  border-color: var(--vscode-focusBorder);
  box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
  animation: glow 2s ease-in-out infinite;
}

.agent-card.complete {
  border-color: #10b981;
  background: rgba(16, 185, 129, 0.05);
}

.agent-status-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--vscode-button-secondaryBackground);
  flex-shrink: 0;
}

.agent-card.running .agent-status-icon {
  background: var(--vscode-focusBorder);
}

.agent-card.complete .agent-status-icon {
  background: #10b981;
  color: white;
}

.agent-card {
  flex-direction: column;
  align-items: stretch;
}

.agent-info {
  flex: 1;
  min-width: 0;
}

.agent-name {
  font-weight: 600;
  margin-bottom: 4px;
}

.agent-status {
  font-size: 13px;
  color: var(--vscode-descriptionForeground);
  margin-bottom: 8px;
}

.agent-confidence {
  margin-top: 8px;
}

.confidence-bar-container {
  width: 100%;
  height: 4px;
  background: var(--vscode-editor-background);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 4px;
}

.confidence-bar {
  height: 100%;
  background: linear-gradient(90deg, #10b981, #3b82f6);
  border-radius: 2px;
  transition: width 0.5s ease-out;
}

.confidence-text {
  font-size: 11px;
  color: var(--vscode-descriptionForeground);
}

.agent-issues {
  font-size: 11px;
  color: var(--vscode-editorWarning-foreground);
  margin-top: 4px;
}

.agent-time {
  font-size: 13px;
  font-weight: 600;
  color: var(--vscode-testing-iconPassed);
  align-self: flex-end;
}

.agent-insights {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--vscode-panel-border);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.insight-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 12px;
  color: var(--vscode-descriptionForeground);
  opacity: 0;
  animation: slideInInsight 0.3s ease-out forwards;
}

.insight-item svg {
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--vscode-focusBorder);
}

.insight-item span {
  flex: 1;
  line-height: 1.4;
}

/* Spinner */
.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

/* Synthesis Section */
.synthesis-section {
  margin-bottom: 32px;
  animation: slideUp 0.75s ease-out;
}

.synthesis-section h2 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
}

.synthesis-content {
  padding: 16px;
  background: var(--vscode-editor-inactiveSelectionBackground);
  border-left: 4px solid var(--vscode-focusBorder);
  border-radius: 6px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--vscode-descriptionForeground);
  animation: fadeIn 0.5s ease-out;
}

/* Quality Section */
.quality-section {
  animation: slideUp 0.8s ease-out;
}

.quality-section h2 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
}

.quality-chart {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 20px;
  background: var(--vscode-editor-inactiveSelectionBackground);
  border-radius: 10px;
  min-height: 100px;
}

/* Animations */
@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes glow {
  0%, 100% {
    box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
  }
  50% {
    box-shadow: 0 0 30px rgba(59, 130, 246, 0.5);
  }
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes slideInInsight {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
`;
  }

  private static getScripts(): string {
    return `
const vscode = acquireVsCodeApi();

window.addEventListener('message', event => {
  const message = event.data;
  if (message.type === 'update') {
    updateUI(message.data);
  }
});

function updateUI(data) {
  // Update iteration
  document.getElementById('iteration-num').textContent = data.iteration;
  
  // Update status text
  const statusText = document.getElementById('status-text');
  if (data.phase === 'agents') {
    statusText.textContent = 'Running 6 specialist agents...';
  } else if (data.phase === 'synthesis') {
    statusText.textContent = 'ODAI synthesis in progress...';
  } else {
    statusText.textContent = 'Analysis complete!';
  }
  
  // Update progress bar
  document.getElementById('progress-bar').style.width = data.progress + '%';
  document.getElementById('progress-text').textContent = Math.round(data.progress) + '% Complete';
  
  // Update phase indicators
  document.querySelectorAll('.phase-item').forEach(el => el.classList.remove('active'));
  if (data.phase === 'agents') {
    document.getElementById('phase-agents').classList.add('active');
  } else if (data.phase === 'synthesis') {
    document.getElementById('phase-synthesis').classList.add('active');
  } else {
    document.getElementById('phase-complete').classList.add('active');
  }
  
  // Update agents with new streaming data
  data.agents.forEach(agent => {
    const card = document.getElementById('agent-' + agent.name);
    if (!card) return;
    
    card.className = 'agent-card ' + agent.status;
    
    // Update status text
    const statusEl = card.querySelector('.agent-status');
    if (statusEl) {
      if (agent.status === 'complete') {
        statusEl.textContent = 'Complete';
      } else if (agent.status === 'running') {
        statusEl.textContent = 'Analyzing...';
      } else {
        statusEl.textContent = 'Waiting';
      }
    }
    
    // Update or add confidence bar
    if (agent.confidence !== undefined && agent.status === 'complete') {
      let confidenceDiv = card.querySelector('.agent-confidence');
      if (!confidenceDiv) {
        const info = card.querySelector('.agent-info');
        confidenceDiv = document.createElement('div');
        confidenceDiv.className = 'agent-confidence';
        confidenceDiv.innerHTML = \`
          <div class="confidence-bar-container">
            <div class="confidence-bar" style="width: 0%"></div>
          </div>
          <span class="confidence-text">\${(agent.confidence * 100).toFixed(0)}% confidence</span>
        \`;
        info.appendChild(confidenceDiv);
        // Animate confidence bar
        setTimeout(() => {
          const bar = confidenceDiv.querySelector('.confidence-bar');
          if (bar) bar.style.width = (agent.confidence * 100).toFixed(0) + '%';
        }, 50);
      }
    }
    
    // Update or add issue count
    if (agent.issueCount !== undefined && agent.status === 'complete') {
      let issuesDiv = card.querySelector('.agent-issues');
      if (!issuesDiv) {
        const info = card.querySelector('.agent-info');
        issuesDiv = document.createElement('div');
        issuesDiv.className = 'agent-issues';
        issuesDiv.textContent = \`\${agent.issueCount} issue\${agent.issueCount !== 1 ? 's' : ''} found\`;
        info.appendChild(issuesDiv);
      }
    }
    
    // Update time
    if (agent.time) {
      let timeEl = card.querySelector('.agent-time');
      if (!timeEl) {
        timeEl = document.createElement('div');
        timeEl.className = 'agent-time';
        card.appendChild(timeEl);
      }
      timeEl.textContent = (agent.time / 1000).toFixed(1) + 's';
    }
    
    // Stream insights (add with animation)
    if (agent.insights && agent.insights.length > 0 && agent.status === 'complete') {
      let insightsDiv = card.querySelector('.agent-insights');
      if (!insightsDiv) {
        insightsDiv = document.createElement('div');
        insightsDiv.className = 'agent-insights';
        insightsDiv.id = 'insights-' + agent.name;
        card.appendChild(insightsDiv);
      }
      
      // Add new insights with streaming effect
      agent.insights.forEach((insight, i) => {
        if (!insightsDiv.querySelector(\`[data-insight="\${i}"]\`)) {
          const insightEl = document.createElement('div');
          insightEl.className = 'insight-item';
          insightEl.setAttribute('data-insight', i);
          insightEl.style.animationDelay = (i * 0.1) + 's';
          insightEl.innerHTML = \`
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M12 16v-4"></path>
              <path d="M12 8h.01"></path>
            </svg>
            <span>\${insight}</span>
          \`;
          insightsDiv.appendChild(insightEl);
        }
      });
    }
  });
  
  // Update synthesis preview
  if (data.synthesisPreview && data.phase === 'synthesis') {
    const synthesisSection = document.getElementById('synthesis-section');
    const synthesisContent = document.getElementById('synthesis-content');
    if (synthesisSection && synthesisContent) {
      synthesisSection.style.display = 'block';
      synthesisContent.textContent = data.synthesisPreview;
    }
  }
  
  // Update quality scores
  if (data.qualityScores && data.qualityScores.length > 0) {
    document.getElementById('quality-section').style.display = 'block';
    renderQualityChart(data.qualityScores);
  }
}

function renderQualityChart(scores) {
  const chart = document.getElementById('quality-chart');
  chart.innerHTML = scores.map((score, i) => \`
    <div style="flex: 1; display: flex; flex-direction: column; align-items: center; gap: 8px;">
      <div style="width: 100%; height: \${score * 10}px; background: linear-gradient(180deg, #10b981, #3b82f6); border-radius: 4px; transition: height 0.3s ease;"></div>
      <div style="font-size: 12px; font-weight: 600;">\${score.toFixed(1)}</div>
      <div style="font-size: 11px; color: var(--vscode-descriptionForeground);">Iter \${i + 1}</div>
    </div>
  \`).join('');
}
`;
  }
}

