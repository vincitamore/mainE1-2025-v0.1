/**
 * Prompt template utilities for consistent agent instructions
 */

/**
 * Standard JSON output instructions that all agents should include
 */
export const JSON_OUTPUT_INSTRUCTIONS = `
CRITICAL OUTPUT FORMAT INSTRUCTIONS:
1. Return ONLY valid JSON (no markdown, no code blocks, no backticks)
2. Do NOT wrap your response in \`\`\`json or \`\`\` markers
3. Start directly with { and end with }
4. ESCAPE special characters in strings:
   - Use \\" for quotes inside strings
   - Use \\n for newlines inside strings
   - Use \\\\ for backslashes inside strings
5. NO trailing commas before } or ]
6. All string values must use double quotes (not single quotes)
7. The JSON must be parseable by JSON.parse()

Example of CORRECT output:
{
  "insights": ["observation 1", "observation 2"],
  "issues": {
    "critical": [{
      "description": "String with \\"escaped quotes\\" and\\nnewline",
      "fix": "Use proper escaping"
    }],
    "warnings": [],
    "suggestions": []
  },
  "recommendations": ["recommendation 1"],
  "confidence": 0.9
}

Example of WRONG output (DO NOT DO THIS):
\`\`\`json
{
  "insights": ["observation with "unescaped quotes""],
  "description": "Line 1
Line 2",
  "confidence": 0.9,
}
\`\`\`
`;

/**
 * Add standard instructions to any prompt
 */
export function addStandardInstructions(prompt: string): string {
  return prompt + '\n\n' + JSON_OUTPUT_INSTRUCTIONS;
}

