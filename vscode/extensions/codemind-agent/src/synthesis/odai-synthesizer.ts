/**
 * ODAI Synthesizer - The Central Consciousness
 * 
 * Synthesizes multiple agent perspectives into unified solutions
 * through the ODAI cycle: Observe → Distill → Adapt → Integrate
 */

import { LLMProvider, LLMConfig } from '../llm/provider';
import { AgentAnalysis, CodeContext } from '../agents/agent';
import {
  Observation,
  Distillation,
  SynthesisResult,
  RepairDirective
} from './types';
import { extractJSON, extractCode } from '../utils/text-extraction';
import { safeJSONParse } from '../utils/json-repair';
import { TaskType } from '../utils/task-classifier';

export class ODAISynthesizer {
  private config: LLMConfig;
  
  constructor(
    private llmProvider: LLMProvider,
    private qualityThreshold: number = 9.0,
    model?: string
  ) {
    this.config = {
      model: model || 'x-ai/grok-4.1-fast',
      temperature: 0.3,
      maxTokens: 50000  // High limit to prevent truncation
    };
  }
  
  /**
   * Main synthesis pipeline
   * Takes agent analyses and produces unified solution
   */
  async synthesize(
    request: string,
    analyses: AgentAnalysis[],
    context: CodeContext,
    taskType: TaskType = TaskType.GENERAL
  ): Promise<SynthesisResult> {
    try {
      console.log('[ODAI] Starting synthesis cycle...');
      
      // Phase 1: Observe
      const observation = await this.observe(request, analyses, context);
      console.log('[ODAI] Observation complete:', observation.unifiedDirection);
      
      // Phase 2: Distill
      const distillation = await this.distill(observation, analyses);
      console.log(`[ODAI] Distillation complete: Quality=${distillation.qualityScore}`);
      
      // Check quality threshold
      if (distillation.qualityScore >= this.qualityThreshold) {
        // Phase 4: Integrate (quality met)
        console.log('[ODAI] Quality threshold met, integrating solution...');
        return await this.integrate(distillation, context, request, taskType);
      } else {
        // Phase 3: Adapt (quality not met)
        console.log('[ODAI] Quality below threshold, generating repair directive...');
        return await this.adapt(distillation);
      }
      
    } catch (error: any) {
      console.error('[ODAI] Synthesis error:', error);
      return {
        success: false,
        qualityScore: 0,
        explanation: `Synthesis failed: ${error.message}`
      };
    }
  }
  
  /**
   * Phase 1: Observe
   * "What does each agent see? What patterns emerge?"
   */
  private async observe(
    request: string,
    analyses: AgentAnalysis[],
    context: CodeContext
  ): Promise<Observation> {
    const prompt = `You are the Central Consciousness of CodeMind, analyzing multiple specialist perspectives.

USER REQUEST: "${request}"

CONTEXT:
- File: ${context.filePath}
- Language: ${context.language}

AGENT ANALYSES:
${analyses.map(a => {
  const weight = a.relevance * a.confidence;  // Combined weight
  const weightBar = '█'.repeat(Math.round(weight * 10));
  return `
[${a.agent.toUpperCase()}] (Relevance: ${a.relevance.toFixed(2)}, Confidence: ${a.confidence.toFixed(2)}, Weight: ${weightBar} ${weight.toFixed(2)})
${a.relevance < 0.5 ? '⚠️ LOW RELEVANCE - This agent assessed their expertise as less relevant to this task' : ''}
Insights:
${a.insights.map(i => `  - ${i}`).join('\n')}

Critical Issues (${a.issues.critical.length}):
${a.issues.critical.map(i => `  - ${i.description}`).join('\n') || '  None'}

Warnings (${a.issues.warnings.length}):
${a.issues.warnings.length > 0 ? a.issues.warnings.slice(0, 3).map(i => `  - ${i.description}`).join('\n') : '  None'}

Recommendations:
${a.recommendations.map(r => `  - ${r}`).join('\n')}
`;
}).join('\n---\n')}

OBSERVE AND ANALYZE:
1. What is the CORE NEED the user is asking for?
2. What PATTERNS appear across multiple agents?
3. What CONFLICTS exist between agent recommendations?
4. What are the CRITICAL ISSUES that must be addressed?
5. What is the UNIFIED DIRECTION for the solution?

CRITICAL OUTPUT FORMAT:
- Return ONLY valid JSON (no markdown, no code blocks, no backticks)
- Do NOT wrap in \`\`\`json or \`\`\` markers
- Start with { and end with }

Return JSON with this EXACT structure:
{
  "coreNeed": "The essential thing the user wants",
  "patterns": ["Pattern 1", "Pattern 2", "Pattern 3"],
  "conflicts": ["Conflict between agents (or 'none')"],
  "criticalIssues": ["Critical issue 1", "Critical issue 2"],
  "unifiedDirection": "High-level approach to solve this"
}`;

    const response = await this.llmProvider.generate(
      [{ role: 'user', content: prompt }],
      { ...this.config, temperature: 0.3 }
    );
    
    return this.parseJSON<Observation>(response.content, {
      coreNeed: 'Improve code quality',
      patterns: [],
      conflicts: [],
      criticalIssues: [],
      unifiedDirection: 'Apply suggested improvements'
    }, 'Observe');
  }
  
