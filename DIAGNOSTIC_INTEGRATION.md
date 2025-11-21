# Diagnostic/Linter Integration for Agents

## 🎯 The Enhancement

Agents now receive **linter errors, compiler warnings, and type errors** from VSCode's diagnostic system, giving them full awareness of existing issues in the code.

---

## 💡 Why This Matters

### Before (Without Diagnostics)
```typescript
// User selects this code:
function processUser(data) {
  return data.naem;  // Typo: 'naem' instead of 'name'
}

// Agents see: Just the code
// Agents don't know: TypeScript is already complaining about 'naem'
```

**Agent might suggest:**
```typescript
// Adds error handling but MISSES the typo
function processUser(data: any) {
  if (!data) throw new Error('No data');
  return data.naem;  // ❌ TYPO STILL THERE
}
```

### After (With Diagnostics)
```typescript
// Agents now see:
⚠️ EXISTING ISSUES DETECTED BY LINTER/COMPILER:

🔴 ERRORS (1):
  Line 3, Col 15: Property 'naem' does not exist on type 'User'. Did you mean 'name'? [IN SELECTION] ⚡
    Source: typescript

// Full code with selection markers...
```

**Agent now suggests:**
```typescript
// Fixes the typo AND adds error handling
function processUser(data: User): string {
  if (!data) throw new Error('No data');
  return data.name;  // ✅ TYPO FIXED
}
```

---

## 🛠️ What We Capture

### Diagnostic Information

From **VSCode's diagnostic system** (all linters, compilers, language servers):

1. **TypeScript/JavaScript Errors**
   - Type errors
   - Missing imports
   - Undefined variables
   - Property typos

2. **ESLint/TSLint Warnings**
   - Code style issues
   - Unused variables
   - Complexity warnings
   - Best practice violations

3. **Language Server Issues**
   - Syntax errors
   - Semantic errors
   - Configuration problems

4. **Any Linter/Tool**
   - Custom linter rules
   - Framework-specific checks
   - Security scanners

### Data Captured

For each diagnostic:
```typescript
{
  line: number,              // Line number (0-based)
  character: number,         // Column number
  severity: 'error' | 'warning' | 'info' | 'hint',
  message: string,           // The actual error message
  source: string,            // 'typescript', 'eslint', etc.
  code: string               // Error code (e.g., 'TS2304')
}
```

---

## 📊 How Agents See Diagnostics

### Example 1: TypeScript Errors in Selection

**User's code:**
```typescript
class UserService {
  processUser(data) {  // ← User selects this method
    return data.naem;
  }
}
```

**What agents see:**
```
⚠️ EXISTING ISSUES DETECTED BY LINTER/COMPILER:
(Fix these issues or avoid introducing similar ones)

🔴 ERRORS (2):
  Line 2, Col 14: Parameter 'data' implicitly has an 'any' type. [IN SELECTION] ⚡
    Source: typescript
  Line 3, Col 16: Property 'naem' does not exist on type 'any'. Did you mean 'name'? [IN SELECTION] ⚡
    Source: typescript

---

USER SELECTED LINES 2-4 (marked with >>> and <<<)
Full file context provided below:

   1| class UserService {
   2| >>> USER SELECTION STARTS >>>
   2|   processUser(data) {
   3|     return data.naem;
   4|   }
   4| <<< USER SELECTION ENDS <<<
   5| }

Focus your analysis on lines 2-4, but consider the full file context for:
- Import statements and dependencies
- Type definitions and interfaces
- Related functions and methods
- Class/module structure
- Overall code patterns
- Existing linter/compiler issues (shown above)

⚡ IMPORTANT: The selected code has 2 existing issue(s) marked [IN SELECTION]. Address these!
```

### Example 2: ESLint Warnings

**User's code:**
```typescript
function calculateTotal(items) {
  var sum = 0;  // ← ESLint: Use 'let' or 'const'
  for (var i = 0; i < items.length; i++) {  // ← ESLint: Use 'for...of'
    sum += items[i].price;
  }
  return sum;
}
```

**What agents see:**
```
⚠️ EXISTING ISSUES DETECTED BY LINTER/COMPILER:

🟡 WARNINGS (3):
  Line 2, Col 3: Unexpected var, use let or const instead [IN SELECTION] ⚡
    Source: eslint
  Line 3, Col 7: Unexpected var, use let or const instead [IN SELECTION] ⚡
    Source: eslint
  Line 3, Col 3: Use for...of instead of a for loop [IN SELECTION] ⚡
    Source: eslint

---

[Full file with selection markers...]

⚡ IMPORTANT: The selected code has 3 existing issue(s) marked [IN SELECTION]. Address these!
```

**Agent suggestions will:**
- ✅ Fix `var` → `const`/`let`
- ✅ Replace for loop with `for...of`
- ✅ Make code ESLint-compliant

### Example 3: Mixed Issues (Some in Selection, Some Outside)

