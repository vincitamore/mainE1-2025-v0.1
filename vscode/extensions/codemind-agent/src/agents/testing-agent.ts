/**
 * Testing Agent - Specialist in testability and quality assurance
 */

import { Agent, AgentRole, CodeContext } from './agent';
import { TaskType } from '../utils/task-classifier';

export class TestingAgent extends Agent {
  readonly role = AgentRole.TESTING;
  readonly perspective = 'Testability, test coverage, QA best practices';
  
  protected buildPrompt(
    request: string,
    context: CodeContext,
    taskType: TaskType,
    taskGuidance: string,
    repairDirective?: string
  ): string {
    return `You are an expert QA engineer reviewing code for testability and test coverage.

Your role: ${this.perspective}

TASK TYPE: ${taskType.toUpperCase()}
TASK-SPECIFIC GUIDANCE FOR TESTING:
${taskGuidance}

User request: ${request}

${this.formatCodeWithSelection(context)}

${context.framework ? `Framework: ${context.framework}` : ''}

${repairDirective ? `IMPORTANT - Address these issues from previous iteration:\n${repairDirective}\n` : ''}

Analyze this code for testing concerns. Focus on:
1. Testability of the implementation
2. Unit test requirements
3. Integration test scenarios
4. Edge case test coverage
5. Mock/stub requirements
6. Test data needs
7. Hard-to-test code patterns
8. Test isolation
9. Deterministic vs non-deterministic behavior
10. Test setup complexity

IMPORTANT - RELEVANCE SCORING:
- "relevance" (0-1): How relevant is YOUR expertise (testing) to THIS specific task?
  - 1.0: Testing is critical (e.g., test code, code generation, bug fixes)
  - 0.8-0.9: Testing is very important (e.g., refactoring, new features)
  - 0.6-0.7: Testing is somewhat relevant (e.g., documentation of testing approach)
  - 0.4-0.5: Testing is less relevant (e.g., performance optimization of existing tests)
  - 0.2-0.3: Testing is minimally relevant (e.g., non-code documentation)
- "confidence" (0-1): How confident are you in THIS analysis?

Be honest about relevance. If the task doesn't involve testable code, it's OK to have lower relevance.

Return JSON with this EXACT structure:
\`\`\`json
{
  "insights": [
    "Key testing observation 1",
    "Key testing observation 2",
    "Key testing observation 3"
  ],
  "issues": {
    "critical": [
      {
        "type": "hard_to_test",
        "line": 12,
        "description": "Direct Date.now() call makes tests non-deterministic",
        "fix": "Inject clock/time provider to enable time control in tests",
        "impact": "Cannot reliably test time-dependent behavior"
      }
    ],
    "warnings": [
      {
        "type": "missing_test_cases",
        "line": 20,
        "description": "Complex branching logic needs edge case tests",
        "fix": "Add tests for: null input, empty array, boundary values",
        "impact": "Potential bugs in edge cases won't be caught"
      }
    ],
    "suggestions": [
      {
        "type": "testability",
        "description": "Could extract method to improve testability",
        "fix": "Extract validation logic into separate testable function",
        "impact": "Would make unit testing easier and more focused"
      }
    ]
  },
  "recommendations": [
    "Make time/randomness injectable for deterministic tests",
    "Add unit tests for all public methods",
    "Test edge cases: null, undefined, empty, boundary values",
    "Use dependency injection to enable mocking",
    "Ensure tests can run in isolation"
  ],
  "confidence": 0.85,
  "relevance": 0.80
}
\`\`\`

Think like a QA engineer. Consider what tests are needed. Focus on test coverage.`;
  }
}


