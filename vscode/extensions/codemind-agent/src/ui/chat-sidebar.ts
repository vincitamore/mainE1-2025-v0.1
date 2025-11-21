/**
 * Chat Sidebar Provider
 * 
 * The main interaction point for CodeMind Orchestrator (Composer analog)
 * Features:
 * - Conversation history
 * - Multi-file operation planning
 * - Real-time progress
 * - File previews and diffs
 * - Rollback/time travel
 */

import * as vscode from 'vscode';

/**
 * Generate a nonce for CSP
 */
function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

/**
 * Chat message types
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: {
    filesAffected?: string[];
    operationType?: string;
    rollbackId?: string;
    quality?: number;
  };
}

/**
 * Chat session state
 */
export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

/**
 * Chat Sidebar Provider
 */
export class ChatSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'codemind.chatSidebar';
  
  private _view?: vscode.WebviewView;
  private _currentSession: ChatSession;
  private _messageHandlers: Map<string, (data: any) => void> = new Map();

  constructor(
    private readonly _extensionUri: vscode.Uri
  ) {
    // Create initial session
    this._currentSession = this.createNewSession();
  }

  /**
   * Create a new chat session
   */
  private createNewSession(): ChatSession {
    return {
      id: `session_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      title: 'New Conversation',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }

  /**
   * Resolve webview view
   */
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

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    // Handle messages from webview
    webviewView.webview.onDidReceiveMessage((data) => {
      switch (data.type) {
        case 'sendMessage':
          this.handleUserMessage(data.message);
          break;
        case 'newSession':
          this.handleNewSession();
          break;
        case 'loadSession':
          this.handleLoadSession(data.sessionId);
          break;
        case 'rollback':
          this.handleRollback(data.messageId);
          break;
        case 'viewFile':
          this.handleViewFile(data.filePath);
          break;
        case 'applyChanges':
          this.handleApplyChanges(data.messageId);
          break;
        case 'rejectChanges':
          this.handleRejectChanges(data.messageId);
          break;
        default:
          // Check custom handlers
          const handler = this._messageHandlers.get(data.type);
          if (handler) {
            handler(data);
          }
      }
    });

    // Restore session if available
    this.renderSession();
  }

  /**
   * Register a custom message handler
   */
  public onMessage(type: string, handler: (data: any) => void) {
    this._messageHandlers.set(type, handler);
  }

  /**
   * Add a message to the current session
   */
  public addMessage(message: Omit<ChatMessage, 'id' | 'timestamp'>): string {
    const fullMessage: ChatMessage = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      timestamp: Date.now()
    };

    this._currentSession.messages.push(fullMessage);
    this._currentSession.updatedAt = Date.now();

    // Update title if this is the first user message
    if (message.role === 'user' && this._currentSession.messages.filter(m => m.role === 'user').length === 1) {
      this._currentSession.title = message.content.substring(0, 50) + (message.content.length > 50 ? '...' : '');
    }

    this.renderSession();

    return fullMessage.id;
  }

  /**
   * Update an existing message
   */
  public updateMessage(messageId: string, updates: Partial<ChatMessage>) {
    const message = this._currentSession.messages.find(m => m.id === messageId);
    if (message) {
      Object.assign(message, updates);
      this.renderSession();
    }
  }

  /**
   * Handle user message from UI
   */
  private handleUserMessage(content: string) {
    // Add user message
    const messageId = this.addMessage({
      role: 'user',
      content
    });

    // Emit event for extension to handle
    const handler = this._messageHandlers.get('userMessage');
    if (handler) {
      handler({ messageId, content });
    }
  }

  /**
   * Handle new session request
   */
  private handleNewSession() {
    // Save current session if needed (TODO: implement session persistence)
    
    // Create new session
    this._currentSession = this.createNewSession();
    this.renderSession();

    vscode.window.showInformationMessage('Started new conversation');
  }

  /**
   * Handle load session request
   */
  private handleLoadSession(sessionId: string) {
    // TODO: Implement session loading from storage
    vscode.window.showInformationMessage(`Load session: ${sessionId}`);
  }

  /**
   * Handle rollback request
   */
  private handleRollback(messageId: string) {
    const handler = this._messageHandlers.get('rollback');
    if (handler) {
      handler({ messageId });
    }
  }

  /**
   * Handle view file request
   */
  private async handleViewFile(filePath: string) {
    try {
      const uri = vscode.Uri.file(filePath);
      const document = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(document);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open file: ${filePath}`);
    }
  }

  /**
   * Handle apply changes request
   */
  private handleApplyChanges(messageId: string) {
    const handler = this._messageHandlers.get('applyChanges');
    if (handler) {
      handler({ messageId });
    }
  }

  /**
   * Handle reject changes request
   */
  private handleRejectChanges(messageId: string) {
    const handler = this._messageHandlers.get('rejectChanges');
    if (handler) {
      handler({ messageId });
    }
  }

  /**
   * Render the current session
   */
  private renderSession() {
    if (!this._view) {
      return;
    }

    this._view.webview.postMessage({
      type: 'updateSession',
      session: this._currentSession
    });
  }

  /**
   * Get current session
   */
  public getCurrentSession(): ChatSession {
    return this._currentSession;
  }

  /**
   * Get HTML for webview
   */
  private getHtmlForWebview(webview: vscode.Webview): string {
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CodeMind Chat</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      background-color: var(--vscode-sideBar-background);
      height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* Header */
    .header {
      padding: 12px 16px;
      background-color: var(--vscode-sideBarSectionHeader-background);
      border-bottom: 1px solid var(--vscode-sideBarSectionHeader-border);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .header-title {
      font-weight: 600;
      font-size: 13px;
    }

    .header-actions {
      display: flex;
      gap: 8px;
    }

    .icon-button {
      background: none;
      border: none;
      color: var(--vscode-foreground);
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 16px;
      opacity: 0.8;
      transition: opacity 0.2s, background-color 0.2s;
    }

    .icon-button:hover {
      opacity: 1;
      background-color: var(--vscode-toolbar-hoverBackground);
    }

    /* Messages container */
    .messages-container {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .message {
      display: flex;
      flex-direction: column;
      gap: 8px;
      animation: slideIn 0.3s ease-out;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .message-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      opacity: 0.8;
    }

    .message-role {
      font-weight: 600;
      text-transform: capitalize;
    }

    .message-role.user {
      color: var(--vscode-charts-blue);
    }

    .message-role.assistant {
      color: var(--vscode-charts-green);
    }

    .message-role.system {
      color: var(--vscode-charts-orange);
    }

    .message-time {
      font-size: 11px;
      opacity: 0.6;
    }

    .message-content {
      background-color: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      padding: 12px;
      line-height: 1.5;
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    .message.user .message-content {
      background-color: var(--vscode-input-background);
    }

    .message-metadata {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .metadata-badge {
      background-color: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
    }

    .message-actions {
      display: flex;
      gap: 8px;
    }

    .action-button {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .action-button:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }

    .action-button.primary {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }

    .action-button.primary:hover {
      background-color: var(--vscode-button-hoverBackground);
    }

    /* Input area */
    .input-container {
      padding: 16px;
      background-color: var(--vscode-sideBar-background);
      border-top: 1px solid var(--vscode-panel-border);
    }

    .input-wrapper {
      display: flex;
      gap: 8px;
    }

    .input-field {
      flex: 1;
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      padding: 8px 12px;
      font-family: inherit;
      font-size: inherit;
      resize: none;
      min-height: 38px;
      max-height: 150px;
    }

    .input-field:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
    }

    .send-button {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 20px;
      cursor: pointer;
      transition: background-color 0.2s;
      align-self: flex-end;
    }

    .send-button:hover:not(:disabled) {
      background-color: var(--vscode-button-hoverBackground);
    }

    .send-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Empty state */
    .empty-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      padding: 32px;
      text-align: center;
      opacity: 0.6;
    }

    .empty-state-icon {
      font-size: 48px;
    }

    .empty-state-title {
      font-size: 16px;
      font-weight: 600;
    }

    .empty-state-description {
      font-size: 13px;
      line-height: 1.5;
      max-width: 300px;
    }

    /* Scrollbar */
    ::-webkit-scrollbar {
      width: 10px;
    }

    ::-webkit-scrollbar-track {
      background: var(--vscode-scrollbarSlider-background);
    }

    ::-webkit-scrollbar-thumb {
      background: var(--vscode-scrollbarSlider-hoverBackground);
      border-radius: 5px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: var(--vscode-scrollbarSlider-activeBackground);
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-title">CodeMind Orchestrator</div>
    <div class="header-actions">
      <button class="icon-button" id="newSessionBtn" title="New Conversation">➕</button>
      <button class="icon-button" id="sessionsBtn" title="Sessions">📋</button>
    </div>
  </div>

  <div class="messages-container" id="messagesContainer">
    <div class="empty-state">
      <div class="empty-state-icon">🤖</div>
      <div class="empty-state-title">Welcome to CodeMind Orchestrator</div>
      <div class="empty-state-description">
        Ask me to help with multi-file operations, refactoring, feature development, and more.
        I can plan, execute, and verify changes across your entire codebase.
      </div>
    </div>
  </div>

  <div class="input-container">
    <div class="input-wrapper">
      <textarea 
        class="input-field" 
        id="messageInput" 
        placeholder="Describe what you'd like to build or change..."
        rows="1"
      ></textarea>
      <button class="send-button" id="sendBtn" title="Send message">↑</button>
    </div>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const messagesContainer = document.getElementById('messagesContainer');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const newSessionBtn = document.getElementById('newSessionBtn');
    const sessionsBtn = document.getElementById('sessionsBtn');

    let currentSession = null;

    // Auto-resize textarea
    messageInput.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = (this.scrollHeight) + 'px';
    });

    // Send message
    function sendMessage() {
      const content = messageInput.value.trim();
      if (!content) return;

      vscode.postMessage({
        type: 'sendMessage',
        message: content
      });

      messageInput.value = '';
      messageInput.style.height = 'auto';
      sendBtn.disabled = true;
    }

    sendBtn.addEventListener('click', sendMessage);

    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    messageInput.addEventListener('input', () => {
      sendBtn.disabled = !messageInput.value.trim();
    });

    // New session
    newSessionBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'newSession' });
    });

    // Sessions list
    sessionsBtn.addEventListener('click', () => {
      vscode.postMessage({ type: 'showSessions' });
    });

    // Render session
    function renderSession(session) {
      currentSession = session;

      if (!session || session.messages.length === 0) {
        messagesContainer.innerHTML = \`
          <div class="empty-state">
            <div class="empty-state-icon">🤖</div>
            <div class="empty-state-title">Welcome to CodeMind Orchestrator</div>
            <div class="empty-state-description">
              Ask me to help with multi-file operations, refactoring, feature development, and more.
              I can plan, execute, and verify changes across your entire codebase.
            </div>
          </div>
        \`;
        return;
      }

      messagesContainer.innerHTML = '';

      session.messages.forEach(msg => {
        const messageEl = createMessageElement(msg);
        messagesContainer.appendChild(messageEl);
      });

      // Scroll to bottom
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Create message element
    function createMessageElement(message) {
      const div = document.createElement('div');
      div.className = \`message \${message.role}\`;

      const time = new Date(message.timestamp).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });

      let html = \`
        <div class="message-header">
          <span class="message-role \${message.role}">\${message.role}</span>
          <span class="message-time">\${time}</span>
        </div>
        <div class="message-content">\${escapeHtml(message.content)}</div>
      \`;

      if (message.metadata) {
        html += '<div class="message-metadata">';
        
        if (message.metadata.filesAffected) {
          html += \`<span class="metadata-badge">\${message.metadata.filesAffected.length} files</span>\`;
        }
        
        if (message.metadata.quality) {
          html += \`<span class="metadata-badge">Quality: \${(message.metadata.quality * 10).toFixed(1)}/10</span>\`;
        }
        
        html += '</div>';
      }

      if (message.role === 'assistant' && message.metadata?.filesAffected) {
        html += \`
          <div class="message-actions">
            <button class="action-button primary" onclick="applyChanges('\${message.id}')">Apply Changes</button>
            <button class="action-button" onclick="rejectChanges('\${message.id}')">Reject</button>
            <button class="action-button" onclick="viewDiff('\${message.id}')">View Diff</button>
          </div>
        \`;
      }

      div.innerHTML = html;
      return div;
    }

    // Message handlers
    window.applyChanges = (messageId) => {
      vscode.postMessage({ type: 'applyChanges', messageId });
    };

    window.rejectChanges = (messageId) => {
      vscode.postMessage({ type: 'rejectChanges', messageId });
    };

    window.viewDiff = (messageId) => {
      vscode.postMessage({ type: 'viewDiff', messageId });
    };

    window.viewFile = (filePath) => {
      vscode.postMessage({ type: 'viewFile', filePath });
    };

    // Escape HTML
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Handle messages from extension
    window.addEventListener('message', event => {
      const message = event.data;
      
      switch (message.type) {
        case 'updateSession':
          renderSession(message.session);
          break;
      }
    });

    // Focus input on load
    messageInput.focus();
  </script>
</body>
</html>`;
  }
}

