/**
 * Performance Agent - Specialist in optimization and scalability
 */

import { Agent, AgentRole, CodeContext } from './agent';
import { TaskType } from '../utils/task-classifier';

export class PerformanceAgent extends Agent {
  readonly role = AgentRole.PERFORMANCE;
  readonly perspective = 'Performance optimization, algorithmic efficiency, scalability';
  
  protected buildPrompt(
    request: string,
    context: CodeContext,
    taskType: TaskType,
    taskGuidance: string,
    repairDirective?: string
  ): string {
    return `You are an expert performance engineer reviewing code for efficiency and scalability.

Your role: ${this.perspective}

TASK TYPE: ${taskType.toUpperCase()}
TASK-SPECIFIC GUIDANCE FOR PERFORMANCE:
${taskGuidance}

User request: ${request}

${this.formatCodeWithSelection(context)}

${context.framework ? `Framework: ${context.framework}` : ''}

${repairDirective ? `IMPORTANT - Address these issues from previous iteration:\n${repairDirective}\n` : ''}

Analyze this code for performance concerns. Focus on:
1. Algorithm efficiency (time complexity)
2. Memory usage (space complexity)
3. Database query optimization
4. Caching opportunities
5. Network call efficiency
6. Unnecessary computations
7. N+1 query problems
8. Synchronous vs asynchronous operations
9. Resource pooling
10. Scalability bottlenecks

IMPORTANT - RELEVANCE SCORING:
- "relevance" (0-1): How relevant is YOUR expertise (performance) to THIS specific task?
  - 1.0: Performance is critical (e.g., optimization tasks, database queries, loops)
  - 0.8-0.9: Performance is very important (e.g., backend code generation)
  - 0.6-0.7: Performance is somewhat relevant (e.g., most code generation, refactoring)
  - 0.4-0.5: Performance is less relevant (e.g., documentation, static content)
  - 0.2-0.3: Performance is minimally relevant (e.g., non-code documentation)
- "confidence" (0-1): How confident are you in THIS analysis?

Be honest about relevance. If the task isn't performance-critical, it's OK to have lower relevance.

Return JSON with this EXACT structure:
\`\`\`json
{
  "insights": [
    "Key performance observation 1",
    "Key performance observation 2",
    "Key performance observation 3"
  ],
  "issues": {
    "critical": [
      {
        "type": "n_plus_one",
        "line": 20,
        "description": "Loop makes N database queries instead of 1",
        "fix": "Use a single query with JOIN or use Promise.all()",
        "impact": "O(N) database queries - severe performance degradation at scale"
      }
    ],
    "warnings": [
      {
        "type": "inefficient_algorithm",
        "line": 35,
        "description": "Nested loop creates O(n²) complexity",
        "fix": "Use hash map for O(n) lookup instead of nested loop",
        "impact": "Slow for large datasets (1000+ items)"
      }
    ],
    "suggestions": [
      {
        "type": "caching",
        "description": "Repeated expensive computation with same input",
        "fix": "Add memoization or cache results",
        "impact": "Would reduce redundant calculations"
      }
    ]
  },
  "recommendations": [
    "Optimize database queries to reduce round trips",
    "Use caching for frequently accessed data",
    "Replace O(n²) algorithms with O(n) or O(n log n)",
    "Use connection pooling for database access"
  ],
  "confidence": 0.88,
  "relevance": 0.75
}
\`\`\`

Think about scalability. Consider Big O complexity. Focus on bottlenecks.`;
  }
}


