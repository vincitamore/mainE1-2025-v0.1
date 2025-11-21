# Full File Context for Agent Analysis

## 🎯 The Problem (Before)

**What we were doing:**
```typescript
// Only sending the selected code
const codeContext = {
  code: selectedText,  // ❌ Just the selection, no context
  filePath: '...',
  language: 'typescript'
};
```

**What agents saw:**
```typescript
// User selected this
function processUser(data) {
  return data.name;
}
```

**What agents COULDN'T see:**
- ❌ Import statements (e.g., `import { User } from './types'`)
- ❌ Type definitions (e.g., `interface User { ... }`)
- ❌ Related functions above/below
- ❌ Class context (if function is inside a class)
- ❌ Module-level constants/config
- ❌ Dependencies and framework context

**Result:** Agents made poor decisions due to lack of context!

---

## ✅ The Solution (Now)

### What We Send to Agents

**Full file content** + **marked selection**

```typescript
File: src/user-service.ts
Language: typescript

USER SELECTED LINES 15-18 (marked with >>> and <<<)
Full file context provided below:

   1| import { User, UserRole } from './types';
   2| import { Database } from './database';
   3| import { Logger } from './logger';
   4| 
   5| const logger = new Logger('UserService');
   6| 
   7| export class UserService {
   8|   constructor(private db: Database) {}
   9|   
  10|   async createUser(data: Partial<User>): Promise<User> {
  11|     logger.info('Creating user', data);
  12|     return this.db.users.create(data);
  13|   }
  14|   
  15| >>> USER SELECTION STARTS >>>
  15|   processUser(data) {
  16|     return data.name;
  17|   }
  18| <<< USER SELECTION ENDS <<<
  19|   
  20|   async deleteUser(id: string): Promise<void> {
  21|     logger.info('Deleting user', id);
  22|     return this.db.users.delete(id);
  23|   }
  24| }
```

**Now agents can see:**
- ✅ Imports: `User`, `UserRole`, `Database`, `Logger`
- ✅ Class context: Method is inside `UserService` class
- ✅ Type information: Should use `User` type
- ✅ Related methods: `createUser`, `deleteUser`
- ✅ Patterns: Other methods use `async/await`, logger, etc.
- ✅ Full context for intelligent decisions

---

## 🛠️ Technical Implementation

### 1. **Updated `CodeContext` Interface**

**File**: `src/agents/agent.ts`

```typescript
export interface CodeContext {
  code: string;           // NOW: Full file content (not just selection)
  filePath: string;
  language: string;
  
  selectionRange?: {      // NEW: The specific portion user highlighted
    start: { line: number; character: number };
    end: { line: number; character: number };
    text: string;         // The actual selected text
  };
  
  framework?: string;
}
```

### 2. **Added Helper Method for Formatting**

**File**: `src/agents/agent.ts`

```typescript
protected formatCodeWithSelection(context: CodeContext): string {
  // Shows full file with >>> and <<< markers around selection
  // Adds line numbers for easy reference
  // Provides guidance to focus on selection while using full context
}
```

### 3. **Updated All 6 Specialist Agents**

**Files**:
- `architect-agent.ts`
- `engineer-agent.ts`
- `security-agent.ts`
- `performance-agent.ts`
- `testing-agent.ts`
- `documentation-agent.ts`

**Before:**
```typescript
Code to analyze:
\`\`\`typescript
${context.code}  // ❌ Just selection
\`\`\`
```

**After:**
```typescript
${this.formatCodeWithSelection(context)}  // ✅ Full file with markers
```

### 4. **Updated Extension Entry Point**

**File**: `src/extension.ts`

**Before:**
```typescript
const codeContext: CodeContext = {
  code: selectedText,        // ❌ Only selection
  filePath: document.uri.fsPath,
  language: document.languageId,
  selection: selectedText    // Deprecated
};
```

**After:**
```typescript
const fullFileContent = document.getText(); // Get entire file

const codeContext: CodeContext = {
  code: fullFileContent,     // ✅ Full file for context
  filePath: document.uri.fsPath,
  language: document.languageId,
  
  selectionRange: {          // ✅ Mark the selection
    start: {
      line: selection.start.line,
      character: selection.start.character
    },
    end: {
      line: selection.end.line,
      character: selection.end.character
    },
    text: selectedText       // ✅ The specific selection
  }
};
```

