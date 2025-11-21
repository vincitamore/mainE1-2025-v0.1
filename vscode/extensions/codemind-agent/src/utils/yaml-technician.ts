/**
 * YAML Technician - LLM-powered YAML repair agent
 * 
 * When YAML parsing fails, this specialist agent repairs the output.
 * Much simpler than JSON repair because YAML is more forgiving!
 */

import { LLMProvider, LLMConfig } from '../llm/provider';
import { parseYAML, extractYAML, repairYAML } from './yaml-parser';

export class YAMLTechnician {
  private llmProvider: LLMProvider;
  private config: LLMConfig;

  constructor(llmProvider: LLMProvider, config: LLMConfig) {
    this.llmProvider = llmProvider;
    this.config = config;
  }

  /**
   * Repair malformed YAML using LLM
   */
  async repairYAML(
    malformedYAML: string,
    context: string,
    expectedStructure?: string
  ): Promise<string> {
    console.log(`[YAML-Technician] Attempting to repair YAML for: ${context}`);
    console.log(`[YAML-Technician] Malformed YAML length: ${malformedYAML.length} chars`);

    const prompt = `You are a YAML repair specialist. Fix the following malformed YAML output.

**Context:** ${context}

${expectedStructure ? `**Expected Structure:**
\`\`\`yaml
${expectedStructure}
\`\`\`
` : ''}

**Malformed YAML:**
\`\`\`
${malformedYAML}
\`\`\`

**Your Task:**
1. Identify YAML syntax errors
2. Fix indentation issues
3. Fix unquoted special characters if needed
4. Ensure proper list/object syntax
5. Preserve all content and meaning

**Rules:**
- Return ONLY the fixed YAML (no explanations, no markdown code fences)
- Preserve all original content - just fix syntax
- Use proper YAML indentation (2 spaces)
- For multiline strings, use | (literal) or > (folded) blocks
- Don't add or remove any information

**Output the corrected YAML immediately:**`;

    try {
      const response = await this.llmProvider.generate(
        [{ role: 'user', content: prompt }],
        { 
          ...this.config, 
          temperature: 0.1, // Very low temperature for precise repairs
          maxTokens: 8000 
        }
      );

      const repairedYAML = extractYAML(response.content);
      console.log(`[YAML-Technician] Repaired YAML length: ${repairedYAML.length} chars`);

      // Verify the repair worked
      const testParse = parseYAML(repairedYAML);
      if (testParse.success) {
        console.log(`[YAML-Technician] ✅ Repair successful!`);
        return repairedYAML;
      } else {
        console.error(`[YAML-Technician] ❌ Repair failed, still invalid:`, testParse.error);
        throw new Error(`YAML Technician repair failed: ${testParse.error}`);
      }
    } catch (error) {
      console.error(`[YAML-Technician] ❌ Repair attempt failed:`, error);
      throw error;
    }
  }
}

/**
 * Parse YAML with automatic technician repair on failure
 * 
 * Three-tier strategy:
 * 1. Try direct parse
 * 2. Try basic cleanup + parse
 * 3. Call YAML Technician for LLM-powered repair
 */
export async function parseYAMLWithTechnician<T>(
  text: string,
  llmProvider: LLMProvider,
  config: LLMConfig,
  context: string,
  expectedStructure?: string
): Promise<T> {
  console.log(`[YAML-Parse] Attempting to parse YAML for: ${context}`);
  
  // Tier 1: Direct parse
  console.log(`[YAML-Parse] Tier 1: Direct parse...`);
  const directParse = parseYAML<T>(text);
  if (directParse.success) {
    console.log(`[YAML-Parse] ✅ Tier 1 success - direct parse worked`);
    return directParse.data;
  }
  console.log(`[YAML-Parse] ❌ Tier 1 failed:`, directParse.error);
  
  // Tier 2: Basic cleanup + parse
  console.log(`[YAML-Parse] Tier 2: Basic cleanup + parse...`);
  const cleaned = repairYAML(text);
  const cleanedParse = parseYAML<T>(cleaned);
  if (cleanedParse.success) {
    console.log(`[YAML-Parse] ✅ Tier 2 success - cleanup fixed it`);
    return cleanedParse.data;
  }
  console.log(`[YAML-Parse] ❌ Tier 2 failed:`, cleanedParse.error);
  
  // Tier 3: LLM-powered YAML Technician
  console.log(`[YAML-Parse] Tier 3: Calling YAML Technician...`);
  const technician = new YAMLTechnician(llmProvider, config);
  
  try {
    const repaired = await technician.repairYAML(text, context, expectedStructure);
    const repairedParse = parseYAML<T>(repaired);
    
    if (repairedParse.success) {
      console.log(`[YAML-Parse] ✅ Tier 3 success - YAML Technician fixed it!`);
      return repairedParse.data;
    } else {
      console.error(`[YAML-Parse] ❌ Tier 3 failed - even after technician repair:`, repairedParse.error);
      throw new Error(`YAML parsing failed even after technician repair: ${repairedParse.error}`);
    }
  } catch (error) {
    console.error(`[YAML-Parse] ❌ All tiers failed`);
    throw new Error(`Failed to parse YAML for ${context}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

