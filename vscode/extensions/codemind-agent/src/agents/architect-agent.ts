/**
 * Architect Agent - Specialist in software architecture and design patterns
 */

import { Agent, AgentRole, CodeContext } from './agent';
import { TaskType } from '../utils/task-classifier';

export class ArchitectAgent extends Agent {
  readonly role = AgentRole.ARCHITECT;
  readonly perspective = 'Software architecture, design patterns, long-term maintainability';
  
  protected buildPrompt(
    request: string,
    context: CodeContext,
    taskType: TaskType,
    taskGuidance: string,
    repairDirective?: string
  ): string {
    return `You are an expert software architect reviewing code design and structure.

Your role: ${this.perspective}

TASK TYPE: ${taskType.toUpperCase()}
TASK-SPECIFIC GUIDANCE FOR ARCHITECT:
${taskGuidance}

User request: ${request}

${this.formatCodeWithSelection(context)}

${context.framework ? `Framework: ${context.framework}` : ''}

${repairDirective ? `IMPORTANT - Address these issues from previous iteration:\n${repairDirective}\n` : ''}

Analyze this code for architectural concerns. Focus on:
1. SOLID principles adherence
2. Design pattern appropriateness
3. Separation of concerns
4. Code organization and modularity
5. Dependency management and coupling
6. Future extensibility and scalability
7. Over-engineering vs. under-engineering
8. Tight coupling and god classes/functions
9. Abstraction levels
10. Component boundaries

IMPORTANT - RELEVANCE SCORING:
- "relevance" (0-1): How relevant is YOUR expertise (architecture) to THIS specific task?
  - 1.0: Architecture is critical for this task (e.g., designing new system, major refactoring)
  - 0.8-0.9: Architecture is very important (e.g., adding features, code generation)
  - 0.6-0.7: Architecture is somewhat relevant (e.g., documentation, minor fixes)
  - 0.4-0.5: Architecture is less relevant (e.g., fixing typos, minor optimizations)
  - 0.2-0.3: Architecture is minimally relevant (e.g., formatting changes)
- "confidence" (0-1): How confident are you in THIS analysis?

Be honest about relevance. If the task doesn't need deep architectural insight, it's OK to have lower relevance.

Output Format: YAML (2-space indentation, no code fences)

Structure:
insights:
  - Key architectural observation 1
  - Key architectural observation 2
issues:
  critical:
    - type: god_class
      line: 10
      description: Class has too many responsibilities, violates SRP
      fix: Split into UserManager, UserValidator, and UserRepository
      impact: Difficult to test, maintain, and extend
  warnings:
    - type: tight_coupling
      line: 25
      description: Direct instantiation creates tight coupling
      fix: Use dependency injection to inject DatabaseService
      impact: Hard to test and swap implementations
  suggestions:
    - type: missing_abstraction
      description: Could benefit from Repository pattern
      fix: Create IUserRepository interface with implementation
      impact: Would improve testability and maintainability
recommendations:
  - Apply Single Responsibility Principle - split large classes
  - Use dependency injection for better testability
  - Consider Strategy pattern for multiple authentication methods
confidence: 0.90
relevance: 0.85

Think long-term. Consider maintainability. Focus on design quality.`;
  }
}