### 5. **Updated ODAI Synthesizer**

**File**: `src/synthesis/odai-synthesizer.ts`

**Integrate Phase Now:**
1. Shows full file with line numbers
2. Marks the selected portion with >>> and <<<
3. Explicitly instructs LLM to generate **only** the replacement for the selection
4. Uses full file context for understanding imports, types, patterns

```typescript
FULL FILE FOR CONTEXT (User selected lines 15-18):
[Full file with markers]

IMPORTANT: Generate ONLY the replacement code for lines 15-18.
Do NOT regenerate the entire file.
Focus on the selected section while using the full file context.
```

---

## 🎯 Benefits

### 1. **Better Type Understanding**

**Before:**
```typescript
// Agent sees:
function processUser(data) {
  return data.name;
}

// Agent suggests:
function processUser(data: any) {  // ❌ Uses 'any'
  return data.name;
}
```

**After:**
```typescript
// Agent sees full file, including:
import { User } from './types';

// Agent suggests:
function processUser(data: User): string {  // ✅ Uses actual User type
  return data.name;
}
```

### 2. **Consistent Patterns**

**Before:**
```typescript
// Agent can't see other methods, so suggests inconsistent pattern
processUser(data) {
  return data.name;  // ❌ Doesn't match rest of file
}
```

**After:**
```typescript
// Agent sees other methods use async/await and logger
async processUser(data: User): Promise<string> {  // ✅ Consistent pattern
  logger.info('Processing user', data);
  return data.name;
}
```

### 3. **Proper Error Handling**

**Before:**
```typescript
// Agent doesn't know what error handling patterns file uses
function processUser(data) {
  return data.name;  // ❌ No error handling
}
```

**After:**
```typescript
// Agent sees other methods use try-catch and logger.error
async processUser(data: User): Promise<string> {
  try {
    logger.info('Processing user', data);
    return data.name;
  } catch (error) {  // ✅ Consistent error handling
    logger.error('Failed to process user', error);
    throw error;
  }
}
```

### 4. **Correct Imports**

**Before:**
```typescript
// Agent suggests code but can't see what's already imported
import { User } from './types';  // ❌ Duplicate import
import { Logger } from './logger'; // ❌ Already imported
```

**After:**
```typescript
// Agent sees existing imports, doesn't duplicate them
// Just generates the function code ✅
```

### 5. **Architecture-Aware Decisions**

**Example: Class Method vs Standalone Function**

**Before:**
```typescript
// Agent sees isolated function, suggests standalone pattern
export function processUser(data) {  // ❌ Wrong pattern
  return data.name;
}
```

**After:**
```typescript
// Agent sees it's inside UserService class, keeps it as method
async processUser(data: User): Promise<string> {  // ✅ Correct pattern
  logger.info('Processing user', data);
  return data.name;
}
```

---

## 📊 Agent Prompt Example

### What Architect Agent Now Sees

```
You are an expert software architect reviewing code design and structure.

Your role: Software architecture, design patterns, long-term maintainability

User request: Add error handling

File: src/user-service.ts
Language: typescript

USER SELECTED LINES 15-18 (marked with >>> and <<<)
Full file context provided below:

   1| import { User, UserRole } from './types';
   2| import { Database } from './database';
   3| import { Logger } from './logger';
   4| 
   5| const logger = new Logger('UserService');
   6| 
   7| export class UserService {
   8|   constructor(private db: Database) {}
   9|   
  10|   async createUser(data: Partial<User>): Promise<User> {
  11|     logger.info('Creating user', data);
  12|     return this.db.users.create(data);
  13|   }
  14|   
  15| >>> USER SELECTION STARTS >>>
  15|   processUser(data) {
  16|     return data.name;
  17|   }
  18| <<< USER SELECTION ENDS <<<
  19|   
  20|   async deleteUser(id: string): Promise<void> {
  21|     logger.info('Deleting user', id);
  22|     return this.db.users.delete(id);
  23|   }
  24| }

Focus your analysis on lines 15-18, but consider the full file context for:
- Import statements and dependencies
- Type definitions and interfaces
- Related functions and methods
- Class/module structure
- Overall code patterns
```