  /**
   * Phase 2: Distill
   * "What are the core truths? How good is this?"
   */
  private async distill(
    observation: Observation,
    analyses: AgentAnalysis[]
  ): Promise<Distillation> {
    const prompt = `You are distilling core truths from observation and agent analyses.

OBSERVATION:
Core Need: ${observation.coreNeed}
Unified Direction: ${observation.unifiedDirection}
Patterns: ${observation.patterns.join('; ')}
Conflicts: ${observation.conflicts.join('; ') || 'None'}
Critical Issues: ${observation.criticalIssues.join('; ') || 'None'}

AGENT SCORES (Relevance × Confidence = Weight):
${analyses.map(a => {
  const weight = a.relevance * a.confidence;
  return `- ${a.agent}: relevance=${a.relevance.toFixed(2)}, confidence=${a.confidence.toFixed(2)}, weight=${weight.toFixed(2)}`;
}).join('\n')}

IMPORTANT - RELEVANCE WEIGHTING:
Agents with LOW relevance (<0.5) should have LESS impact on the overall quality score.
Focus on HIGH relevance agents (>0.7) when assessing quality.
A task can still have high quality even if low-relevance agents provide minimal input.

DISTILL THE FOLLOWING:

1. CORE REQUIREMENTS (what MUST be in the solution):
   - Based on critical issues and user need
   - Non-negotiable elements

2. KEY CONSTRAINTS (what the solution CANNOT violate):
   - Security requirements
   - Performance requirements
   - Existing functionality preservation

3. IMPLEMENTATION PRINCIPLES (HOW to implement):
   - Best practices to follow
   - Patterns to apply
   - Approaches to take

4. QUALITY SCORE (0-10):
   Rate how well the current analyses address the user's need:
   - 9-10: Excellent, ready to generate code
   - 7-8: Good, but missing some details
   - 5-6: Mediocre, significant gaps
   - 0-4: Poor, fundamental issues

5. SCORING RATIONALE:
   Explain WHY you gave that score

CRITICAL OUTPUT FORMAT:
- Return ONLY valid JSON (no markdown, no code blocks)
- Do NOT wrap in \`\`\`json or \`\`\` markers

Return JSON:
{
  "coreRequirements": ["Requirement 1", "Requirement 2", "Requirement 3"],
  "keyConstraints": ["Constraint 1", "Constraint 2"],
  "implementationPrinciples": ["Principle 1", "Principle 2", "Principle 3"],
  "qualityScore": 8.5,
  "scoringRationale": "Detailed explanation of the score"
}`;

    const response = await this.llmProvider.generate(
      [{ role: 'user', content: prompt }],
      { ...this.config, temperature: 0.2 }
    );
    
    return this.parseJSON<Distillation>(response.content, {
      coreRequirements: ['Improve code'],
      keyConstraints: [],
      implementationPrinciples: [],
      qualityScore: 7.0,
      scoringRationale: 'Moderate quality'
    }, 'Distill');
  }
  
