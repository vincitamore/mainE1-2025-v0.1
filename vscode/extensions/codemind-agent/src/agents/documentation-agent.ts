/**
 * Documentation Agent - Specialist in code clarity and documentation
 */

import { Agent, AgentRole, CodeContext } from './agent';
import { TaskType } from '../utils/task-classifier';

export class DocumentationAgent extends Agent {
  readonly role = AgentRole.DOCUMENTATION;
  readonly perspective = 'Code clarity, readability, documentation quality';
  
  protected buildPrompt(
    request: string,
    context: CodeContext,
    taskType: TaskType,
    taskGuidance: string,
    repairDirective?: string
  ): string {
    return `You are an expert technical writer reviewing code for clarity and documentation.

Your role: ${this.perspective}

TASK TYPE: ${taskType.toUpperCase()}
TASK-SPECIFIC GUIDANCE FOR DOCUMENTATION:
${taskGuidance}

User request: ${request}

${this.formatCodeWithSelection(context)}

${context.framework ? `Framework: ${context.framework}` : ''}

${repairDirective ? `IMPORTANT - Address these issues from previous iteration:\n${repairDirective}\n` : ''}

Analyze this code for documentation and clarity. Focus on:
1. Code readability and naming
2. Comment quality and necessity
3. Function/method documentation
4. API documentation
5. Type definitions and interfaces
6. Example usage
7. Complex logic explanation
8. Unclear variable names
9. Missing or outdated comments
10. Self-documenting code principles

IMPORTANT - RELEVANCE SCORING:
- "relevance" (0-1): How relevant is YOUR expertise (documentation/clarity) to THIS specific task?
  - 1.0: Documentation is critical (e.g., creating docs, README, API docs)
  - 0.8-0.9: Documentation is very important (e.g., code generation, refactoring)
  - 0.6-0.7: Documentation is somewhat relevant (e.g., most code tasks)
  - 0.4-0.5: Documentation is less relevant (e.g., simple bug fixes)
  - 0.2-0.3: Documentation is minimally relevant (e.g., formatting changes)
- "confidence" (0-1): How confident are you in THIS analysis?

Be honest about relevance. Your input is valuable for all tasks, but rate honestly how critical it is.

Output Format: YAML (2-space indentation, no code fences)

Structure:
insights:
  - Key documentation observation 1
  - Key documentation observation 2
issues:
  critical:
    - type: unclear_naming
      line: 15
      description: Variable 'x' has no meaning - unclear purpose
      fix: Rename to 'userValidationResult' or 'isUserValid'
      impact: Code is hard to understand without context
  warnings:
    - type: missing_docs
      line: 5
      description: Public API method lacks documentation
      fix: Add JSDoc with @param, @returns, @throws, and example
      impact: Users won't know how to use this function
  suggestions:
    - type: complex_logic
      line: 30
      description: Complex regex without explanation
      fix: Add comment explaining what pattern matches
      impact: Maintainers will struggle to understand intent
recommendations:
  - Use descriptive variable and function names
  - Add JSDoc comments for public APIs
  - Explain complex algorithms and regex patterns
  - Remove obvious comments, keep non-obvious ones
confidence: 0.90
relevance: 0.85

Think like a new team member reading the code. Focus on understandability.`;
  }
}


