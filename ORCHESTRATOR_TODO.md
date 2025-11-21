# CodeMind Orchestrator + Chat Interface - Comprehensive TODO

## 🎯 Goal
Build the primary interface for CodeMind: A "Cursor Composer" analog with an Orchestrator agent that handles complex, multi-file tasks through a chat interface with full git integration for instant rollback.

---

## Phase 1: Foundation & Architecture (Week 1)

### 1.1 Orchestrator Agent Core
- [ ] Create `src/agents/orchestrator-agent.ts`
- [ ] Define `OrchestratorCapability` enum (task_analysis, file_planning, code_generation, verification, rollback)
- [ ] Implement `TaskDecomposition` interface (steps, dependencies, estimated_files, risks)
- [ ] Implement `analyzeTask()` - Break complex requests into steps
- [ ] Implement `planFiles()` - Identify which files to create/modify/delete
- [ ] Implement `coordinateAgents()` - Run specialists on each file change
- [ ] Implement `verifyResults()` - Check compilation, linting, tests
- [ ] Add `ExecutionPlan` type (files, operations, dependencies, order)
- [ ] Add `OrchestratorResult` type (success, changes, verification, rollback_point)

### 1.2 File Operation System
- [ ] Create `src/file-operations/file-manager.ts`
- [ ] Implement `FileOperation` type (create, modify, delete, rename, move)
- [ ] Implement `FileChange` interface (path, operation, before, after, diff)
- [ ] Implement `planFileChanges()` - Generate atomic changeset
- [ ] Implement `applyFileChanges()` - Execute all changes atomically
- [ ] Implement `validateFileChanges()` - Check for conflicts
- [ ] Implement `revertFileChanges()` - Undo all changes
- [ ] Add file conflict detection (check if files changed since planning)
- [ ] Add workspace safety checks (don't modify .git, node_modules, etc.)

### 1.3 Multi-File Diff System
- [ ] Create `src/ui/multi-file-diff-panel.ts`
- [ ] Design UI to show all file changes in one view
- [ ] Implement file tree view (grouped by directory)
- [ ] Implement inline diff viewer per file
- [ ] Add expand/collapse for each file
- [ ] Add statistics (files changed, lines added/removed)
- [ ] Add "Accept All" / "Reject All" / "Accept File" / "Reject File" buttons
- [ ] Add search/filter for changed files
- [ ] Add syntax highlighting in diff view

---

## Phase 2: Git Integration & Rollback System (Week 1-2)

### 2.1 Git Worktree Integration
- [ ] Create `src/git/worktree-manager.ts`
- [ ] Research VSCode Git extension API
- [ ] Implement `createSnapshot()` - Create git worktree for current state
- [ ] Implement `listSnapshots()` - Show all saved worktree snapshots
- [ ] Implement `restoreSnapshot()` - Switch to previous worktree
- [ ] Implement `deleteSnapshot()` - Clean up old worktrees
- [ ] Add snapshot metadata (timestamp, prompt, files_changed, success)
- [ ] Integrate with VSCode source control API
- [ ] Handle git worktree creation/deletion safely
- [ ] Add UI indicators for which snapshot you're on

### 2.2 Session Management
- [ ] Create `src/session/session-manager.ts`
- [ ] Implement `Session` interface (id, messages, snapshots, context_files)
- [ ] Implement `createSession()` - Start new conversation
- [ ] Implement `saveSession()` - Persist to disk (.codemind/sessions/)
- [ ] Implement `loadSession()` - Restore previous conversation
- [ ] Implement `SessionMessage` type (user/assistant, timestamp, changes, snapshot_id)
- [ ] Add session history sidebar view
- [ ] Link each message to its git snapshot
- [ ] Implement session branching (fork from message N)

### 2.3 Rollback & Time Travel
- [ ] Create `src/git/time-travel.ts`
- [ ] Implement "Rollback to this point" button on each chat message
- [ ] Implement `rollbackToMessage()` - Restore files + chat history
- [ ] Implement `replayFromMessage()` - Re-run subsequent prompts
- [ ] Add confirmation dialog before rollback
- [ ] Show diff between current state and rollback point
- [ ] Handle merge conflicts if files changed manually
- [ ] Add "Compare with snapshot" feature

---

## Phase 3: Chat Interface UI (Week 2)

### 3.1 Chat Sidebar Panel
- [ ] Create `src/ui/chat-panel.ts`
- [ ] Design beautiful chat UI (message bubbles, avatars, timestamps)
- [ ] Implement `ChatMessage` component (user/assistant/system/error)
- [ ] Implement message input (textarea with auto-resize)
- [ ] Implement message history scroll (virtualized for performance)
- [ ] Add "New Conversation" button
- [ ] Add "Session History" dropdown
- [ ] Add settings gear icon (model selection, quality threshold, etc.)
- [ ] Add stop button for cancelling long-running tasks

### 3.2 Chat Message Components
- [ ] Implement markdown rendering for assistant messages
- [ ] Implement code block rendering with syntax highlighting
- [ ] Add file path badges above code blocks
- [ ] Add "Apply this change" button per code block
- [ ] Add "Copy" button for code blocks
- [ ] Add "View Full Diff" button for multi-file changes
- [ ] Implement collapsible agent analysis sections
- [ ] Add loading indicators (typing animation, progress bar)

### 3.3 Progress & Status Indicators
- [ ] Create `src/ui/orchestrator-progress.ts`
- [ ] Show real-time orchestrator status:
  - [ ] "Analyzing task..." (with spinner)
  - [ ] "Planning files..." (show file count)
  - [ ] "Running architect agent on UserController.ts..." (agent + file)
  - [ ] "Synthesizing changes..." (iteration count)
  - [ ] "Verifying compilation..." (with diagnostics count)
- [ ] Add progress bar (0-100% based on steps completed)
- [ ] Show agent confidence scores in real-time
- [ ] Add expandable detailed logs section
- [ ] Add cancel button at any stage

### 3.4 Interactive Features
- [ ] Implement "Modify this plan" button (edit before applying)
- [ ] Implement "Explain this change" button (ask orchestrator why)
- [ ] Implement "Add constraint" (e.g., "don't modify tests")
- [ ] Implement file selection (user picks which files to include in context)
- [ ] Add @file mention support (e.g., "@UserController.ts add validation")
- [ ] Add @workspace mention (include all relevant files)

---

## Phase 4: Context Management (Week 2-3)

### 4.1 Workspace Context
- [ ] Create `src/context/workspace-context.ts`
- [ ] Implement file indexing (scan workspace for code files)
- [ ] Implement symbol extraction (functions, classes, imports)
- [ ] Implement dependency graph (which files import which)
- [ ] Implement relevance scoring (which files relevant to task)
- [ ] Auto-gather related files (if modifying UserController, include User model)
- [ ] Add "Context Files" panel in chat sidebar
- [ ] Show why each file was included in context
- [ ] Let user add/remove files from context

### 4.2 Conversation Context
- [ ] Create `src/context/conversation-context.ts`
- [ ] Track previous changes in conversation
- [ ] Track user preferences mentioned ("use TypeScript", "follow AirBnB style")
- [ ] Track decisions made ("we decided to use JWT not sessions")
- [ ] Implement context pruning (summarize old messages to save tokens)
- [ ] Pass conversation context to orchestrator
- [ ] Highlight when orchestrator uses previous context

### 4.3 AST Parsing (Future-proof)
- [ ] Create `src/context/ast-parser.ts` (placeholder for now)
- [ ] Research Tree-sitter for multi-language AST
- [ ] Define `ASTNode` interface
- [ ] Plan for semantic code understanding (later phase)
- [ ] Plan for intelligent code insertion points (later phase)

---

## Phase 5: Orchestrator Logic Implementation (Week 3)

### 5.1 Task Analysis Phase
- [ ] Implement prompt for task decomposition
- [ ] Identify task type (feature, bugfix, refactor, docs, tests)
- [ ] Break into subtasks with dependencies
- [ ] Estimate complexity (simple/medium/complex)
- [ ] Identify risks (breaking changes, test coverage, etc.)
- [ ] Generate step-by-step execution plan
- [ ] Show plan to user for approval

### 5.2 File Planning Phase
- [ ] Implement prompt for file identification
- [ ] Analyze workspace structure
- [ ] Determine files to create (with paths)
- [ ] Determine files to modify (with reasons)
- [ ] Determine files to delete (with confirmation)
- [ ] Check for naming conflicts
- [ ] Validate file paths (no overwrites of critical files)
- [ ] Generate dependency order (Model before Controller)

### 5.3 Code Generation Phase
- [ ] For each file operation:
  - [ ] Load file context (existing content + related files)
  - [ ] Run specialist agents (with task-specific prompts)
  - [ ] Run ODAI synthesis
  - [ ] Generate code with full context
  - [ ] Validate generated code (syntax, imports, types)
- [ ] Parallelize independent file operations
- [ ] Sequential processing for dependent files
- [ ] Handle errors gracefully (continue with other files)

### 5.4 Verification Phase
- [ ] Create `src/orchestrator/verifier.ts`
- [ ] Implement `verifyCompilation()` - Check TypeScript/compiler errors
- [ ] Implement `verifyLinting()` - Check linter errors
- [ ] Implement `verifyTests()` - Run tests if test runner available
- [ ] Implement `verifyImports()` - Check all imports resolve
- [ ] Show verification results in chat
- [ ] If failures, ask orchestrator to fix
- [ ] Implement N² loop at orchestrator level (iterate until verified)

---

## Phase 6: Advanced Features (Week 3-4)

### 6.1 Iterative Refinement
- [ ] Implement "Try again with..." for failed attempts
- [ ] Implement "Make this change..." for partial modifications
- [ ] Track refinement history (attempt 1, 2, 3...)
- [ ] Learn from failed attempts (pass error messages to orchestrator)
- [ ] Implement automatic retry with error context

### 6.2 Change Preview & Approval
- [ ] Create `src/ui/approval-dialog.ts`
- [ ] Show full change summary before applying
- [ ] List all files affected
- [ ] Show key decisions made
- [ ] Show risks identified
- [ ] Add "Apply", "Modify Plan", "Cancel" buttons
- [ ] Implement partial approval (select files to apply)
- [ ] Add "Explain this change" per file

### 6.3 Terminal Integration
- [ ] Create `src/terminal/terminal-manager.ts`
- [ ] Implement `runCommand()` - Execute shell commands
- [ ] Run tests via terminal
- [ ] Run builds via terminal
- [ ] Run linters via terminal
- [ ] Capture output and show in chat
- [ ] Handle long-running commands (with cancel)
- [ ] Show real-time terminal output

### 6.4 Diagnostics Integration
- [ ] Create `src/diagnostics/diagnostics-tracker.ts`
- [ ] Monitor VSCode diagnostics API
- [ ] Track errors before and after changes
- [ ] Show "Fixed X errors, introduced Y errors"
- [ ] If new errors, auto-trigger fix attempt
- [ ] Link diagnostics to specific changes
- [ ] Show diagnostics in chat messages

---

## Phase 7: Git Advanced Features (Week 4)

### 7.1 Commit Management
- [ ] Create `src/git/commit-manager.ts`
- [ ] Auto-generate commit messages from changes
- [ ] Let orchestrator write semantic commit messages
- [ ] Implement "Commit these changes" button
- [ ] Support conventional commits format
- [ ] Add commit preview before committing
- [ ] Handle staged vs. unstaged changes

### 7.2 Branch Management
- [ ] Implement "Create branch for this task" option
- [ ] Auto-name branches based on task
- [ ] Switch branches safely (stash changes if needed)
- [ ] Show current branch in chat header
- [ ] Warn if working directory not clean

### 7.3 Diff & History
- [ ] Integrate with VSCode SCM API
- [ ] Show git diff in chat for applied changes
- [ ] Link to VSCode's native diff viewer
- [ ] Show file history (git blame)
- [ ] Compare snapshots with git diff

---

## Phase 8: Polish & UX (Week 4-5)

### 8.1 Error Handling
- [ ] Create `src/error/error-handler.ts`
- [ ] Beautiful error messages in chat
- [ ] Classify errors (LLM, syntax, file system, git)
- [ ] Suggest fixes for common errors
- [ ] Add "Report Bug" button for unexpected errors
- [ ] Implement graceful degradation (continue with partial results)

### 8.2 Performance Optimization
- [ ] Implement caching for file reads
- [ ] Implement caching for AST parsing
- [ ] Implement caching for LLM responses (if same prompt)
- [ ] Lazy load chat history (paginate old messages)
- [ ] Virtualize file diff list (only render visible)
- [ ] Debounce user input
- [ ] Show estimated time for operations

### 8.3 Settings & Configuration
- [ ] Create settings UI in chat sidebar
- [ ] Add model selection (Grok, Claude, Llama, Gemini)
- [ ] Add quality threshold slider
- [ ] Add max iterations slider
- [ ] Add "Include tests" toggle
- [ ] Add "Auto-commit" toggle
- [ ] Add "Auto-verify" toggle
- [ ] Persist settings per workspace

### 8.4 Keyboard Shortcuts
- [ ] Register `Ctrl+Shift+C` - Open chat sidebar
- [ ] Register `Ctrl+Shift+N` - New conversation
- [ ] Register `Ctrl+Enter` - Send message
- [ ] Register `Escape` - Cancel operation
- [ ] Register `Ctrl+Shift+R` - Rollback to last snapshot

---

## Phase 9: Testing & Documentation (Week 5)

### 9.1 Unit Tests
- [ ] Set up Jest/Mocha for extension tests
- [ ] Test orchestrator task decomposition
- [ ] Test file operation planning
- [ ] Test git worktree operations
- [ ] Test session management
- [ ] Test context gathering
- [ ] Test message parsing

### 9.2 Integration Tests
- [ ] Test full orchestrator flow (task → files → apply)
- [ ] Test rollback scenarios
- [ ] Test multi-file changes
- [ ] Test error recovery
- [ ] Test conversation branching

### 9.3 User Documentation
- [ ] Write USER_GUIDE.md
- [ ] Document chat interface features
- [ ] Document rollback system
- [ ] Document @mentions
- [ ] Create video walkthrough
- [ ] Create example prompts guide

### 9.4 Developer Documentation
- [ ] Document orchestrator architecture
- [ ] Document extension points for new agents
- [ ] Document git integration approach
- [ ] Document session storage format
- [ ] Create contributor guide

---

## Phase 10: Launch Preparation (Week 5-6)

### 10.1 Icon & Branding
- [ ] Create chat sidebar icon (SVG)
- [ ] Update activity bar icon
- [ ] Create loading animations
- [ ] Create success/error icons
- [ ] Design color scheme (consistent with VSCode)

### 10.2 Onboarding
- [ ] Create welcome message on first launch
- [ ] Show example prompts
- [ ] Add "Try these examples" buttons
- [ ] Create interactive tutorial
- [ ] Add tooltips for UI elements

### 10.3 Analytics & Telemetry (Optional, Privacy-Respecting)
- [ ] Track feature usage (locally only)
- [ ] Track success/failure rates
- [ ] Track most common errors
- [ ] Generate usage report for debugging

### 10.4 Package & Publish
- [ ] Update package.json metadata
- [ ] Create CHANGELOG.md
- [ ] Test on Windows, macOS, Linux
- [ ] Create release build
- [ ] Package as .vsix
- [ ] Create GitHub release

---

## Critical Integration Points

### Git Worktree Integration Strategy
1. **Snapshot on Every Message:**
   - User sends prompt → create worktree snapshot BEFORE making changes
   - Store snapshot ID in SessionMessage
   - Snapshot metadata: { timestamp, prompt, parent_snapshot, files_affected }

2. **Rollback Flow:**
   - User clicks "Rollback to here" on message
   - Show diff between current state and snapshot
   - Confirm dialog: "This will revert X files. Continue?"
   - Switch to worktree snapshot
   - Truncate conversation history to that message
   - Re-enable "Regenerate from here" option

3. **Worktree Cleanup:**
   - Auto-delete snapshots older than 7 days
   - Keep snapshots for favorited sessions
   - "Clean up old snapshots" command

### Multi-File Atomic Operations
1. **Transaction Pattern:**
   ```typescript
   const transaction = new FileTransaction();
   transaction.add(createFile('User.ts', content));
   transaction.add(modifyFile('index.ts', diff));
   transaction.add(deleteFile('old-file.ts'));
   
   // Validate (check conflicts, permissions)
   await transaction.validate();
   
   // Apply all or nothing
   await transaction.commit(); // or transaction.rollback()
   ```

2. **Conflict Detection:**
   - Before apply, check file hashes
   - If file changed since planning, warn user
   - Offer: "Replan with new file state" or "Apply anyway"

### Orchestrator → Specialists → ODAI Pipeline
```typescript
// Orchestrator breaks down task
const plan = await orchestrator.planTask(userPrompt, workspaceContext);

// For each file operation
for (const fileOp of plan.fileOperations) {
  // Gather context for this file
  const context = await contextManager.gatherContext(fileOp);
  
  // Run specialists (with task context from orchestrator)
  const analyses = await runSpecialists(fileOp.task, context, plan.taskType);
  
  // ODAI synthesis
  const result = await odai.synthesize(fileOp.task, analyses, context, plan.taskType);
  
  // Store in transaction
  transaction.add(fileOp.path, result.code);
}

// Verify all changes
const verification = await verifier.verify(transaction);

// Show to user for approval
await chatPanel.showApprovalDialog(transaction, verification);
```

---

## Success Metrics

### Phase 1-3 (MVP):
- [ ] User can chat with orchestrator
- [ ] Orchestrator can modify 2-3 files in one request
- [ ] User can rollback changes with one click
- [ ] Changes are verified (compilation check)

### Phase 4-6 (Beta):
- [ ] Orchestrator handles 10+ file changes
- [ ] Context gathering is intelligent (includes related files)
- [ ] Verification runs tests automatically
- [ ] User can iterate on plans before applying

### Phase 7-10 (Production):
- [ ] Git integration is seamless (commits, branches, history)
- [ ] Error recovery is robust
- [ ] Performance is acceptable (<5s per file operation)
- [ ] User documentation is comprehensive

---

## Priority Order (Start Here)

**Week 1 - Core Foundation:**
1. Orchestrator agent (task analysis, file planning)
2. File operation system (multi-file changes)
3. Basic chat UI (send/receive messages)

**Week 2 - Git & Context:**
4. Git worktree snapshots & rollback
5. Session management
6. Workspace context gathering

**Week 3 - Integration:**
7. Wire orchestrator → specialists → ODAI
8. Multi-file diff preview
9. Verification system

**Week 4 - Polish:**
10. Advanced chat UI features
11. Error handling
12. Settings

**Week 5 - Launch:**
13. Testing
14. Documentation
15. Package

---

## Notes

- **Start with MVP**: Get basic orchestrator + chat + multi-file working FIRST
- **Git is critical**: Users need confidence they can undo anything instantly
- **Verification prevents disasters**: Always check compilation before applying
- **Context is key**: Orchestrator needs to know about related files
- **Iterate fast**: Ship imperfect features, improve based on usage

---

## Dependencies to Research

- [ ] VSCode Git extension API (`vscode.git`)
- [ ] VSCode SCM API (`vscode.scm`)
- [ ] VSCode File System API (`vscode.workspace.fs`)
- [ ] VSCode Webview API (for chat UI)
- [ ] Git worktree CLI commands
- [ ] Tree-sitter (for AST parsing - future)
- [ ] Diff algorithms (for intelligent merging)

---

**Total Estimated Work:** 5-6 weeks for production-ready orchestrator + chat interface with full git integration.

**MVP (Weeks 1-2):** Basic orchestrator + chat + multi-file + rollback = USABLE
**Beta (Weeks 3-4):** Context + verification + polish = GOOD
**Production (Weeks 5-6):** Git advanced + testing + docs = EXCELLENT

