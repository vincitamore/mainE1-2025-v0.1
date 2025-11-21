/**
 * JSON Technician Agent
 * 
 * When JSON parsing fails, this agent analyzes the malformed output
 * and repairs it intelligently using LLM understanding.
 * 
 * Much more effective than algorithmic repair for complex cases!
 */

import { LLMProvider, LLMConfig } from '../llm/provider';

/**
 * JSON Technician - Repairs malformed JSON using LLM intelligence
 */
export class JSONTechnician {
  constructor(
    private llmProvider: LLMProvider,
    private config: LLMConfig
  ) {}

  /**
   * Repair malformed JSON output
   * 
   * @param malformedJSON The raw output that failed to parse
   * @param context What kind of data this should be (e.g., "task analysis", "execution plan")
   * @param expectedStructure Optional description of expected JSON structure
   * @returns Repaired valid JSON string
   */
  async repairJSON(
    malformedJSON: string,
    context: string,
    expectedStructure?: string
  ): Promise<string> {
    console.log(`[JSON Technician] Attempting to repair ${context}...`);
    console.log(`[JSON Technician] Input length: ${malformedJSON.length} characters`);

    const prompt = this.buildRepairPrompt(malformedJSON, context, expectedStructure);

    try {
      const response = await this.llmProvider.generate(
        [
          {
            role: 'system',
            content: `You are a JSON Technician - a specialist in repairing malformed JSON.

Your ONLY job is to take broken JSON and fix it to be valid.

RULES:
1. Return ONLY the fixed JSON (no explanations, no markdown, no extra text)
2. Preserve ALL the original data and intent
3. Fix formatting issues:
   - Escape newlines: use \\n instead of actual newlines
   - Escape quotes: use \\" for quotes in strings
   - Escape backslashes: use \\\\ 
   - Remove trailing commas
   - Add missing commas
   - Fix quote mismatches
4. If content has multiple lines, convert to single-line with \\n
5. Keep the same structure - just fix the syntax
6. Return ONLY valid JSON that will parse with JSON.parse()

You are the last line of defense - if you fail, the entire operation fails!`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        {
          ...this.config,
          temperature: 0.1, // Very low temperature for precise repairs
          maxTokens: 8192   // Allow for large JSON structures
        }
      );

      const repairedJSON = this.extractJSON(response.content);
      
      // Verify it parses
      try {
        JSON.parse(repairedJSON);
        console.log(`[JSON Technician] ✓ Successfully repaired ${context}`);
        console.log(`[JSON Technician] Output length: ${repairedJSON.length} characters`);
        return repairedJSON;
      } catch (parseError: any) {
        console.error(`[JSON Technician] ✗ Repaired JSON still invalid:`, parseError.message);
        throw new Error(`JSON Technician failed to produce valid JSON: ${parseError.message}`);
      }
    } catch (error: any) {
      console.error(`[JSON Technician] ✗ Repair failed:`, error.message);
      throw error;
    }
  }

  /**
   * Build the repair prompt
   */
  private buildRepairPrompt(
    malformedJSON: string,
    context: string,
    expectedStructure?: string
  ): string {
    let prompt = `# Task: Repair Malformed JSON\n\n`;

    prompt += `## Context\n`;
    prompt += `This JSON represents: ${context}\n\n`;

    if (expectedStructure) {
      prompt += `## Expected Structure\n`;
      prompt += expectedStructure + '\n\n';
    }

    prompt += `## Malformed JSON to Fix\n`;
    prompt += `The following JSON has syntax errors and needs to be repaired:\n\n`;
    prompt += '```\n';
    prompt += malformedJSON;
    prompt += '\n```\n\n';

    prompt += `## Common Issues to Fix\n`;
    prompt += `Look for and fix these problems:\n`;
    prompt += `1. **Unescaped newlines** - Actual line breaks in string values\n`;
    prompt += `   - BAD: "content": "Line 1\nLine 2"\n`;
    prompt += `   - GOOD: "content": "Line 1\\nLine 2"\n\n`;
    
    prompt += `2. **Unescaped quotes** - Quotes inside string values\n`;
    prompt += `   - BAD: "text": "She said "hello""\n`;
    prompt += `   - GOOD: "text": "She said \\"hello\\""\n\n`;
    
    prompt += `3. **Trailing commas** - Commas before closing braces/brackets\n`;
    prompt += `   - BAD: {"key": "value",}\n`;
    prompt += `   - GOOD: {"key": "value"}\n\n`;
    
    prompt += `4. **Missing commas** - Between array elements or object properties\n`;
    prompt += `   - BAD: {"a": 1 "b": 2}\n`;
    prompt += `   - GOOD: {"a": 1, "b": 2}\n\n`;
    
    prompt += `5. **Control characters** - Tabs, carriage returns, etc.\n`;
    prompt += `   - Replace \\t with \\\\t\n`;
    prompt += `   - Remove or escape \\r\n\n`;

    prompt += `## Your Task\n`;
    prompt += `1. Identify all syntax errors in the JSON\n`;
    prompt += `2. Fix them while preserving ALL original data\n`;
    prompt += `3. Return ONLY the fixed JSON (no markdown, no explanations)\n`;
    prompt += `4. Ensure it will successfully parse with JSON.parse()\n\n`;

    prompt += `## Output Format\n`;
    prompt += `Return the repaired JSON directly. Example:\n\n`;
    prompt += `{"key": "value with\\nnewline", "array": [1, 2, 3]}\n\n`;
    
    prompt += `⚠️ CRITICAL: Return ONLY the JSON. No "here's the fixed version", no markdown, no extra text!`;

    return prompt;
  }

  /**
   * Extract JSON from response (remove markdown if present)
   */
  private extractJSON(response: string): string {
    // Remove markdown code fences if present
    let json = response.trim();
    json = json.replace(/^```json?\s*/i, '');
    json = json.replace(/```\s*$/i, '');
    
    // Remove any leading/trailing text that's not JSON
    const jsonMatch = json.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (jsonMatch) {
      return jsonMatch[0];
    }
    
    return json;
  }
}

/**
 * Attempt to parse JSON with Technician fallback
 * 
 * This is the main entry point for JSON parsing with repair capability
 */
export async function parseJSONWithTechnician<T = any>(
  jsonStr: string,
  llmProvider: LLMProvider,
  llmConfig: LLMConfig,
  context: string,
  expectedStructure?: string
): Promise<T | null> {
  // Attempt 1: Direct parse
  try {
    console.log(`[JSON Parse] Attempting direct parse for ${context}...`);
    const result = JSON.parse(jsonStr);
    console.log(`[JSON Parse] ✓ Direct parse succeeded for ${context}`);
    return result;
  } catch (error: any) {
    console.log(`[JSON Parse] ✗ Direct parse failed for ${context}:`, error.message);
  }

  // Attempt 2: Basic cleanup and parse
  try {
    console.log(`[JSON Parse] Attempting cleanup parse for ${context}...`);
    let cleaned = jsonStr.trim();
    // Remove markdown fences
    cleaned = cleaned.replace(/^```json?\s*/i, '');
    cleaned = cleaned.replace(/```\s*$/i, '');
    // Extract JSON structure
    const match = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) {
      const result = JSON.parse(match[0]);
      console.log(`[JSON Parse] ✓ Cleanup parse succeeded for ${context}`);
      return result;
    }
  } catch (error: any) {
    console.log(`[JSON Parse] ✗ Cleanup parse failed for ${context}:`, error.message);
  }

  // Attempt 3: Call in the Technician
  console.log(`[JSON Parse] 🔧 Calling JSON Technician for ${context}...`);
  try {
    const technician = new JSONTechnician(llmProvider, llmConfig);
    const repairedJSON = await technician.repairJSON(jsonStr, context, expectedStructure);
    const result = JSON.parse(repairedJSON);
    console.log(`[JSON Parse] ✓ Technician repair succeeded for ${context}`);
    return result;
  } catch (error: any) {
    console.error(`[JSON Parse] ✗ Technician repair failed for ${context}:`, error.message);
    console.error(`[JSON Parse] Original JSON (first 500 chars):`, jsonStr.substring(0, 500));
    return null;
  }
}