  /**
   * Phase 3: Adapt (if quality < threshold)
   * "What's missing? How do we fix it?"
   */
  private async adapt(
    distillation: Distillation
  ): Promise<SynthesisResult> {
    const prompt = `Quality score ${distillation.qualityScore} is below the threshold of ${this.qualityThreshold}.

CURRENT STATE:
Requirements: ${distillation.coreRequirements.join('; ')}
Constraints: ${distillation.keyConstraints.join('; ')}
Principles: ${distillation.implementationPrinciples.join('; ')}
Score: ${distillation.qualityScore}/10
Rationale: ${distillation.scoringRationale}

GENERATE REPAIR DIRECTIVE:

1. OVERALL GUIDANCE:
   What should ALL agents focus on in the next iteration?

2. AGENT-SPECIFIC GUIDANCE:
   What should EACH specialist agent focus on?
   - architect: Design and structure concerns
   - engineer: Implementation and correctness
   - security: Security vulnerabilities
   - performance: Optimization opportunities
   - testing: Test coverage and quality
   - documentation: Clarity and maintainability

3. FOCUS AREAS:
   What specific aspects need deeper analysis?

CRITICAL OUTPUT FORMAT:
- Return ONLY valid JSON (no markdown, no code blocks)
- Do NOT wrap in \`\`\`json or \`\`\` markers

Return JSON:
{
  "overallGuidance": "What all agents should focus on",
  "agentSpecific": {
    "architect": "Specific guidance for architect",
    "engineer": "Specific guidance for engineer",
    "security": "Specific guidance for security",
    "performance": "Specific guidance for performance",
    "testing": "Specific guidance for testing",
    "documentation": "Specific guidance for documentation"
  },
  "focusAreas": ["Focus area 1", "Focus area 2", "Focus area 3"]
}`;

    const response = await this.llmProvider.generate(
      [{ role: 'user', content: prompt }],
      { ...this.config, temperature: 0.3 }
    );
    
    const repairDirective = this.parseJSON<RepairDirective>(response.content, {
      overallGuidance: 'Provide more detailed analysis',
      agentSpecific: {},
      focusAreas: []
    }, 'Adapt');
    
    return {
      success: false,
      qualityScore: distillation.qualityScore,
      repairDirective: repairDirective
    };
  }
  
