/**
 * Types for ODAI Synthesis and N² Loop
 */

import { AgentAnalysis, CodeContext } from '../agents/agent';

// ODAI Phase 1: Observe
export interface Observation {
  coreNeed: string;
  patterns: string[];
  conflicts: string[];
  criticalIssues: string[];
  unifiedDirection: string;
}

// ODAI Phase 2: Distill
export interface Distillation {
  coreRequirements: string[];
  keyConstraints: string[];
  implementationPrinciples: string[];
  qualityScore: number;
  scoringRationale: string;
}

// ODAI Phase 3: Adapt (Repair Directive)
export interface RepairDirective {
  overallGuidance: string;
  agentSpecific: {
    architect?: string;
    engineer?: string;
    security?: string;
    performance?: string;
    testing?: string;
    documentation?: string;
  };
  focusAreas: string[];
}

// ODAI Phase 4: Integrate (Final Result)
export interface SynthesisResult {
  success: boolean;
  qualityScore: number;
  code?: string;
  explanation?: string;
  keyDecisions?: {
    architecture: string;
    security: string;
    performance: string;
    testing: string;
    [key: string]: string;
  };
  repairDirective?: RepairDirective;
}

// N² Loop Iteration
export interface Iteration {
  number: number;
  analyses: AgentAnalysis[];
  synthesis: SynthesisResult;
  qualityScore: number;
  repairDirective?: RepairDirective;
  agentTime: number;
  synthesisTime: number;
  totalTime: number;
}

// N² Final Result
export interface N2Result {
  success: boolean;
  finalCode: string;
  explanation: string;
  qualityScore: number;
  iterations: Iteration[];
  totalTime: number;
  converged: boolean;
  keyDecisions: {
    architecture: string;
    security: string;
    performance: string;
    testing: string;
    [key: string]: string;
  };
}



