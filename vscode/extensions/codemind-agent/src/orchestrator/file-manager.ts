/**
 * File Manager
 * 
 * Handles multi-file operations with:
 * - Atomic transactions (all-or-nothing)
 * - Rollback support
 * - Conflict detection
 * - Backup creation
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { FileOperation, OperationResult, ExecutionPlan } from './types';

/**
 * Transaction state for atomic operations
 */
interface Transaction {
  id: string;
  timestamp: number;
  operations: FileOperation[];
  backups: Map<string, string>; // filePath -> backup content
  completed: FileOperation[];
  failed: FileOperation[];
}

/**
 * File Manager for safe multi-file operations
 */
export class FileManager {
  private activeTransaction: Transaction | null = null;
  private transactionHistory: Transaction[] = [];

  /**
   * Begin a new transaction
   */
  beginTransaction(operations: FileOperation[]): string {
    if (this.activeTransaction) {
      throw new Error('Transaction already in progress');
    }

    const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    this.activeTransaction = {
      id: transactionId,
      timestamp: Date.now(),
      operations,
      backups: new Map(),
      completed: [],
      failed: []
    };

    return transactionId;
  }

  /**
   * Execute all operations in the transaction
   */
  async executeTransaction(
    progressCallback?: (current: number, total: number, operation: FileOperation) => void
  ): Promise<OperationResult[]> {
    if (!this.activeTransaction) {
      throw new Error('No active transaction');
    }

    const tx = this.activeTransaction;
    const results: OperationResult[] = [];

    try {
      // Phase 1: Create backups for existing files
      await this.createBackups(tx);

      // Phase 2: Execute operations in order
      for (let i = 0; i < tx.operations.length; i++) {
        const operation = tx.operations[i];

        progressCallback?.(i + 1, tx.operations.length, operation);

        try {
          const result = await this.executeOperation(operation);
          results.push(result);

          if (result.success) {
            tx.completed.push(operation);
          } else {
            tx.failed.push(operation);
            // On failure, rollback and stop
            console.error(`[FileManager] Operation failed: ${result.error}`);
            await this.rollbackTransaction(tx);
            throw new Error(`Transaction failed: ${result.error}`);
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          results.push({
            success: false,
            operation,
            error: errorMsg
          });
          tx.failed.push(operation);
          await this.rollbackTransaction(tx);
          throw error;
        }
      }

      // Success: Commit transaction
      this.commitTransaction(tx);
      return results;
    } catch (error) {
      // Transaction failed - already rolled back
      this.activeTransaction = null;
      throw error;
    }
  }

  /**
   * Execute a single file operation
   */
  private async executeOperation(operation: FileOperation): Promise<OperationResult> {
    console.log(`[FileManager] Executing ${operation.type}: ${operation.filePath}`);

    try {
      switch (operation.type) {
        case 'create':
          return await this.createFile(operation);

        case 'modify':
          return await this.modifyFile(operation);

        case 'delete':
          return await this.deleteFile(operation);

        case 'rename':
          return await this.renameFile(operation);

        default:
          return {
            success: false,
            operation,
            error: `Unknown operation type: ${(operation as any).type}`
          };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        operation,
        error: errorMsg
      };
    }
  }

  /**
   * Create a new file
   */
  private async createFile(operation: FileOperation): Promise<OperationResult> {
    if (!operation.content) {
      return {
        success: false,
        operation,
        error: 'No content provided for create operation'
      };
    }

    const uri = vscode.Uri.file(operation.filePath);

    // Check if file already exists
    try {
      await vscode.workspace.fs.stat(uri);
      return {
        success: false,
        operation,
        error: 'File already exists'
      };
    } catch {
      // File doesn't exist - good, we can create it
    }

    // Create parent directories if needed
    const dirUri = vscode.Uri.file(path.dirname(operation.filePath));
    await vscode.workspace.fs.createDirectory(dirUri);

    // Write file
    const encoder = new TextEncoder();
    await vscode.workspace.fs.writeFile(uri, encoder.encode(operation.content));

    const lineCount = operation.content.split('\n').length;

    return {
      success: true,
      operation,
      changes: {
        linesAdded: lineCount,
        linesRemoved: 0,
        linesModified: 0
      }
    };
  }

  /**
   * Modify an existing file
   */
  private async modifyFile(operation: FileOperation): Promise<OperationResult> {
    if (!operation.content) {
      return {
        success: false,
        operation,
        error: 'No content provided for modify operation'
      };
    }

    const uri = vscode.Uri.file(operation.filePath);

    // Verify file exists
    try {
      await vscode.workspace.fs.stat(uri);
    } catch {
      return {
        success: false,
        operation,
        error: 'File does not exist'
      };
    }

    // Read current content (already backed up in createBackups phase)
    const decoder = new TextDecoder();
    const fileData = await vscode.workspace.fs.readFile(uri);
    const oldContent = decoder.decode(fileData);

    // Write new content
    const encoder = new TextEncoder();
    await vscode.workspace.fs.writeFile(uri, encoder.encode(operation.content));

    // Calculate changes
    const oldLines = oldContent.split('\n');
    const newLines = operation.content.split('\n');
    const changes = this.calculateDiff(oldLines, newLines);

    return {
      success: true,
      operation,
      changes
    };
  }

  /**
   * Delete a file
   */
  private async deleteFile(operation: FileOperation): Promise<OperationResult> {
    const uri = vscode.Uri.file(operation.filePath);

    // Verify file exists
    try {
      await vscode.workspace.fs.stat(uri);
    } catch {
      return {
        success: false,
        operation,
        error: 'File does not exist'
      };
    }

    // Delete file
    await vscode.workspace.fs.delete(uri);

    return {
      success: true,
      operation,
      changes: {
        linesAdded: 0,
        linesRemoved: 0,
        linesModified: 0
      }
    };
  }

  /**
   * Rename a file
   */
  private async renameFile(operation: FileOperation): Promise<OperationResult> {
    if (!operation.newPath) {
      return {
        success: false,
        operation,
        error: 'No new path provided for rename operation'
      };
    }

    const oldUri = vscode.Uri.file(operation.filePath);
    const newUri = vscode.Uri.file(operation.newPath);

    // Verify source exists
    try {
      await vscode.workspace.fs.stat(oldUri);
    } catch {
      return {
        success: false,
        operation,
        error: 'Source file does not exist'
      };
    }

    // Verify target doesn't exist
    try {
      await vscode.workspace.fs.stat(newUri);
      return {
        success: false,
        operation,
        error: 'Target file already exists'
      };
    } catch {
      // Good - target doesn't exist
    }

    // Create parent directory for new path if needed
    const newDir = vscode.Uri.file(path.dirname(operation.newPath));
    await vscode.workspace.fs.createDirectory(newDir);

    // Rename file
    await vscode.workspace.fs.rename(oldUri, newUri);

    return {
      success: true,
      operation,
      changes: {
        linesAdded: 0,
        linesRemoved: 0,
        linesModified: 0
      }
    };
  }

  /**
   * Create backups for all files that will be modified/deleted
   */
  private async createBackups(tx: Transaction): Promise<void> {
    const decoder = new TextDecoder();

    for (const operation of tx.operations) {
      if (operation.type === 'modify' || operation.type === 'delete') {
        try {
          const uri = vscode.Uri.file(operation.filePath);
          const fileData = await vscode.workspace.fs.readFile(uri);
          const content = decoder.decode(fileData);
          tx.backups.set(operation.filePath, content);
        } catch (error) {
          console.warn(`[FileManager] Could not backup ${operation.filePath}:`, error);
          // File might not exist yet - that's okay for some operations
        }
      }
    }

    console.log(`[FileManager] Created ${tx.backups.size} backups`);
  }

  /**
   * Rollback a failed transaction
   */
  private async rollbackTransaction(tx: Transaction): Promise<void> {
    console.log(`[FileManager] Rolling back transaction ${tx.id}`);

    const encoder = new TextEncoder();

    // Reverse operations in reverse order
    for (let i = tx.completed.length - 1; i >= 0; i--) {
      const operation = tx.completed[i];

      try {
        switch (operation.type) {
          case 'create':
            // Delete the created file
            await vscode.workspace.fs.delete(vscode.Uri.file(operation.filePath));
            break;

          case 'modify':
            // Restore from backup
            const backup = tx.backups.get(operation.filePath);
            if (backup) {
              await vscode.workspace.fs.writeFile(
                vscode.Uri.file(operation.filePath),
                encoder.encode(backup)
              );
            }
            break;

          case 'delete':
            // Restore from backup
            const deletedContent = tx.backups.get(operation.filePath);
            if (deletedContent) {
              await vscode.workspace.fs.writeFile(
                vscode.Uri.file(operation.filePath),
                encoder.encode(deletedContent)
              );
            }
            break;

          case 'rename':
            // Rename back
            if (operation.newPath) {
              await vscode.workspace.fs.rename(
                vscode.Uri.file(operation.newPath),
                vscode.Uri.file(operation.filePath)
              );
            }
            break;
        }
      } catch (error) {
        console.error(`[FileManager] Failed to rollback operation:`, error);
        // Continue rolling back other operations
      }
    }

    console.log(`[FileManager] Rollback complete`);
  }

  /**
   * Commit a successful transaction
   */
  private commitTransaction(tx: Transaction): void {
    console.log(`[FileManager] Committing transaction ${tx.id}`);
    this.transactionHistory.push(tx);
    this.activeTransaction = null;

    // Keep only last 10 transactions
    if (this.transactionHistory.length > 10) {
      this.transactionHistory.shift();
    }
  }

  /**
   * Calculate diff between old and new content
   */
  private calculateDiff(
    oldLines: string[],
    newLines: string[]
  ): { linesAdded: number; linesRemoved: number; linesModified: number } {
    // Simple diff calculation
    // For a proper implementation, consider using a diff library like 'diff'

    const maxLen = Math.max(oldLines.length, newLines.length);
    let added = 0;
    let removed = 0;
    let modified = 0;

    if (newLines.length > oldLines.length) {
      added = newLines.length - oldLines.length;
    } else if (oldLines.length > newLines.length) {
      removed = oldLines.length - newLines.length;
    }

    for (let i = 0; i < Math.min(oldLines.length, newLines.length); i++) {
      if (oldLines[i] !== newLines[i]) {
        modified++;
      }
    }

    return { linesAdded: added, linesRemoved: removed, linesModified: modified };
  }

  /**
   * Get transaction history
   */
  getHistory(): Transaction[] {
    return [...this.transactionHistory];
  }

  /**
   * Check if a transaction is in progress
   */
  hasActiveTransaction(): boolean {
    return this.activeTransaction !== null;
  }
}