  /**
   * Phase 4: Integrate (if quality >= threshold)
   * "Generate the final solution"
   */
  private async integrate(
    distillation: Distillation,
    context: CodeContext,
    request: string,
    taskType: TaskType = TaskType.GENERAL
  ): Promise<SynthesisResult> {
    // Detect if file is essentially empty (just a title/stub) for documentation generation
    const isEmptyDocument = context.code.trim().length < 200 && taskType === TaskType.DOCUMENTATION;
    
    // Format the code context with selection highlighting
    let codeSection = '';
    let scopeInstructions = '';
    
    if (context.selectionRange) {
      const lines = context.code.split('\n');
      const startLine = context.selectionRange.start.line;
      const endLine = context.selectionRange.end.line;
      
      if (isEmptyDocument) {
        // For empty documentation files, tell LLM to generate the COMPLETE document
        codeSection = `CURRENT FILE (ESSENTIALLY EMPTY - just title/stub):
\`\`\`${context.language}
${context.code}
\`\`\`

USER REQUEST: Generate a COMPLETE, comprehensive ${context.language} document to replace the current stub.`;
        
        scopeInstructions = `⚠️ CRITICAL SCOPE:
- The file is currently EMPTY (just a title/stub)
- You must generate the COMPLETE, COMPREHENSIVE document from scratch
- Generate ALL sections, content, examples, diagrams, and details
- This should be a production-ready, thorough document (3000-10000+ characters)
- DO NOT return just a snippet or outline - generate the FULL content`;
      } else {
        // For normal code editing, tell LLM to only replace the selection
        codeSection = `FULL FILE FOR CONTEXT (User selected lines ${startLine + 1}-${endLine + 1}):
\`\`\`${context.language}
${lines.map((line, idx) => {
  const lineNum = (idx + 1).toString().padStart(4, ' ');
  if (idx === startLine) {
    return `${lineNum}| >>> USER SELECTION STARTS >>>\n${lineNum}| ${line}`;
  } else if (idx === endLine) {
    return `${lineNum}| ${line}\n${lineNum}| <<< USER SELECTION ENDS <<<`;
  } else {
    return `${lineNum}| ${line}`;
  }
}).join('\n')}
\`\`\``;
        
        scopeInstructions = `IMPORTANT: Generate ONLY the replacement code for lines ${startLine + 1}-${endLine + 1} (the selected portion).
Do NOT regenerate the entire file. Focus on the selected section while using the full file context for understanding imports, types, and structure.`;
      }
    } else {
      codeSection = `EXISTING CODE:
\`\`\`${context.language}
${context.code}
\`\`\``;
      scopeInstructions = '';
    }
    
    const prompt = `Generate the COMPLETE, COMPREHENSIVE final implementation based on synthesis.

⚠️ CRITICAL: You must generate the ENTIRE implementation, not just a stub or example!
- If requirements specify "fully structured document with sections A, B, C, D" → Generate ALL sections completely
- If requirements specify "include diagrams, code snippets, checklists" → Include ALL of them
- If requirements specify comprehensive documentation → Generate thousands of characters, not just a few lines
- DO NOT generate minimal examples - generate production-ready, COMPLETE content

${scopeInstructions}

USER REQUEST: "${request}"

SYNTHESIS REQUIREMENTS (YOU MUST FULFILL ALL OF THESE COMPLETELY):
${distillation.coreRequirements.map((r, i) => `${i + 1}. ${r}`).join('\n')}

CONSTRAINTS (APPLY ALL OF THESE):
${distillation.keyConstraints.map((c, i) => `${i + 1}. ${c}`).join('\n')}

IMPLEMENTATION PRINCIPLES (FOLLOW ALL OF THESE):
${distillation.implementationPrinciples.map((p, i) => `${i + 1}. ${p}`).join('\n')}

CONTEXT:
- Language: ${context.language}
- File: ${context.filePath}
${context.framework ? `- Framework: ${context.framework}` : ''}

${codeSection}

⚠️⚠️⚠️ CRITICAL INSTRUCTIONS FOR OUTPUT FORMAT ⚠️⚠️⚠️

**YOU MUST RETURN JSON - NOT RAW CONTENT!**

1. Your ENTIRE response MUST be a valid JSON object starting with { and ending with }
2. Do NOT return raw markdown, raw code, raw text, or ASCII art directly
3. Do NOT return folder structures, diagrams, or content WITHOUT the JSON wrapper
4. The "code" field must contain your generated content as a STRING value
5. Even if generating markdown/documentation, you MUST wrap it in the JSON structure
6. Generate COMPLETE, COMPREHENSIVE content - not stubs or minimal examples

⚠️ CRITICAL: 
- FAILURE = Returning raw content like "src/\n├── components/" without JSON wrapper
- SUCCESS = Returning {"success": true, "code": "# Full implementation plan\n\n## Section 1\n...", ...}
- Your ENTIRE response must be parseable by JSON.parse()
- Generate production-ready, comprehensive output (3000-10000+ characters for full documents)

GENERATE JSON WITH THIS EXACT STRUCTURE:
{
  "success": true,
  "qualityScore": ${distillation.qualityScore},
  "code": "<PLAIN CODE HERE - NO MARKDOWN>",
  "explanation": "Clear explanation of what was implemented and why",
  "keyDecisions": {
    "architecture": "Architectural decisions made",
    "security": "Security measures applied",
    "performance": "Performance considerations",
    "testing": "Testing approach"
  }
}

EXAMPLE OF CORRECT FORMAT (CODE):
{
  "success": true,
  "qualityScore": 9.5,
  "code": "function example() {\\n  return true;\\n}",
  "explanation": "Added example function",
  "keyDecisions": {"architecture": "Simple function"}
}

EXAMPLE OF CORRECT FORMAT (MARKDOWN/DOCUMENTATION):
{
  "success": true,
  "qualityScore": 9.5,
  "code": "# Title\\n\\n## Section\\n\\nContent here\\n\\n\`\`\`mermaid\\ngraph TD\\n  A --> B\\n\`\`\`",
  "explanation": "Added documentation",
  "keyDecisions": {"documentation": "Structured with mermaid diagram"}
}

WRONG (DO NOT DO THIS):
{
  "code": "\`\`\`javascript\\nfunction example() {\\n  return true;\\n}\\n\`\`\`"
}

ALSO WRONG (DO NOT DO THIS - Don't return raw markdown without JSON wrapper):
# Title
## Section
Content here`;

    const response = await this.llmProvider.generate(
      [
        {
          role: 'system',
          content: `You are a code/documentation generation assistant.

⚠️⚠️⚠️ CRITICAL RULES - VIOLATIONS WILL BE REJECTED ⚠️⚠️⚠️

JSON FORMAT (ABSOLUTELY MANDATORY - NO EXCEPTIONS):
1. Your response MUST start with { and end with }
2. Your response MUST be valid JSON parseable by JSON.parse()
3. NEVER return raw markdown without JSON wrapper (e.g., "# Title\n## Section")
4. NEVER return raw code without JSON wrapper (e.g., "function foo() {}")
5. NEVER return ASCII art, folder structures, or diagrams without JSON wrapper (e.g., "src/\n├── components/")
6. The "code" field must contain your content as a JSON string value

COMPLETENESS (ABSOLUTELY MANDATORY):
7. Generate COMPLETE, COMPREHENSIVE content - NOT snippets, stubs, outlines, or placeholders
8. If requirements specify sections A, B, C, D → Generate ALL sections with FULL content (not just headings)
9. Documentation/plans should be 3000-10000+ characters with complete details
10. Include ALL required diagrams, code examples, checklists, and explanations

EXAMPLES OF FAILURE:
❌ Returning: src/\n├── components/ (raw ASCII art - NO JSON!)
❌ Returning: # Plan\n## Section 1\n## Section 2 (raw markdown - NO JSON!)
❌ Returning: {"code": "# Overview\n\n## To be completed"} (incomplete stub)

EXAMPLES OF SUCCESS:
✅ Returning: {"success": true, "code": "# Complete Implementation Plan\n\n## Overview\n[3000+ chars of full content]...", "explanation": "...", "keyDecisions": {...}}

FAILURE = Not valid JSON OR incomplete content
SUCCESS = Valid JSON with complete, comprehensive content (3000+ chars for documents)`
        },
        { role: 'user', content: prompt }
      ],
      { ...this.config, temperature: 0.4, maxTokens: 50000 }  // Max for code generation
    );
    
    const result = this.parseJSON<SynthesisResult>(response.content, {
      success: true,
      qualityScore: distillation.qualityScore,
      code: context.selectionRange ? context.selectionRange.text : context.code,  // Fallback to selection text
      explanation: 'Code generation failed',
      keyDecisions: {
        architecture: 'N/A',
        security: 'N/A',
        performance: 'N/A',
        testing: 'N/A'
      }
    }, 'Integrate');
    
    // CRITICAL: Extract code if it's still wrapped in markdown (safety net)
    if (result.code) {
      result.code = extractCode(result.code, context.language);
    }
    
    return result;
  }
  
