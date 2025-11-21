/**
 * Task Classification Utility
 * 
 * Automatically classifies user requests into task types
 * to enable task-aware agent prompts and relevance weighting
 */

export enum TaskType {
  DOCUMENTATION = 'documentation',
  CODE_GENERATION = 'code_generation',
  REFACTORING = 'refactoring',
  DEBUGGING = 'debugging',
  OPTIMIZATION = 'optimization',
  GENERAL = 'general'
}

/**
 * Classify a user request into a task type
 */
export function classifyTask(request: string): TaskType {
  const lowerRequest = request.toLowerCase();
  
  // Documentation patterns
  const docPatterns = [
    /\b(document|documentation|readme|guide|explain|describe|comment|doc)\b/,
    /\badd.*comment/,
    /\bwrite.*doc/,
    /\bcreate.*(readme|guide|docs?|documentation)/,
    /\bgenerate.*(readme|guide|docs?|documentation)/
  ];
  
  if (docPatterns.some(pattern => pattern.test(lowerRequest))) {
    return TaskType.DOCUMENTATION;
  }
  
  // Debugging patterns
  const debugPatterns = [
    /\b(fix|bug|error|issue|problem|crash|fail)\b/,
    /\bdebug/,
    /\bnot working/,
    /\bbroken/,
    /\bthrows?\b/
  ];
  
  if (debugPatterns.some(pattern => pattern.test(lowerRequest))) {
    return TaskType.DEBUGGING;
  }
  
  // Optimization patterns
  const optPatterns = [
    /\b(optimi[zs]e|performance|faster|speed|slow)\b/,
    /\bimprove.*performance/,
    /\bmake.*faster/,
    /\breduce.*time/
  ];
  
  if (optPatterns.some(pattern => pattern.test(lowerRequest))) {
    return TaskType.OPTIMIZATION;
  }
  
  // Refactoring patterns
  const refactorPatterns = [
    /\b(refactor|clean|simplify|restructure|reorgani[zs]e)\b/,
    /\bimprove.*structure/,
    /\bmake.*cleaner/,
    /\bmoderni[zs]e/
  ];
  
  if (refactorPatterns.some(pattern => pattern.test(lowerRequest))) {
    return TaskType.REFACTORING;
  }
  
  // Code generation patterns
  const codeGenPatterns = [
    /\b(add|create|implement|build|generate|write).*\b(function|class|component|feature|method|module)\b/,
    /\bmake.*do\b/,
    /\bnew\s+(function|class|component|feature)/
  ];
  
  if (codeGenPatterns.some(pattern => pattern.test(lowerRequest))) {
    return TaskType.CODE_GENERATION;
  }
  
  return TaskType.GENERAL;
}

/**
 * Get task-specific guidance for agents
 */
