/**
 * N² Self-Correction Loop Controller
 * 
 * Meta-cognitive layer that ensures quality through iterative refinement
 * "Is this solution good enough? If not, how do we improve it?"
 */

import { Agent, CodeContext, AgentAnalysis } from '../agents/agent';
import { ODAISynthesizer } from './odai-synthesizer';
import { N2Result, Iteration, RepairDirective } from './types';
import { TaskType } from '../utils/task-classifier';

export type ProgressCallback = (event: ProgressEvent) => void;

export interface ProgressEvent {
  type: 'iteration_start' | 'agents_start' | 'agent_complete' | 'agents_complete' | 'synthesis_start' | 'synthesis_complete' | 'iteration_complete';
  iteration?: number;
  agent?: string;
  agentIndex?: number;
  totalAgents?: number;
  qualityScore?: number;
  elapsed?: number;
  confidence?: number;
  insights?: string[];
  issueCount?: number;
  synthesisPreview?: string;
}

export class N2Controller {
  constructor(
    private maxIterations: number = 4,
    private qualityThreshold: number = 9.0
  ) {}
  
  /**
   * Execute N² loop: iterative refinement until quality threshold met
   * 
   * @returns Final result with complete iteration history
   */
  async execute(
    request: string,
    agents: Agent[],
    synthesizer: ODAISynthesizer,
    context: CodeContext,
    taskType: TaskType = TaskType.GENERAL,
    progressCallback?: ProgressCallback
  ): Promise<N2Result> {
    const history: Iteration[] = [];
    const startTime = Date.now();
    let currentRepairDirective: RepairDirective | undefined;
    let bestResult: N2Result | null = null;
    let bestScore = 0;
    let plateauCount = 0; // Track how many iterations quality hasn't improved
    
    console.log(`[N²] Starting self-correction loop (max ${this.maxIterations} iterations)`);
    console.log(`[N²] Quality threshold: ${this.qualityThreshold}/10`);
    
    for (let i = 0; i < this.maxIterations; i++) {
      const iterationNum = i + 1;
      console.log(`\n[N²] ========== Iteration ${iterationNum}/${this.maxIterations} ==========`);
      
      // Report iteration start
      progressCallback?.({
        type: 'iteration_start',
        iteration: iterationNum
      });
      
      try {
        // Execute iteration
        const iteration = await this.executeIteration(
          iterationNum,
          request,
          agents,
          synthesizer,
          context,
          taskType,
          currentRepairDirective,
          progressCallback
        );
        
        history.push(iteration);
        
        // Track best result and check for improvement
        const previousBestScore = bestScore;
        const improved = iteration.qualityScore > bestScore + 0.1; // Improvement threshold
        
        if (iteration.qualityScore > bestScore) {
          bestScore = iteration.qualityScore;
          plateauCount = 0; // Reset plateau counter on improvement
          if (iteration.synthesis.success && iteration.synthesis.code) {
            bestResult = {
              success: true,
              finalCode: iteration.synthesis.code,
              explanation: iteration.synthesis.explanation || '',
              qualityScore: iteration.qualityScore,
              iterations: history,
              totalTime: Date.now() - startTime,
              converged: iteration.qualityScore >= this.qualityThreshold,
              keyDecisions: iteration.synthesis.keyDecisions || {
                architecture: '',
                security: '',
                performance: '',
                testing: ''
              }
            };
          }
        } else {
          // Quality didn't improve significantly
          plateauCount++;
          console.log(`[N²] Quality plateau detected (count: ${plateauCount}/2, score: ${iteration.qualityScore.toFixed(1)} vs best: ${previousBestScore.toFixed(1)})`);
        }
        
        // Early stopping: check if quality has regressed
        if (iterationNum > 1 && iteration.qualityScore < history[history.length - 2].qualityScore - 0.3) {
          console.log(`[N²] ⚠️ Quality regressed significantly (${history[history.length - 2].qualityScore.toFixed(1)} → ${iteration.qualityScore.toFixed(1)})`);
          console.log(`[N²] Stopping early to prevent further degradation`);
          break;
        }
        
        // Early stopping: check if quality has plateaued for 2 iterations
        if (plateauCount >= 2) {
          console.log(`[N²] Quality plateaued for 2 iterations (best: ${bestScore.toFixed(1)})`);
          console.log(`[N²] Stopping early - further iterations unlikely to improve`);
          break;
        }
        
        // Check convergence
        if (iteration.qualityScore >= this.qualityThreshold && iteration.synthesis.success) {
          console.log(`[N²] ✓ Quality threshold met: ${iteration.qualityScore}/10`);
          console.log(`[N²] Converged in ${iterationNum} iteration(s)`);
          
          return bestResult || this.createFailureResult(history, startTime, 'No successful iteration');
        }
        
        // Check if we have repair directive for next iteration
        if (iteration.synthesis.repairDirective) {
          console.log(`[N²] Quality below threshold (${iteration.qualityScore}/10), continuing...`);
          currentRepairDirective = iteration.synthesis.repairDirective;
        } else {
          console.log(`[N²] No repair directive generated, stopping.`);
          break;
        }
        
      } catch (error: any) {
        console.error(`[N²] Iteration ${iterationNum} failed:`, error.message);
        // Continue to next iteration unless it's the last one
        if (i === this.maxIterations - 1) {
          break;
        }
      }
    }
    
    // Max iterations reached or error
    console.log(`[N²] Did not converge after ${this.maxIterations} iterations`);
    console.log(`[N²] Best quality score achieved: ${bestScore}/10`);
    
    // Return best result found, or failure
    if (bestResult) {
      return {
        ...bestResult,
        converged: false,
        totalTime: Date.now() - startTime
      };
    }
    
    return this.createFailureResult(history, startTime, 'Failed to generate acceptable solution');
  }
  
