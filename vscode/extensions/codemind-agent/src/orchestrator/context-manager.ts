/**
 * Workspace Context Manager
 * 
 * Gathers context from the workspace:
 * - Current file and selection
 * - Open files
 * - Recent files
 * - Project files
 * - Git status
 * - Diagnostics
 */

import * as vscode from 'vscode';
import { WorkspaceContext } from './types';

/**
 * Context Manager for gathering workspace information
 */
export class ContextManager {
  constructor(
    private readonly workspaceRoot: string
  ) {}

  /**
   * Gather complete workspace context
   */
  async gatherContext(): Promise<WorkspaceContext> {
    const currentFile = await this.getCurrentFile();
    const openFiles = this.getOpenFiles();
    const recentFiles = this.getRecentFiles();
    const gitStatus = await this.getGitStatus();
    const diagnostics = this.getDiagnostics();

    return {
      workspaceRoot: this.workspaceRoot,
      currentFile,
      openFiles,
      recentFiles,
      gitStatus,
      diagnostics
    };
  }

  /**
   * Get current active file with selection
   */
  private async getCurrentFile(): Promise<WorkspaceContext['currentFile']> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return undefined;
    }

    const document = editor.document;
    const selection = editor.selection;

    let selectionInfo: 
      | {
          start: { line: number; character: number };
          end: { line: number; character: number };
          text: string;
        }
      | undefined;
    
    if (!selection.isEmpty) {
      selectionInfo = {
        start: {
          line: selection.start.line,
          character: selection.start.character
        },
        end: {
          line: selection.end.line,
          character: selection.end.character
        },
        text: document.getText(selection)
      };
    }

    return {
      path: document.uri.fsPath,
      content: document.getText(),
      language: document.languageId,
      selection: selectionInfo
    };
  }

  /**
   * Get all currently open files
   */
  private getOpenFiles(): string[] {
    return vscode.window.visibleTextEditors
      .map(editor => editor.document.uri.fsPath)
      .filter((path, index, self) => self.indexOf(path) === index); // Unique
  }

  /**
   * Get recently opened files
   * Note: This is a simplified implementation
   * VSCode doesn't provide a direct API for this
   */
  private getRecentFiles(): string[] {
    // For now, just return open files
    // TODO: Implement proper recent files tracking
    return this.getOpenFiles();
  }

  /**
   * Get Git status for the workspace
   */
  private async getGitStatus(): Promise<WorkspaceContext['gitStatus']> {
    try {
      const gitExtension = vscode.extensions.getExtension('vscode.git');
      if (!gitExtension) {
        return undefined;
      }

      const git = gitExtension.exports.getAPI(1);
      if (!git) {
        return undefined;
      }

      const repositories = git.repositories;
      if (repositories.length === 0) {
        return undefined;
      }

      const repo = repositories[0];
      const state = repo.state;

      return {
        branch: state.HEAD?.name || 'unknown',
        modified: state.workingTreeChanges.map((change: any) => change.uri.fsPath),
        staged: state.indexChanges.map((change: any) => change.uri.fsPath),
        untracked: state.workingTreeChanges
          .filter((change: any) => change.status === 7) // Untracked
          .map((change: any) => change.uri.fsPath)
      };
    } catch (error) {
      console.warn('[ContextManager] Failed to get git status:', error);
      return undefined;
    }
  }

  /**
   * Get diagnostics (errors/warnings) for all files
   */
  private getDiagnostics(): Map<string, any[]> {
    const diagnosticsMap = new Map<string, any[]>();

    for (const document of vscode.workspace.textDocuments) {
      const diagnostics = vscode.languages.getDiagnostics(document.uri);
      if (diagnostics.length > 0) {
        diagnosticsMap.set(
          document.uri.fsPath,
          diagnostics.map(d => ({
            line: d.range.start.line,
            character: d.range.start.character,
            severity: this.mapSeverity(d.severity),
            message: d.message,
            source: d.source,
            code: d.code
          }))
        );
      }
    }

    return diagnosticsMap;
  }

  /**
   * Map VSCode diagnostic severity to our format
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
   * Get context for specific files
   */
  async getFileContext(filePaths: string[]): Promise<Map<string, string>> {
    const fileContents = new Map<string, string>();

    for (const filePath of filePaths) {
      try {
        const uri = vscode.Uri.file(filePath);
        const document = await vscode.workspace.openTextDocument(uri);
        fileContents.set(filePath, document.getText());
      } catch (error) {
        console.warn(`[ContextManager] Failed to read file ${filePath}:`, error);
      }
    }

    return fileContents;
  }

  /**
   * Search for files matching a pattern
   */
  async findFiles(pattern: string, maxResults: number = 100): Promise<string[]> {
    try {
      const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', maxResults);
      return files.map(uri => uri.fsPath);
    } catch (error) {
      console.warn(`[ContextManager] Failed to find files matching ${pattern}:`, error);
      return [];
    }
  }
}

