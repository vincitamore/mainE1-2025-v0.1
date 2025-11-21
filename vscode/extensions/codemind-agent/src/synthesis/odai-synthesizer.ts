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
import { parseJSONWithTechnician } from '../utils/json-technician';
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
    
    return await this.parseJSON<Observation>(response.content, {
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
    
    return await this.parseJSON<Distillation>(response.content, {
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
    
    const repairDirective = await this.parseJSON<RepairDirective>(response.content, {
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
    // Check BOTH task type AND file type (markdown, text files)
    const isDocumentationFile = taskType === TaskType.DOCUMENTATION || 
                                context.language === 'markdown' ||
                                context.language === 'plaintext' ||
                                context.filePath.match(/\.(md|txt|rst|adoc)$/i);
    const isEmptyDocument = context.code.trim().length < 200 && isDocumentationFile;
    
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
- This should be a production-ready, thorough document
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
      // No selection range - check if document is empty for full document generation
      if (isEmptyDocument) {
        codeSection = `CURRENT FILE (ESSENTIALLY EMPTY - new file or just stub):
\`\`\`${context.language}
${context.code}
\`\`\`

USER REQUEST: Generate a COMPLETE, comprehensive ${context.language} document.`;
        
        scopeInstructions = `⚠️ CRITICAL SCOPE:
- The file is currently EMPTY or has minimal content
- You must generate the COMPLETE, COMPREHENSIVE document from scratch
- Generate ALL sections, content, examples, diagrams, and details
- This should be a production-ready, thorough document
- DO NOT return just a snippet or outline - generate the FULL content`;
      } else if (taskType === TaskType.REFACTORING) {
        // REFACTORING = modifying existing file (orchestrator detected this is a "modify" operation)
        // We need to be SURGICAL - only change what needs to change
        codeSection = `EXISTING CODE (file already has working implementation):
\`\`\`${context.language}
${context.code}
\`\`\``;
        
        scopeInstructions = `⚠️ CRITICAL: SURGICAL MODIFICATION REQUIRED
This is an EXISTING, WORKING file. You must be EXTREMELY CAREFUL to preserve all existing functionality.

**MODIFICATION STRATEGY:**
1. ANALYZE what needs to change based on the user request and synthesis requirements
2. PRESERVE all existing code that is NOT related to the requested changes
3. Make MINIMAL, TARGETED changes to accomplish the goal
4. Do NOT refactor or "improve" code that wasn't requested
5. KEEP all existing imports, types, constants, and helper functions unless they conflict with changes
6. MAINTAIN the existing code style, patterns, and architecture

**OUTPUT THE FULL FILE** with your surgical modifications applied.
- Include ALL existing code (preserved sections + your modifications)
- Your changes should be the MINIMUM necessary to fulfill the requirements
- If adding new functions/classes, place them appropriately without disrupting existing structure
- If modifying existing functions, change only what's needed for the requirements

**WRONG APPROACH:**
❌ Regenerating the entire file from scratch
❌ Removing existing code that works
❌ Changing code style or structure unnecessarily
❌ Adding features not requested

**CORRECT APPROACH:**
✅ Identify specific functions/sections that need modification
✅ Preserve everything else exactly as-is
✅ Make targeted, minimal changes
✅ Output the complete file with your surgical edits applied`;
      } else {
        // CODE_GENERATION or GENERAL = creating new file
        codeSection = `EXISTING CODE:
\`\`\`${context.language}
${context.code}
\`\`\``;
        scopeInstructions = `Generate the COMPLETE implementation for this ${taskType === TaskType.CODE_GENERATION ? 'new' : ''} file.`;
      }
    }
    
    const prompt = `Generate the COMPLETE, COMPREHENSIVE final implementation based on synthesis.

⚠️ CRITICAL: You must generate the ENTIRE implementation, not just a stub or example!
- If requirements specify "fully structured document with sections A, B, C, D" → Generate ALL sections completely
- If requirements specify "include diagrams, code snippets, checklists" → Include ALL of them
- If requirements specify comprehensive documentation → Generate complete, thorough content
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

⚠️⚠️⚠️ CRITICAL INSTRUCTIONS - YOU ARE WRITING DIRECTLY TO THE FILE ⚠️⚠️⚠️

**OUTPUT FORMAT: RAW CONTENT (NO JSON WRAPPER!)**

You are writing the ACTUAL file content. Your response will be written DIRECTLY to the file.

1. Do NOT wrap your output in JSON (no {"code": "..."})
2. Do NOT add markdown code fences unless they're part of the actual content
3. Do NOT add explanations outside the file content
4. Generate COMPLETE, COMPREHENSIVE, production-ready content
5. For documentation: Include diagrams (if appropriate), full sections, complete examples
6. For code: Include complete implementations with imports, types, error handling
7. Your ENTIRE response = the ENTIRE file content

CORRECT EXAMPLES:

For a README.md file (your ENTIRE response):
# Project Title

> A brief tagline describing the project

## Overview
Full description here covering what the project does, why it exists, and who it's for...

## Features
- Feature 1 with detailed explanation
- Feature 2 with detailed explanation
- Feature 3 with detailed explanation

## Architecture
\`\`\`mermaid
graph TD
  A[Component 1] --> B[Component 2]
  B --> C[Component 3]
\`\`\`

## Installation
\`\`\`bash
npm install project-name
\`\`\`

## Usage
Complete usage examples with code...

For a TypeScript file (your ENTIRE response):
import { Something } from './types';
import { anotherThing } from './utils';

/**
 * Class documentation
 */
export class MyClass {
  private data: string;
  
  constructor(input: string) {
    this.data = input;
  }
  
  public process(): void {
    // Full implementation with error handling
  }
}

For an implementation plan (your ENTIRE response):
# Implementation Plan

## Overview
Brief description of what we're building...

## Phase 1: Foundation
- [ ] Set up project structure
- [ ] Configure build tools
- [ ] Initialize version control

## Phase 2: Core Features
- [ ] Implement feature A
- [ ] Implement feature B
...

## Testing Strategy
Complete testing approach...`;

    const response = await this.llmProvider.generate(
      [
        {
          role: 'system',
          content: `You are a code/documentation generation assistant.

⚠️⚠️⚠️ CRITICAL: YOU ARE WRITING DIRECTLY TO THE FILE ⚠️⚠️⚠️

OUTPUT FORMAT (ABSOLUTELY MANDATORY):
1. Your response IS the actual file content - it will be written directly to the file AS-IS
2. Do NOT wrap in JSON (no {"code": "..."} wrapper - just the raw content!)
3. Do NOT add explanations or commentary outside the file
4. Do NOT add markdown code fences unless they're part of the actual file
5. Your ENTIRE response = the ENTIRE file content

COMPLETENESS (ABSOLUTELY MANDATORY):
6. Generate COMPLETE, COMPREHENSIVE content - NOT snippets, stubs, or placeholders
7. If requirements specify sections A, B, C, D → Generate ALL sections with FULL content
8. Generate whatever length is necessary to fully accomplish the task
9. Include diagrams (if appropriate), code examples, checklists, complete explanations
10. Apply ALL recommendations from security, performance, architecture, and testing agents

CORRECT EXAMPLES:

For a README.md file (your ENTIRE response - NO JSON):
# Project Title

> A brief tagline

## Overview
Comprehensive description covering purpose, features, and usage...

## Features
- Complete feature descriptions
- With detailed explanations
- And usage examples

## Installation
\`\`\`bash
npm install project-name
\`\`\`

## Usage
Full usage documentation...

For a TypeScript file (your ENTIRE response - NO JSON):
import { Something } from './types';
import { anotherThing } from './utils';

export class MyClass {
  constructor() {
    // Complete implementation with error handling
  }
  
  public method(): void {
    // Full method implementation
  }
}

WRONG - Do NOT do this:
{"code": "# Title\\n\\nContent"}  ← NO JSON WRAPPER!
\`\`\`markdown
# Title
\`\`\`  ← NO CODE FENCES (unless part of file)

SUCCESS = Your raw response written directly to file`
        },
        { role: 'user', content: prompt }
      ],
      { ...this.config, temperature: 0.4, maxTokens: 50000 }  // Max for code generation
    );
    
    // CRITICAL: For Integrate phase, use RAW response as file content (no JSON parsing!)
    // The LLM generates actual file content directly, not wrapped in JSON
    console.log(`[ODAI-Integrate] Using raw response as file content (${response.content.length} chars)`);
    
    const result: SynthesisResult = {
      success: true,
      qualityScore: distillation.qualityScore, // Use quality from distillation
      code: response.content.trim(), // Raw LLM response IS the file content
      explanation: `Generated ${context.language} content incorporating all agent recommendations`,
      keyDecisions: {
        architecture: 'Applied architectural patterns from analysis',
        security: 'Incorporated security best practices',
        performance: 'Optimized based on performance insights',
        testing: 'Included comprehensive testing approach'
      }
    };
    
    // NO extraction - raw response is the actual file content!
    // We explicitly instructed the LLM to output raw content, not wrapped in code blocks
    
    return result;
  }
  
  /**
   * Safely parse JSON with fallback
   * Special handling: If LLM returns raw code/markdown instead of JSON, auto-wrap it
   * 
   * Strategy: Try to find JSON first. If no JSON found anywhere, treat as raw content.
   */
  private async parseJSON<T>(content: string, fallback: T, phase?: string): Promise<T> {
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
    
    // JSON structure found - try to parse it with Technician fallback
    const jsonStr = extractJSON(content);
    
    // Try parseJSONWithTechnician for intelligent repair
    let result: T | null = null;
    try {
      result = await parseJSONWithTechnician<T>(
        jsonStr,
        this.llmProvider,
        this.config,
        `ODAI ${phase || 'synthesis'}`,
        phase === 'Integrate' ? 'SynthesisResult with code, explanation, qualityScore, keyDecisions' : undefined
      );
    } catch (error) {
      console.error(`[${debugLabel}] JSON Technician also failed:`, error);
    }
    
    if (!result && phase === 'Integrate') {
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
    
    return result || fallback;
  }
}