**Now Architect Agent can:**
- ✅ See it's a class method (should stay as method)
- ✅ See other methods use `async/await` (should match)
- ✅ See `Logger` is imported and used (should use it)
- ✅ See `User` type is imported (should type the parameter)
- ✅ See the pattern for other methods (should follow same pattern)

---

## 🧪 Testing the Feature

### Test Case 1: Method in a Class

**1. Open a file with a class:**
```typescript
export class UserService {
  constructor(private db: Database) {}
  
  processUser(data) {  // ← Select this
    return data.name;
  }
}
```

**2. Select just the `processUser` method**

**3. Press `Ctrl+L` → Type: "Add error handling"**

**Expected Result:**
- ✅ Agent sees the class context
- ✅ Keeps it as a class method (not standalone function)
- ✅ Uses same patterns as other methods
- ✅ Doesn't duplicate imports

### Test Case 2: Function with Imports

**1. Open a file with imports:**
```typescript
import { User } from './types';
import { validate } from './utils';

function processUser(data) {  // ← Select this
  return data.name;
}
```

**2. Select just the function**

**3. Press `Ctrl+L` → Type: "Add validation"**

**Expected Result:**
- ✅ Agent sees `User` type is imported
- ✅ Agent sees `validate` is imported
- ✅ Uses these existing imports (doesn't suggest importing them)
- ✅ Types the parameter as `User`

### Test Case 3: Partial Selection in Large File

**1. Open a 200-line file**

**2. Select lines 50-60 (some function in the middle)**

**3. Press `Ctrl+L` → Type: "Optimize this"**

**Expected Result:**
- ✅ Agent sees lines 1-200 for context
- ✅ Agent knows which lines (50-60) user wants to modify
- ✅ Agent generates replacement **only** for lines 50-60
- ✅ Agent uses imports/types from top of file

---

## 🎉 Impact on Code Quality

### Before (No Context)
- ❌ Agents suggested `any` types
- ❌ Inconsistent patterns within same file
- ❌ Duplicate imports
- ❌ Standalone functions when should be methods
- ❌ Missing error handling patterns from rest of file

### After (Full Context)
- ✅ Agents use actual types from imports
- ✅ Consistent patterns across entire file
- ✅ No duplicate imports
- ✅ Correct architectural decisions (method vs function)
- ✅ Matches error handling, logging, and coding style

---

## 📁 Files Modified

1. `src/agents/agent.ts`
   - Updated `CodeContext` interface
   - Added `formatCodeWithSelection()` helper method

2. `src/agents/architect-agent.ts`
   - Uses `formatCodeWithSelection()`

3. `src/agents/engineer-agent.ts`
   - Uses `formatCodeWithSelection()`

4. `src/agents/security-agent.ts`
   - Uses `formatCodeWithSelection()`

5. `src/agents/performance-agent.ts`
   - Uses `formatCodeWithSelection()`

6. `src/agents/testing-agent.ts`
   - Uses `formatCodeWithSelection()`

7. `src/agents/documentation-agent.ts`
   - Uses `formatCodeWithSelection()`

8. `src/extension.ts`
   - Captures full file content
   - Creates `selectionRange` object

9. `src/synthesis/odai-synthesizer.ts`
   - Updated `integrate()` phase
   - Shows full file with selection markers
   - Instructs LLM to generate only selected portion

---

## ✅ Result

**Agents now have full context** to make intelligent, architecture-aware, type-safe decisions while still focusing on the specific code the user wants to modify.

**No more guesswork!** Agents see:
- ✅ All imports
- ✅ All types
- ✅ Related functions
- ✅ Class structure
- ✅ Coding patterns
- ✅ Error handling approaches
- ✅ Full architectural context

**But they still focus** on the specific selection the user highlighted!

---

**Reload VSCode and test it!** Select a function in a class, press `Ctrl+L`, and watch agents make much smarter decisions with full file context. 🚀