**User's code (full file):**
```typescript
import { User } from './types';

let unusedVariable = 123;  // ← Warning: Unused (NOT in selection)

function processUser(data) {  // ← User selects ONLY this
  return data.naem;           // ← Error: Typo (IN selection)
}
```

**What agents see:**
```
⚠️ EXISTING ISSUES DETECTED BY LINTER/COMPILER:

🔴 ERRORS (1):
  Line 6, Col 15: Property 'naem' does not exist. Did you mean 'name'? [IN SELECTION] ⚡
    Source: typescript

🟡 WARNINGS (1):
  Line 3, Col 5: 'unusedVariable' is declared but never used
    Source: typescript

---

[Full file with selection markers...]

⚡ IMPORTANT: The selected code has 1 existing issue(s) marked [IN SELECTION]. Address these!
```

**Notice:**
- Issues **in the selection** are marked with `[IN SELECTION] ⚡`
- Issues **outside the selection** are shown for context
- Agents are told to **prioritize fixing issues in the selection**

---

## 🔧 Technical Implementation

### 1. Updated `CodeContext` Interface

**File**: `src/agents/agent.ts`

```typescript
export interface Diagnostic {
  line: number;
  character: number;
  severity: 'error' | 'warning' | 'info' | 'hint';
  message: string;
  source?: string;  // e.g., 'typescript', 'eslint'
  code?: string | number;
}

export interface CodeContext {
  code: string;
  filePath: string;
  language: string;
  selectionRange?: { ... };
  diagnostics?: Diagnostic[];  // NEW: Linter/compiler issues
  framework?: string;
}
```

### 2. Gathering Diagnostics

**File**: `src/extension.ts`

```typescript
// Get all diagnostics for the document
const diagnostics = vscode.languages.getDiagnostics(document.uri);

// Format them for agents
const formattedDiagnostics = diagnostics.map(diag => ({
  line: diag.range.start.line,
  character: diag.range.start.character,
  severity: diag.severity === vscode.DiagnosticSeverity.Error ? 'error' :
            diag.severity === vscode.DiagnosticSeverity.Warning ? 'warning' :
            diag.severity === vscode.DiagnosticSeverity.Information ? 'info' : 'hint',
  message: diag.message,
  source: diag.source,
  code: diag.code ? String(diag.code) : undefined
}));

const codeContext: CodeContext = {
  code: fullFileContent,
  filePath: document.uri.fsPath,
  language: document.languageId,
  selectionRange: { ... },
  diagnostics: formattedDiagnostics  // Include diagnostics
};
```

### 3. Formatting for Agents

**File**: `src/agents/agent.ts` - `formatCodeWithSelection()`

```typescript
// Add diagnostics section before code
if (context.diagnostics && context.diagnostics.length > 0) {
  result += `⚠️ EXISTING ISSUES DETECTED BY LINTER/COMPILER:\n`;
  
  // Group by severity
  const errors = context.diagnostics.filter(d => d.severity === 'error');
  const warnings = context.diagnostics.filter(d => d.severity === 'warning');
  
  // Show errors
  if (errors.length > 0) {
    result += `🔴 ERRORS (${errors.length}):\n`;
    errors.forEach(d => {
      const inSelection = d.line >= startLine && d.line <= endLine;
      const marker = inSelection ? ' [IN SELECTION] ⚡' : '';
      result += `  Line ${d.line + 1}, Col ${d.character}: ${d.message}${marker}\n`;
      if (d.source) result += `    Source: ${d.source}\n`;
    });
  }
  
  // Show warnings
  // ... similar format ...
  
  // Alert if issues are in selection
  const issuesInSelection = context.diagnostics.filter(d => 
    d.line >= startLine && d.line <= endLine
  );
  if (issuesInSelection.length > 0) {
    result += `\n⚡ IMPORTANT: The selected code has ${issuesInSelection.length} existing issue(s). Address these!\n`;
  }
}
```

### 4. Automatic for All Agents

All 6 specialist agents automatically receive diagnostics via `formatCodeWithSelection()`:
- ✅ Architect Agent
- ✅ Engineer Agent
- ✅ Security Agent
- ✅ Performance Agent
- ✅ Testing Agent
- ✅ Documentation Agent

---

## 🎯 Benefits

### 1. **Fix Existing Errors**

Agents can see and fix errors that already exist:
- Type errors
- Import issues
- Typos in property names
- Missing parameters

### 2. **Avoid Introducing New Errors**

Agents know what the linter is checking for:
- Won't use `var` if ESLint forbids it
- Won't use `any` if TypeScript strict mode is on
- Won't ignore existing code style rules

### 3. **Smarter Type Inference**

When TypeScript complains about types, agents can:
- Use the correct types from error messages
- Import missing types
- Fix type annotations

### 4. **Context-Aware Suggestions**

Agents understand the "health" of the code:
- If many warnings exist, suggest fixes
- If critical errors exist, prioritize those
- If code is clean, focus on enhancement

