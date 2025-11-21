/**
 * Agent Base Class for CodeMind
 * 
 * Each specialist agent analyzes code from their unique perspective.
 * The hierarchical system: Specialists → Synthesis → Quality Control
 */

import { LLMProvider, LLMConfig, LLMMessage } from '../llm/provider';
import { parseYAML, extractYAML } from '../utils/yaml-parser';
import { TaskType, getTaskGuidance, getExpectedRelevance } from '../utils/task-classifier';

export enum AgentRole {
  ARCHITECT = 'architect',
  ENGINEER = 'engineer',
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  TESTING = 'testing',
  DOCUMENTATION = 'documentation'
}

export interface Issue {
  type: string;
  line?: number;
  description: string;
  fix: string;
  impact?: string;
}

export interface AgentAnalysis {
  agent: AgentRole;
  insights: string[];
  issues: {
    critical: Issue[];
    warnings: Issue[];
    suggestions: Issue[];
  };
  recommendations: string[];
  confidence: number; // 0-1: How confident am I in this analysis?
  relevance: number;   // 0-1: How relevant is my expertise to this task?
  executionTime: number;
}

export interface Diagnostic {
  line: number;
  character: number;
  severity: 'error' | 'warning' | 'info' | 'hint';
  message: string;
  source?: string;  // e.g., 'typescript', 'eslint'
  code?: string | number;
}

export interface CodeContext {
  code: string;              // The full file content for context
  filePath: string;
  language: string;
  selection?: string;        // DEPRECATED: Use selectionRange instead
  selectionRange?: {         // The specific portion user highlighted
    start: { line: number; character: number };
    end: { line: number; character: number };
    text: string;            // The actual selected text
  };
  diagnostics?: Diagnostic[];  // Linter/compiler errors and warnings
  framework?: string;
}

/**
 * Base class for all specialist agents
 */
export abstract class Agent {
  abstract readonly role: AgentRole;
  abstract readonly perspective: string;
  
  constructor(
    protected llmProvider: LLMProvider,
    protected config: LLMConfig
  ) {}
  
  /**
   * Analyze code from this agent's specialized perspective
   */
  async analyze(
    request: string,
    context: CodeContext,
    taskType: TaskType = TaskType.GENERAL,
    repairDirective?: string
  ): Promise<AgentAnalysis> {
    const result = await this.analyzeWithRawResponse(request, context, taskType, repairDirective);
    return result.analysis;
  }

