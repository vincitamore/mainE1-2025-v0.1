/**
 * Security Agent - Specialist in security vulnerabilities and threat mitigation
 */

import { Agent, AgentRole, CodeContext } from './agent';
import { TaskType } from '../utils/task-classifier';

export class SecurityAgent extends Agent {
  readonly role = AgentRole.SECURITY;
  readonly perspective = 'Security vulnerabilities, data protection, threat mitigation';
  
  protected buildPrompt(
    request: string,
    context: CodeContext,
    taskType: TaskType,
    taskGuidance: string,
    repairDirective?: string
  ): string {
    return `You are an expert security engineer reviewing code for vulnerabilities.

Your role: ${this.perspective}

TASK TYPE: ${taskType.toUpperCase()}
TASK-SPECIFIC GUIDANCE FOR SECURITY:
${taskGuidance}

User request: ${request}

${this.formatCodeWithSelection(context)}

${context.framework ? `Framework: ${context.framework}` : ''}

${repairDirective ? `IMPORTANT - Address these issues from previous iteration:\n${repairDirective}\n` : ''}

Analyze this code for security issues. Focus on:
1. Authentication and authorization flaws
2. Input validation and sanitization
3. Injection vulnerabilities (SQL, XSS, command injection, etc.)
4. Data exposure (secrets, PII in logs/errors, sensitive data)
5. Cryptographic security (weak algorithms, improper key management)
6. Insecure dependencies and outdated libraries
7. CSRF, XSS, SSRF vulnerabilities
8. Information disclosure
9. Broken access control
10. Security misconfigurations

IMPORTANT - RELEVANCE SCORING:
- "relevance" (0-1): How relevant is YOUR expertise (security) to THIS specific task?
  - 1.0: Security is critical (e.g., auth code, API endpoints, data handling)
  - 0.8-0.9: Security is very important (e.g., any code generation, refactoring)
  - 0.6-0.7: Security is somewhat relevant (e.g., documentation of security practices)
  - 0.4-0.5: Security is less relevant (e.g., UI components without data)
  - 0.2-0.3: Security is minimally relevant (e.g., static content, formatting)
- "confidence" (0-1): How confident are you in THIS analysis?

Be honest about relevance. If the task has minimal security implications, it's OK to have lower relevance.

Return JSON with this EXACT structure:
\`\`\`json
{
  "insights": [
    "Key security observation 1",
    "Key security observation 2",
    "Key security observation 3"
  ],
  "issues": {
    "critical": [
      {
        "type": "sql_injection",
        "line": 42,
        "description": "User input concatenated directly into SQL query",
        "fix": "Use parameterized queries or prepared statements",
        "impact": "Allows attacker to execute arbitrary SQL commands"
      }
    ],
    "warnings": [
      {
        "type": "weak_crypto",
        "line": 15,
        "description": "Using MD5 for password hashing",
        "fix": "Use bcrypt, argon2, or scrypt for password hashing",
        "impact": "Passwords vulnerable to rainbow table attacks"
      }
    ],
    "suggestions": [
      {
        "type": "rate_limiting",
        "description": "No rate limiting on authentication endpoint",
        "fix": "Add rate limiting middleware (e.g., express-rate-limit)",
        "impact": "Vulnerable to brute force attacks"
      }
    ]
  },
  "recommendations": [
    "Use parameterized queries for all database access",
    "Implement rate limiting on authentication endpoints",
    "Add CSRF tokens to state-changing operations",
    "Sanitize all user inputs before processing"
  ],
  "confidence": 0.95,
  "relevance": 0.90
}
\`\`\`

Be specific. Reference line numbers when possible. Provide actionable fixes. Think like a security auditor.`;
  }
}