  /**
   * Safely parse JSON with fallback
   * Special handling: If LLM returns raw code/markdown instead of JSON, auto-wrap it
   * 
   * Strategy: Try to find JSON first. If no JSON found anywhere, treat as raw content.
   */
  private parseJSON<T>(content: string, fallback: T, phase?: string): T {
    const debugLabel = phase ? `ODAI-${phase}` : 'ODAI';
    const trimmedContent = content.trim();
    
    // ROBUST DETECTION: Try to find ANY JSON object or array in the response
    const hasJSONStructure = 
      /\{[\s\S]*\}/.test(content) ||  // Has {...} somewhere
      /\[[\s\S]*\]/.test(content);     // Has [...] somewhere
    
    if (!hasJSONStructure && phase === 'Integrate') {
      // NO JSON FOUND ANYWHERE - This must be raw content
      console.log(`[${debugLabel}] ⚠️ NO JSON STRUCTURE FOUND - Response is raw content`);
      console.log(`[${debugLabel}] Response starts with: "${trimmedContent.substring(0, 50)}..."`);
      console.log(`[${debugLabel}] Auto-wrapping entire response in JSON structure...`);
      
      // The entire response is raw content - use it as-is
      // Just clean up any escape sequences
      const cleanedCode = trimmedContent
        .replace(/\\n/g, '\n')    // Unescape newlines
        .replace(/\\t/g, '\t')    // Unescape tabs
        .replace(/\\"/g, '"')     // Unescape quotes
        .replace(/\\\\/g, '\\');  // Unescape backslashes
      
      // Auto-wrap in expected JSON structure for SynthesisResult
      const autoWrappedResult = {
        success: true,
        qualityScore: (fallback as any).qualityScore || 9.0,
        code: cleanedCode,
        explanation: 'Generated content (LLM returned raw output without JSON wrapper, auto-wrapped)',
        keyDecisions: {
          architecture: 'Content generated',
          security: 'N/A',
          performance: 'N/A',
          testing: 'N/A',
          documentation: 'Content generated'
        }
      } as any;
      
      console.log(`[${debugLabel}] ✓ Successfully auto-wrapped raw output (${cleanedCode.length} characters)`);
      return autoWrappedResult as T;
    }
    
    // JSON structure found - try to parse it
    const jsonStr = extractJSON(content);
    const result = safeJSONParse<T>(jsonStr, fallback, debugLabel);
    
    if (result === fallback && phase === 'Integrate') {
      // JSON parsing failed even though we detected JSON structure
      // This might be malformed JSON with raw content mixed in
      // As a last resort, try to extract just the content
      console.warn(`[${debugLabel}] JSON parsing failed but structure was detected`);
      console.warn(`[${debugLabel}] Attempting last-resort raw content extraction...`);
      
      // Try to use the raw content anyway
      const lastResortCode = extractCode(trimmedContent, 'markdown');
      if (lastResortCode && lastResortCode !== trimmedContent) {
        const lastResortResult = {
          success: true,
          qualityScore: (fallback as any).qualityScore || 7.0,
          code: lastResortCode,
          explanation: 'Generated content (JSON parsing failed, extracted code as fallback)',
          keyDecisions: {
            architecture: 'Content extracted',
            security: 'N/A',
            performance: 'N/A',
            testing: 'N/A',
            documentation: 'Content extracted'
          }
        } as any;
        
        console.log(`[${debugLabel}] ✓ Last-resort extraction successful (${lastResortCode.length} characters)`);
        return lastResortResult as T;
      }
      
      console.warn(`[${debugLabel}] All extraction attempts failed, using fallback`);
    }
    
    return result;
  }
}