  /**
   * Analyze code and return both analysis and raw response for JSON repair if needed
   */
  async analyzeWithRawResponse(
    request: string,
    context: CodeContext,
    taskType: TaskType = TaskType.GENERAL,
    repairDirective?: string
  ): Promise<{ analysis: AgentAnalysis; rawResponse: string; parseFailed: boolean }> {
    const startTime = Date.now();
    
    // Get task-specific guidance for this agent
    const taskGuidance = getTaskGuidance(taskType, this.role);
    const expectedRelevance = getExpectedRelevance(taskType, this.role);
    
    // Build agent-specific prompt
    const prompt = this.buildPrompt(request, context, taskType, taskGuidance, repairDirective);
    
    const response = await this.llmProvider.generate(
      [
        {
          role: 'system',
          content: `You are an expert ${this.role} agent. Your perspective: ${this.perspective}. Output Format: YAML (2-space indentation, no code fences).`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      this.config
    );
    
    const analysis = this.parseResponse(response.content, expectedRelevance);
    analysis.executionTime = Date.now() - startTime;
    
    // Check if parsing failed (indicated by fallback values)
    const parseFailed = analysis.insights[0] === 'Failed to parse response - using fallback';
    
    return {
      analysis,
      rawResponse: response.content,
      parseFailed
    };
  }
  
  /**
   * Build the prompt for this agent's analysis
   */
  protected abstract buildPrompt(
    request: string,
    context: CodeContext,
    taskType: TaskType,
    taskGuidance: string,
    repairDirective?: string
  ): string;
  
  /**
   * Helper to format code context with selection highlighting
   * Shows full file with clear markers around the user's selection
   */
  protected formatCodeWithSelection(context: CodeContext): string {
    if (!context.selectionRange) {
      // Fallback for old format
      return `File: ${context.filePath}\nLanguage: ${context.language}\n\n${context.code}`;
    }
    
    const { selectionRange } = context;
    const lines = context.code.split('\n');
    const startLine = selectionRange.start.line;
    const endLine = selectionRange.end.line;
    
    let result = `File: ${context.filePath}\nLanguage: ${context.language}\n\n`;
    
    // Add diagnostics section if available
    if (context.diagnostics && context.diagnostics.length > 0) {
      result += `⚠️ EXISTING ISSUES DETECTED BY LINTER/COMPILER:\n`;
      result += `(Fix these issues or avoid introducing similar ones)\n\n`;
      
      // Group by severity
      const errors = context.diagnostics.filter(d => d.severity === 'error');
      const warnings = context.diagnostics.filter(d => d.severity === 'warning');
      const info = context.diagnostics.filter(d => d.severity === 'info' || d.severity === 'hint');
      
      if (errors.length > 0) {
        result += `🔴 ERRORS (${errors.length}):\n`;
        errors.forEach(d => {
          const inSelection = d.line >= startLine && d.line <= endLine;
          const marker = inSelection ? ' [IN SELECTION] ⚡' : '';
          result += `  Line ${d.line + 1}, Col ${d.character}: ${d.message}${marker}\n`;
          if (d.source) result += `    Source: ${d.source}\n`;
        });
        result += '\n';
      }
      
      if (warnings.length > 0) {
        result += `🟡 WARNINGS (${warnings.length}):\n`;
        warnings.forEach(d => {
          const inSelection = d.line >= startLine && d.line <= endLine;
          const marker = inSelection ? ' [IN SELECTION] ⚡' : '';
          result += `  Line ${d.line + 1}, Col ${d.character}: ${d.message}${marker}\n`;
          if (d.source) result += `    Source: ${d.source}\n`;
        });
        result += '\n';
      }
      
      if (info.length > 0 && info.length <= 5) {  // Only show if not too many
        result += `ℹ️ INFO/HINTS (${info.length}):\n`;
        info.forEach(d => {
          const inSelection = d.line >= startLine && d.line <= endLine;
          const marker = inSelection ? ' [IN SELECTION] ⚡' : '';
          result += `  Line ${d.line + 1}: ${d.message}${marker}\n`;
        });
        result += '\n';
      }
      
      result += `---\n\n`;
    }
    
    result += `USER SELECTED LINES ${startLine + 1}-${endLine + 1} (marked with >>> and <<<)\n`;
    result += `Full file context provided below:\n\n`;
    result += '```' + context.language + '\n';
    
    lines.forEach((line, index) => {
      const lineNum = (index + 1).toString().padStart(4, ' ');
      
      if (index === startLine) {
        result += `${lineNum}| >>> USER SELECTION STARTS >>>\n`;
      }
      
      result += `${lineNum}| ${line}\n`;
      
      if (index === endLine) {
        result += `${lineNum}| <<< USER SELECTION ENDS <<<\n`;
      }
    });
    
    result += '```\n\n';
    result += `Focus your analysis on lines ${startLine + 1}-${endLine + 1}, but consider the full file context for:\n`;
    result += `- Import statements and dependencies\n`;
    result += `- Type definitions and interfaces\n`;
    result += `- Related functions and methods\n`;
    result += `- Class/module structure\n`;
    result += `- Overall code patterns\n`;
    
    if (context.diagnostics && context.diagnostics.length > 0) {
      result += `- Existing linter/compiler issues (shown above)\n`;
      const issuesInSelection = context.diagnostics.filter(d => 
        d.line >= startLine && d.line <= endLine
      );
      if (issuesInSelection.length > 0) {
        result += `\n⚡ IMPORTANT: The selected code has ${issuesInSelection.length} existing issue(s) marked [IN SELECTION]. Address these!\n`;
      }
    }
    
    return result;
  }
  
  /**
   * Parse LLM response into structured AgentAnalysis
   */
  // Make parseResponse public so N2Controller can call it after YAML Technician repair
  public parseResponse(response: string, expectedRelevance: number): AgentAnalysis {
    const yamlStr = extractYAML(response);
    
    // Parse YAML (more forgiving than JSON!)
    const result = parseYAML<any>(yamlStr);
    
    if (result.success && result.data && typeof result.data === 'object') {
      // Validate and provide defaults for required fields
      const validated = this.validateAndRepairAnalysis(result.data, expectedRelevance);
      
      return {
        agent: this.role,
        insights: validated.insights,
        issues: validated.issues,
        recommendations: validated.recommendations,
        confidence: validated.confidence,
        relevance: validated.relevance,
        executionTime: 0
      };
    }
    
    // Absolute fallback if all parsing attempts failed
    console.warn(`[${this.role}] YAML parsing failed:`, !result.success ? result.error : 'Unknown error');
    
    return {
      agent: this.role,
      insights: ['Failed to parse response - using fallback'],
      issues: { critical: [], warnings: [], suggestions: [] },
      recommendations: [],
      confidence: 0.3,
      relevance: expectedRelevance,  // Use expected relevance as fallback
      executionTime: 0
    };
  }
  
  /**
   * Validate parsed response and repair missing/incomplete fields
   */
  private validateAndRepairAnalysis(parsed: any, expectedRelevance: number): {
    insights: string[];
    issues: { critical: Issue[]; warnings: Issue[]; suggestions: Issue[] };
    recommendations: string[];
    confidence: number;
    relevance: number;
  } {
    // Validate insights
    let insights: string[] = [];
    if (Array.isArray(parsed.insights)) {
      insights = parsed.insights.filter((i: any) => typeof i === 'string');
    }
    if (insights.length === 0) {
      console.warn(`[${this.role}] Missing or invalid insights field`);
      insights = ['Analysis completed but insights unavailable'];
    }
    
    // Validate issues
    let issues: { critical: Issue[]; warnings: Issue[]; suggestions: Issue[] } = {
      critical: [],
      warnings: [],
      suggestions: []
    };
    if (parsed.issues && typeof parsed.issues === 'object') {
      issues = {
        critical: this.validateIssueArray(parsed.issues.critical || []),
        warnings: this.validateIssueArray(parsed.issues.warnings || []),
        suggestions: this.validateIssueArray(parsed.issues.suggestions || [])
      };
    } else {
      console.warn(`[${this.role}] Missing or invalid issues field`);
    }
    
    // Validate recommendations
    let recommendations: string[] = [];
    if (Array.isArray(parsed.recommendations)) {
      recommendations = parsed.recommendations.filter((r: any) => typeof r === 'string');
    }
    if (recommendations.length === 0 && (issues.critical.length > 0 || issues.warnings.length > 0)) {
      console.warn(`[${this.role}] Missing recommendations field - generating from issues`);
      recommendations = this.generateRecommendationsFromIssues(issues);
    }
    
    // Validate confidence
    let confidence = 0.8;
    if (typeof parsed.confidence === 'number' && parsed.confidence >= 0 && parsed.confidence <= 1) {
      confidence = parsed.confidence;
    } else {
      console.warn(`[${this.role}] Missing or invalid confidence field, using default 0.8`);
    }
    
    // Validate relevance
    let relevance = expectedRelevance;
    if (typeof parsed.relevance === 'number' && parsed.relevance >= 0 && parsed.relevance <= 1) {
      relevance = parsed.relevance;
    } else {
      console.warn(`[${this.role}] Missing or invalid relevance field, using expected ${expectedRelevance.toFixed(2)}`);
    }
    
    return { insights, issues, recommendations, confidence, relevance };
  }
  
  /**
   * Validate an array of issues
   */
  private validateIssueArray(issueArray: any[]): Issue[] {
    if (!Array.isArray(issueArray)) {
      return [];
    }
    
    return issueArray
      .filter((issue: any) => issue && typeof issue === 'object')
      .map((issue: any) => ({
        type: issue.type || 'unknown',
        line: typeof issue.line === 'number' ? issue.line : undefined,
        description: issue.description || 'No description provided',
        fix: issue.fix || 'No fix suggested',
        impact: issue.impact
      }));
  }
  
  /**
   * Generate basic recommendations from issues when recommendations field is missing
   */
  private generateRecommendationsFromIssues(issues: {
    critical: Issue[];
    warnings: Issue[];
    suggestions: Issue[];
  }): string[] {
    const recommendations: string[] = [];
    
    if (issues.critical.length > 0) {
      recommendations.push(`Address ${issues.critical.length} critical issue(s) immediately`);
    }
    if (issues.warnings.length > 0) {
      recommendations.push(`Review ${issues.warnings.length} warning(s) for potential improvements`);
    }
    if (issues.suggestions.length > 0) {
      recommendations.push(`Consider ${issues.suggestions.length} suggestion(s) for enhanced quality`);
    }
    
    // Add specific recommendations from critical issues
    issues.critical.slice(0, 2).forEach(issue => {
      if (issue.fix) {
        recommendations.push(issue.fix);
      }
    });
    
    return recommendations;
  }
}