  /**
   * Execute a single iteration of the N² loop
   */
  private async executeIteration(
    iterationNum: number,
    request: string,
    agents: Agent[],
    synthesizer: ODAISynthesizer,
    context: CodeContext,
    taskType: TaskType,
    repairDirective?: RepairDirective,
    progressCallback?: ProgressCallback
  ): Promise<Iteration> {
    const iterationStart = Date.now();
    
    // Step 1: Execute all agents in parallel
    console.log(`[N²] Running ${agents.length} agents in parallel...`);
    const agentStart = Date.now();
    
    // Report agents start
    progressCallback?.({
      type: 'agents_start',
      iteration: iterationNum,
      totalAgents: agents.length
    });
    
    const analyses = await Promise.all(
      agents.map(async (agent, index) => {
        const agentRepairDirective = repairDirective?.agentSpecific?.[agent.role];
        const analysis = await agent.analyze(
          request,
          context,
          taskType,
          agentRepairDirective
        );
        
        // Report individual agent completion with detailed info
        const issueCount = analysis.issues.critical.length + analysis.issues.warnings.length;
        progressCallback?.({
          type: 'agent_complete',
          iteration: iterationNum,
          agent: agent.role,
          agentIndex: index + 1,
          totalAgents: agents.length,
          elapsed: Date.now() - agentStart,
          confidence: analysis.confidence,
          insights: analysis.insights.slice(0, 2), // First 2 insights
          issueCount: issueCount
        });
        
        return analysis;
      })
    );
    
    const agentTime = Date.now() - agentStart;
    console.log(`[N²] Agents completed in ${agentTime}ms`);
    
    // Report all agents complete
    progressCallback?.({
      type: 'agents_complete',
      iteration: iterationNum,
      elapsed: agentTime
    });
    
    // Log agent insights
    analyses.forEach(a => {
      const issueCount = a.issues.critical.length + a.issues.warnings.length;
      console.log(`  - ${a.agent}: ${issueCount} issues, confidence ${a.confidence}`);
    });
    
    // Step 2: ODAI Synthesis
    console.log(`[N²] Running ODAI synthesis...`);
    const synthesisStart = Date.now();
    
    // Report synthesis start
    progressCallback?.({
      type: 'synthesis_start',
      iteration: iterationNum
    });
    
    const synthesis = await synthesizer.synthesize(request, analyses, context, taskType);
    
    const synthesisTime = Date.now() - synthesisStart;
    console.log(`[N²] Synthesis completed in ${synthesisTime}ms`);
    console.log(`[N²] Quality score: ${synthesis.qualityScore}/10`);
    
    // Report synthesis complete with preview
    const synthesisPreview = synthesis.success 
      ? synthesis.explanation?.substring(0, 150) + (synthesis.explanation && synthesis.explanation.length > 150 ? '...' : '')
      : 'Generating repair directive...';
    
    progressCallback?.({
      type: 'synthesis_complete',
      iteration: iterationNum,
      qualityScore: synthesis.qualityScore,
      elapsed: synthesisTime,
      synthesisPreview: synthesisPreview
    });
    
    const totalTime = Date.now() - iterationStart;
    
    // Report iteration complete
    progressCallback?.({
      type: 'iteration_complete',
      iteration: iterationNum,
      qualityScore: synthesis.qualityScore,
      elapsed: totalTime
    });
    
    return {
      number: iterationNum,
      analyses: analyses,
      synthesis: synthesis,
      qualityScore: synthesis.qualityScore,
      repairDirective: synthesis.repairDirective,
      agentTime: agentTime,
      synthesisTime: synthesisTime,
      totalTime: totalTime
    };
  }
  
  /**
   * Create failure result when N² loop doesn't converge
   */
  private createFailureResult(
    history: Iteration[],
    startTime: number,
    reason: string
  ): N2Result {
    // Try to use the best iteration's code if available
    const bestIteration = history.reduce((best, current) => 
      current.qualityScore > best.qualityScore ? current : best
    , history[0]);
    
    return {
      success: false,
      finalCode: bestIteration?.synthesis.code || '',
      explanation: `N² loop did not converge: ${reason}. Best score: ${bestIteration?.qualityScore || 0}/10`,
      qualityScore: bestIteration?.qualityScore || 0,
      iterations: history,
      totalTime: Date.now() - startTime,
      converged: false,
      keyDecisions: bestIteration?.synthesis.keyDecisions || {
        architecture: '',
        security: '',
        performance: '',
        testing: ''
      }
    };
  }
  
  /**
   * Get summary statistics from N² execution
   */
  getSummary(result: N2Result): string {
    const avgScore = result.iterations.reduce((sum, it) => sum + it.qualityScore, 0) / result.iterations.length;
    const totalAgentTime = result.iterations.reduce((sum, it) => sum + it.agentTime, 0);
    const totalSynthesisTime = result.iterations.reduce((sum, it) => sum + it.synthesisTime, 0);
    
    return `
N² Execution Summary:
- Converged: ${result.converged ? 'Yes' : 'No'}
- Iterations: ${result.iterations.length}
- Final Quality: ${result.qualityScore.toFixed(1)}/10
- Average Quality: ${avgScore.toFixed(1)}/10
- Total Time: ${result.totalTime}ms
- Agent Time: ${totalAgentTime}ms (${((totalAgentTime / result.totalTime) * 100).toFixed(0)}%)
- Synthesis Time: ${totalSynthesisTime}ms (${((totalSynthesisTime / result.totalTime) * 100).toFixed(0)}%)
    `.trim();
  }
}