export function getTaskGuidance(taskType: TaskType, agentRole: string): string {
  const guidance: Record<TaskType, Record<string, string>> = {
    [TaskType.DOCUMENTATION]: {
      architect: 'Focus on: What architectural decisions should be documented? What design patterns are used? What are the high-level concepts?',
      engineer: 'Focus on: What implementation details are important? What are the technical requirements? What are the dependencies?',
      security: 'Focus on: What security considerations should be documented? What threats are mitigated? What authentication/authorization is used?',
      performance: 'Focus on: What performance characteristics should be documented? What are the bottlenecks? What optimizations are present?',
      testing: 'Focus on: What testing approach should be documented? What test scenarios are critical? What coverage is expected?',
      documentation: 'Focus on: Structure, clarity, completeness. Ensure all sections are present, examples are clear, and documentation serves all audiences.'
    },
    [TaskType.CODE_GENERATION]: {
      architect: 'Focus on: What design patterns fit? How does this integrate with existing architecture? What are the long-term maintainability implications?',
      engineer: 'Focus on: Correct implementation, edge cases, error handling, type safety, and adherence to coding standards.',
      security: 'Focus on: Input validation, injection attacks, authentication/authorization, data exposure, secure defaults.',
      performance: 'Focus on: Algorithm complexity, memory usage, caching opportunities, unnecessary operations.',
      testing: 'Focus on: Testability of the new code, unit test scenarios, integration test needs.',
      documentation: 'Focus on: Inline comments for complex logic, public API documentation, usage examples.'
    },
    [TaskType.DEBUGGING]: {
      architect: 'Focus on: Is this a symptom of a deeper architectural issue? Are there design flaws that enabled this bug?',
      engineer: 'Focus on: Root cause analysis, the actual fix implementation, preventing similar bugs, code correctness.',
      security: 'Focus on: Is this bug a security vulnerability? Could it be exploited? Are there related security issues?',
      performance: 'Focus on: Does the fix introduce performance regressions? Are there more efficient solutions?',
      testing: 'Focus on: Regression tests for this bug, how did this bug slip through? Test coverage gaps.',
      documentation: 'Focus on: Document the bug, its cause, and the fix for future reference.'
    },
    [TaskType.REFACTORING]: {
      architect: 'Focus on: Improved structure, better separation of concerns, cleaner abstractions, design pattern opportunities.',
      engineer: 'Focus on: Correctness preservation, incremental changes, maintaining behavior, reducing complexity.',
      security: 'Focus on: Ensure refactoring does not introduce security issues, maintain security properties.',
      performance: 'Focus on: Do not degrade performance, look for optimization opportunities during refactoring.',
      testing: 'Focus on: Regression tests to ensure behavior is preserved, improved testability.',
      documentation: 'Focus on: Update documentation to reflect refactored structure, clarify intent.'
    },
    [TaskType.OPTIMIZATION]: {
      architect: 'Focus on: Scalability implications, caching strategies, architectural bottlenecks.',
      engineer: 'Focus on: Algorithmic improvements, profiling data, micro-optimizations, correctness preservation.',
      security: 'Focus on: Ensure optimizations do not weaken security (e.g., timing attacks, cache poisoning).',
      performance: 'Focus on: Measurable performance gains, profiling data, before/after metrics, trade-offs.',
      testing: 'Focus on: Performance benchmarks, load testing, regression tests.',
      documentation: 'Focus on: Document optimization rationale, trade-offs, and expected performance characteristics.'
    },
    [TaskType.GENERAL]: {
      architect: 'Analyze from architectural and design perspective.',
      engineer: 'Analyze from implementation and correctness perspective.',
      security: 'Analyze from security perspective.',
      performance: 'Analyze from performance perspective.',
      testing: 'Analyze from testability and quality perspective.',
      documentation: 'Analyze from documentation and maintainability perspective.'
    }
  };
  
  return guidance[taskType][agentRole] || guidance[TaskType.GENERAL][agentRole] || 'Provide relevant analysis.';
}

/**
 * Get expected relevance baseline for each agent based on task type
 * This helps agents calibrate their relevance scores
 */
export function getExpectedRelevance(taskType: TaskType, agentRole: string): number {
  const relevanceMap: Record<TaskType, Record<string, number>> = {
    [TaskType.DOCUMENTATION]: {
      architect: 0.9,      // Architecture docs are critical
      engineer: 0.8,       // Implementation details important
      security: 0.8,       // Security considerations important
      performance: 0.7,    // Performance characteristics relevant
      testing: 0.8,        // Testing approach important
      documentation: 1.0   // Documentation agent is most relevant
    },
    [TaskType.CODE_GENERATION]: {
      architect: 1.0,      // Design is critical
      engineer: 1.0,       // Implementation is critical
      security: 0.9,       // Security is very important
      performance: 0.8,    // Performance is important
      testing: 0.9,        // Testability is very important
      documentation: 0.6   // Docs less critical for generation
    },
    [TaskType.DEBUGGING]: {
      architect: 0.6,      // May indicate design issues
      engineer: 1.0,       // Root cause finding is critical
      security: 0.8,       // Could be security bug
      performance: 0.5,    // May be performance bug
      testing: 0.9,        // Test coverage gaps
      documentation: 0.4   // Less relevant for debugging
    },
    [TaskType.REFACTORING]: {
      architect: 1.0,      // Design improvement is key
      engineer: 1.0,       // Correct refactoring is critical
      security: 0.7,       // Must maintain security
      performance: 0.7,    // Must maintain performance
      testing: 0.9,        // Must maintain behavior
      documentation: 0.6   // Docs should be updated
    },
    [TaskType.OPTIMIZATION]: {
      architect: 0.7,      // Scalability architecture
      engineer: 0.9,       // Correct optimization
      security: 0.6,       // Security implications
      performance: 1.0,    // Performance is the focus
      testing: 0.8,        // Performance tests
      documentation: 0.5   // Document optimizations
    },
    [TaskType.GENERAL]: {
      architect: 0.8,
      engineer: 0.8,
      security: 0.7,
      performance: 0.7,
      testing: 0.7,
      documentation: 0.7
    }
  };
  
  return relevanceMap[taskType][agentRole] || 0.7;
}