### 5. **Better Error Messages**

Agents can reference specific error messages:
> "I see TypeScript is complaining about property 'naem' not existing on type 'User'. I've fixed the typo to 'name'."

---

## 🧪 Testing Scenarios

### Test 1: TypeScript Type Error

**Setup:**
```typescript
interface User {
  name: string;
  email: string;
}

function greet(user) {  // ← Select this, TypeScript complains about 'user: any'
  return `Hello ${user.naem}`;  // ← Also typo
}
```

**Expected:**
1. Select the `greet` function
2. Press `Ctrl+L` → "Add type annotations"
3. Agents see 2 TypeScript errors (implicit any, property typo)
4. Generated code:
   - ✅ Has proper type: `(user: User)`
   - ✅ Fixes typo: `user.name`

### Test 2: ESLint Warnings

**Setup:**
```typescript
// .eslintrc: { "no-var": "error", "prefer-const": "warn" }

function calculate() {  // ← Select this
  var sum = 0;  // ← ESLint error
  var count = 10;  // ← ESLint error
  sum = sum + count;
  return sum;
}
```

**Expected:**
1. Select the function
2. Press `Ctrl+L` → "Refactor"
3. Agents see ESLint errors about `var`
4. Generated code uses `let`/`const` appropriately

### Test 3: Missing Import

**Setup:**
```typescript
// No imports

function process(data: User) {  // ← TypeScript: Cannot find name 'User'
  return data.name;
}
```

**Expected:**
1. Select the function
2. Press `Ctrl+L` → "Fix errors"
3. Agents see "Cannot find name 'User'"
4. Generated code adds `import { User } from './types'`

### Test 4: Multiple Issues

**Setup:**
```typescript
class Service {
  async fetchData(id) {  // ← No type
    const result = await fetch(url);  // ← 'url' is not defined
    return result.jason();  // ← Typo: 'jason' should be 'json'
  }
}
```

**Expected:**
1. Select the method
2. Press `Ctrl+L` → "Fix all issues"
3. Agents see 3 errors
4. Generated code:
   - ✅ Types parameter: `id: string`
   - ✅ Defines url: `const url = \`/api/data/\${id}\``
   - ✅ Fixes typo: `result.json()`

---

## 📊 Console Output

When diagnostics are found:

```
[CodeMind] Found 5 diagnostics in file
[CodeMind] Errors: 2, Warnings: 3
```

This helps you understand what agents are seeing!

---

## 🎉 Impact

### Agents Are Now "IDE-Aware"

They know:
- ✅ What TypeScript is complaining about
- ✅ What ESLint wants fixed
- ✅ What the language server detected
- ✅ What issues are in the selection vs. entire file
- ✅ Severity of each issue (error vs. warning)

### Better Code Quality

- ✅ **Existing errors get fixed** (not ignored)
- ✅ **New errors aren't introduced** (agents know the rules)
- ✅ **Type safety improved** (agents use correct types)
- ✅ **Linter compliance** (agents follow your rules)
- ✅ **Smarter suggestions** (based on actual IDE feedback)

---

## 🔍 Technical Details

### VSCode Diagnostic API

We use `vscode.languages.getDiagnostics(uri)` which returns:
- All diagnostics for the file
- From **all** sources (TypeScript, ESLint, custom linters)
- Real-time (as the IDE updates them)
- Standardized format (severity, message, range)

### Diagnostic Sources

Common sources you'll see:
- `typescript` - TypeScript compiler errors
- `eslint` - ESLint rule violations
- `ts-lint` - TSLint warnings
- `pylint` - Python linting
- `rust-analyzer` - Rust errors
- And any other language server or linter!

### Performance

- ✅ **Zero overhead**: Diagnostics are already cached by VSCode
- ✅ **Fast**: Single API call to get all diagnostics
- ✅ **No polling**: We get diagnostics at request time
- ✅ **Efficient**: Only relevant diagnostics are formatted

---

## 📁 Files Modified

1. `src/agents/agent.ts`
   - Added `Diagnostic` interface
   - Updated `CodeContext` to include `diagnostics`
   - Enhanced `formatCodeWithSelection()` to display diagnostics

2. `src/extension.ts`
   - Added diagnostic gathering from VSCode API
   - Formatted diagnostics for CodeContext
   - Added console logging for diagnostic counts

---

## ✅ Result

**Agents are now full IDE citizens!**

They see:
- ✅ Full file context
- ✅ User's selection
- ✅ All linter/compiler errors and warnings
- ✅ Which issues are in the selection
- ✅ Source of each issue (TypeScript, ESLint, etc.)

**No more blind spots!** Agents can:
- Fix existing errors
- Avoid introducing new ones
- Follow your linting rules
- Use correct types from error messages
- Make IDE-aware intelligent decisions

---

**Reload VSCode and test it!** 🚀

Try selecting code with TypeScript errors or ESLint warnings, and watch agents intelligently fix them based on the actual IDE diagnostics.

