/**
 * Inline Diff Viewer - Shows changes directly in the editor with decorations
 * Provides a beautiful, GitHub-style inline diff experience
 */

import * as vscode from 'vscode';

interface DiffLine {
  type: 'unchanged' | 'added' | 'removed' | 'modified';
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
}

export class InlineDiffViewer {
  private static addedDecorationType: vscode.TextEditorDecorationType;
  private static removedDecorationType: vscode.TextEditorDecorationType;
  private static modifiedDecorationType: vscode.TextEditorDecorationType;
  private static currentDecorations: vscode.TextEditorDecorationType[] = [];
  
  /**
   * Initialize decoration types
   */
  public static initialize() {
    // Green background for added lines
    this.addedDecorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: new vscode.ThemeColor('diffEditor.insertedTextBackground'),
      isWholeLine: true,
      overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.addedForeground'),
      overviewRulerLane: vscode.OverviewRulerLane.Left,
      gutterIconPath: vscode.Uri.parse('data:image/svg+xml;base64,' + Buffer.from(`
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
          <rect width="16" height="16" fill="#10b981" opacity="0.6"/>
          <text x="8" y="12" font-size="12" fill="white" text-anchor="middle" font-family="Arial">+</text>
        </svg>
      `).toString('base64')),
      gutterIconSize: 'contain'
    });

    // Red background for removed lines (shown as strikethrough)
    this.removedDecorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: new vscode.ThemeColor('diffEditor.removedTextBackground'),
      isWholeLine: true,
      overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.deletedForeground'),
      overviewRulerLane: vscode.OverviewRulerLane.Left,
      textDecoration: 'line-through',
      opacity: '0.6',
      gutterIconPath: vscode.Uri.parse('data:image/svg+xml;base64,' + Buffer.from(`
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
          <rect width="16" height="16" fill="#ef4444" opacity="0.6"/>
          <text x="8" y="12" font-size="12" fill="white" text-anchor="middle" font-family="Arial">-</text>
        </svg>
      `).toString('base64')),
      gutterIconSize: 'contain'
    });

    // Yellow/orange for modified lines
    this.modifiedDecorationType = vscode.window.createTextEditorDecorationType({
      backgroundColor: new vscode.ThemeColor('diffEditor.insertedTextBackground'),
      isWholeLine: true,
      overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.modifiedForeground'),
      overviewRulerLane: vscode.OverviewRulerLane.Left,
      gutterIconPath: vscode.Uri.parse('data:image/svg+xml;base64,' + Buffer.from(`
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
          <rect width="16" height="16" fill="#f59e0b" opacity="0.6"/>
          <text x="8" y="12" font-size="12" fill="white" text-anchor="middle" font-family="Arial">~</text>
        </svg>
      `).toString('base64')),
      gutterIconSize: 'contain'
    });

    this.currentDecorations = [
      this.addedDecorationType,
      this.removedDecorationType,
      this.modifiedDecorationType
    ];
  }

  /**
   * Show inline diff in the editor
   * Temporarily applies changes with decorations so user can see them
   */
  public static async showInlineDiff(
    editor: vscode.TextEditor,
    selectionRange: vscode.Range,
    originalCode: string,
    newCode: string
  ): Promise<void> {
    if (!this.addedDecorationType) {
      this.initialize();
    }

    // Apply the new code to the editor (but don't save)
    const edit = new vscode.WorkspaceEdit();
    edit.replace(editor.document.uri, selectionRange, newCode);
    await vscode.workspace.applyEdit(edit);

    // Calculate line-by-line diff
    const originalLines = originalCode.split('\n');
    const newLines = newCode.split('\n');
    const startLine = selectionRange.start.line;

    // Simple line-by-line diff (can be enhanced with better diff algorithm)
    const addedRanges: vscode.Range[] = [];
    const removedRanges: vscode.Range[] = [];
    const modifiedRanges: vscode.Range[] = [];

    const maxLines = Math.max(originalLines.length, newLines.length);
    let currentLine = startLine;

    for (let i = 0; i < maxLines; i++) {
      const oldLine = originalLines[i];
      const newLine = newLines[i];
      const lineRange = new vscode.Range(currentLine, 0, currentLine, Number.MAX_SAFE_INTEGER);

      if (oldLine === undefined && newLine !== undefined) {
        // Added line
        addedRanges.push(lineRange);
        currentLine++;
      } else if (oldLine !== undefined && newLine === undefined) {
        // Removed line (show in old position, but it's already gone)
        // We can't show this easily in inline mode
      } else if (oldLine !== newLine) {
        // Modified line
        modifiedRanges.push(lineRange);
        currentLine++;
      } else {
        // Unchanged
        currentLine++;
      }
    }

    // Apply decorations
    editor.setDecorations(this.addedDecorationType, addedRanges);
    editor.setDecorations(this.modifiedDecorationType, modifiedRanges);

    // Show info message with actions
    const choice = await vscode.window.showInformationMessage(
      `CodeMind: Preview changes applied (${addedRanges.length + modifiedRanges.length} lines changed). Quality: ${await this.getQualityScore()}/10`,
      { modal: false },
      'Accept',
      'Reject'
    );

    if (choice === 'Accept') {
      // User accepted - save the document
      await editor.document.save();
      this.clearDecorations(editor);
      vscode.window.showInformationMessage('✓ Changes accepted and saved!');
    } else if (choice === 'Reject') {
      // User rejected - undo the changes
      await vscode.commands.executeCommand('undo');
      this.clearDecorations(editor);
      vscode.window.showInformationMessage('Changes rejected.');
    }
  }

  /**
   * Show diff with custom UI overlay (buttons in editor)
   */
  public static async showInlineDiffWithButtons(
    editor: vscode.TextEditor,
    selectionRange: vscode.Range,
    originalCode: string,
    newCode: string,
    qualityScore: number,
    onAccept: () => Promise<void>,
    onReject: () => Promise<void>
  ): Promise<void> {
    if (!this.addedDecorationType) {
      this.initialize();
    }

    // Store original content for undo
    const originalContent = editor.document.getText();
    const originalPosition = editor.selection;

    // Apply the new code (but don't save)
    await editor.edit(editBuilder => {
      editBuilder.replace(selectionRange, newCode);
    });

    // Calculate and apply decorations
    const originalLines = originalCode.split('\n');
    const newLines = newCode.split('\n');
    const startLine = selectionRange.start.line;

    const addedRanges: vscode.Range[] = [];
    const modifiedRanges: vscode.Range[] = [];

    const maxLines = Math.max(originalLines.length, newLines.length);
    let currentLine = startLine;

    for (let i = 0; i < newLines.length; i++) {
      const oldLine = originalLines[i];
      const newLine = newLines[i];
      const lineRange = new vscode.Range(currentLine, 0, currentLine, Number.MAX_SAFE_INTEGER);

      if (i >= originalLines.length) {
        // New line added
        addedRanges.push(lineRange);
      } else if (oldLine !== newLine) {
        // Modified line
        modifiedRanges.push(lineRange);
      }

      currentLine++;
    }

    // Apply decorations
    editor.setDecorations(this.addedDecorationType, addedRanges);
    editor.setDecorations(this.modifiedDecorationType, modifiedRanges);

    // Scroll to show the changes
    editor.revealRange(
      new vscode.Range(startLine, 0, startLine + newLines.length, 0),
      vscode.TextEditorRevealType.InCenter
    );

    // Store for later use
    const rejectChanges = async () => {
      // Undo to restore original
      await vscode.commands.executeCommand('undo');
      this.clearDecorations(editor);
      await onReject();
    };

    const acceptChanges = async () => {
      // Keep changes and save
      await editor.document.save();
      this.clearDecorations(editor);
      await onAccept();
    };

    // Register temporary commands for Accept/Reject
    return new Promise<void>((resolve) => {
      const acceptCmd = vscode.commands.registerCommand('codemind.acceptInlineDiff', async () => {
        await acceptChanges();
        acceptCmd.dispose();
        rejectCmd.dispose();
        resolve();
      });

      const rejectCmd = vscode.commands.registerCommand('codemind.rejectInlineDiff', async () => {
        await rejectChanges();
        acceptCmd.dispose();
        rejectCmd.dispose();
        resolve();
      });

      // Show notification with buttons
      vscode.window.showInformationMessage(
        `CodeMind: Changes applied (Quality: ${qualityScore.toFixed(1)}/10). Review and decide.`,
        { modal: false },
        'Accept & Save',
        'Reject & Undo'
      ).then(async choice => {
        if (choice === 'Accept & Save') {
          await acceptChanges();
        } else if (choice === 'Reject & Undo') {
          await rejectChanges();
        } else {
          // User dismissed - leave in preview state
          vscode.window.showInformationMessage(
            'CodeMind: Changes still in preview. Use Ctrl+Z to undo or Ctrl+S to save.',
            'Accept & Save',
            'Reject & Undo'
          ).then(async retryChoice => {
            if (retryChoice === 'Accept & Save') {
              await acceptChanges();
            } else if (retryChoice === 'Reject & Undo') {
              await rejectChanges();
            }
          });
        }
        acceptCmd.dispose();
        rejectCmd.dispose();
        resolve();
      });
    });
  }

  /**
   * Clear all diff decorations
   */
  public static clearDecorations(editor: vscode.TextEditor) {
    if (this.currentDecorations) {
      this.currentDecorations.forEach(decoration => {
        editor.setDecorations(decoration, []);
      });
    }
  }

  /**
   * Dispose all decorations
   */
  public static dispose() {
    if (this.currentDecorations) {
      this.currentDecorations.forEach(decoration => decoration.dispose());
    }
  }

  private static qualityScoreCache: number = 0;
  private static async getQualityScore(): Promise<number> {
    return this.qualityScoreCache;
  }
  
  public static setQualityScore(score: number) {
    this.qualityScoreCache = score;
  }
}


