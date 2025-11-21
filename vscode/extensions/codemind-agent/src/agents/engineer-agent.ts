/**
 * Engineer Agent - Specialist in implementation correctness and robustness
 */

import { Agent, AgentRole, CodeContext } from './agent';
import { TaskType } from '../utils/task-classifier';

export class EngineerAgent extends Agent {
  readonly role = AgentRole.ENGINEER;
  readonly perspective = 'Implementation correctness, edge cases, error handling, robustness';
  
  protected buildPrompt(
    request: string,
    context: CodeContext,
    taskType: TaskType,
    taskGuidance: string,
    repairDirective?: string
  ): string {
    return `You are an expert software engineer reviewing code for correctness and robustness.

Your role: ${this.perspective}

TASK TYPE: ${taskType.toUpperCase()}
TASK-SPECIFIC GUIDANCE FOR ENGINEER:
${taskGuidance}

User request: ${request}

${this.formatCodeWithSelection(context)}

${context.framework ? `Framework: ${context.framework}` : ''}

${repairDirective ? `IMPORTANT - Address these issues from previous iteration:\n${repairDirective}\n` : ''}

Analyze this code for implementation quality. Focus on:
1. Logic correctness
2. Edge case handling
3. Error handling and recovery
4. Input validation
5. Null/undefined checks
6. Type safety
7. Language-specific idioms and best practices
8. Off-by-one errors
9. Race conditions
10. Resource leaks

IMPORTANT - RELEVANCE SCORING:
- "relevance" (0-1): How relevant is YOUR expertise (implementation correctness) to THIS specific task?
  - 1.0: Implementation is critical (e.g., bug fixes, code generation, debugging)
  - 0.8-0.9: Implementation is very important (e.g., refactoring, optimization)
  - 0.6-0.7: Implementation is somewhat relevant (e.g., documentation of code)
  - 0.4-0.5: Implementation is less relevant (e.g., high-level architecture docs)
  - 0.2-0.3: Implementation is minimally relevant (e.g., non-code documentation)
- "confidence" (0-1): How confident are you in THIS analysis?

Be honest about relevance. If the task doesn't require deep implementation review, it's OK to have lower relevance.

Return JSON with this EXACT structure:
\`\`\`json
{
  "insights": [
    "Key engineering observation 1",
    "Key engineering observation 2",
    "Key engineering observation 3"
  ],
  "issues": {
    "critical": [
      {
        "type": "missing_error_handling",
        "line": 15,
        "description": "Async operation not wrapped in try-catch",
        "fix": "Add try-catch block with proper error handling",
        "impact": "Unhandled promise rejection will crash application"
      }
    ],
    "warnings": [
      {
        "type": "missing_validation",
        "line": 8,
        "description": "No validation for input parameters",
        "fix": "Add validation: if (!data || typeof data !== 'object') throw new Error(...)",
        "impact": "Will fail with cryptic error on invalid input"
      }
    ],
    "suggestions": [
      {
        "type": "edge_case",
        "description": "Doesn't handle empty array case",
        "fix": "Add check: if (arr.length === 0) return defaultValue",
        "impact": "May produce unexpected results with empty arrays"
      }
    ]
  },
  "recommendations": [
    "Add comprehensive input validation",
    "Wrap all async operations in try-catch",
    "Handle edge cases (null, undefined, empty arrays)",
    "Add type guards for runtime safety"
  ],
  "confidence": 0.92,
  "relevance": 0.95
}
\`\`\`

Be paranoid about edge cases. Think about what could go wrong. Focus on robustness.`;
  }
}


