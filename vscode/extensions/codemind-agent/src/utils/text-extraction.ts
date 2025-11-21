/**
 * Text extraction utilities for cleaning LLM responses
 * Handles both JSON extraction and code extraction
 */

/**
 * Extract JSON from various markdown formats
 * Tries multiple patterns and falls back intelligently
 */
export function extractJSON(content: string): string {
  // Remove any leading/trailing whitespace
  content = content.trim();
  
  // PREPROCESSING: Unescape common escape sequences if the content looks like it has escaped characters
  // This handles cases where LLM returns `\n{\n  "key": "value"\n}` instead of actual newlines
  if (content.includes('\\n') || content.includes('\\t') || content.includes('\\"')) {
    // Check if this looks like a JSON string that was escaped
    // (starts with \n or \t, or has many \n sequences)
    const escapedSequences = (content.match(/\\n|\\t|\\"/g) || []).length;
    if (escapedSequences > 2) {
      // Likely an escaped JSON string - unescape it
      content = content
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
    }
  }
  
  content = content.trim(); // Trim again after unescaping
  
  // Try multiple markdown code block patterns
  const patterns = [
    /```json\s*\n([\s\S]*?)\n```/,           // ```json\n...\n```
    /```json\s+([\s\S]*?)```/,               // ```json ...```
    /```\s*\n([\s\S]*?)\n```/,               // ```\n...\n```
    /```\s+([\s\S]*?)```/,                   // ``` ...```
    /```json([\s\S]*?)```/,                  // ```json...``` (no space)
    /```([\s\S]*?)```/                       // ```...```
  ];
  
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  // If no code block found, try to find JSON object directly
  // Look for content between outermost { and }
  const jsonObjectMatch = content.match(/\{[\s\S]*\}/);
  if (jsonObjectMatch) {
    return jsonObjectMatch[0];
  }
  
  // If all else fails, return trimmed content
  return content;
}

/**
 * Extract code from markdown code blocks
 * Handles any language tag or no tag at all
 */
export function extractCode(content: string, expectedLanguage?: string): string {
  // Remove any leading/trailing whitespace
  content = content.trim();
  
  // Try to extract from markdown code blocks
  const patterns = [
    // With specific language tag
    new RegExp(`\`\`\`${expectedLanguage || '\\w+'}\s*\\n([\\s\\S]*?)\\n\`\`\``, 'i'),
    // With any language tag
    /```\w+\s*\n([\s\S]*?)\n```/,
    // No language tag
    /```\s*\n([\s\S]*?)\n```/,
    // Minimal (with or without spaces)
    /```([\s\S]*?)```/
  ];
  
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  // If no code block found, check if content looks like it's already code
  // (no markdown formatting, starts with typical code patterns)
  const looksLikeCode = 
    content.includes('function') ||
    content.includes('class') ||
    content.includes('const') ||
    content.includes('let') ||
    content.includes('var') ||
    content.includes('import') ||
    content.includes('export') ||
    content.includes('def ') ||
    content.includes('async ') ||
    /^[\s\w\(\)\{\}=>;:]+/.test(content);
  
  if (looksLikeCode) {
    return content;
  }
  
  // Last resort: return content as-is
  return content;
}

/**
 * Check if content contains markdown code blocks
 */
export function hasMarkdownCodeBlock(content: string): boolean {
  return /```[\s\S]*?```/.test(content);
}

/**
 * Remove all markdown formatting and return plain text
 */
export function stripMarkdown(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    .replace(/`[^`]+`/g, '')         // Remove inline code
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
    .replace(/\*([^*]+)\*/g, '$1')   // Remove italic
    .replace(/^#+\s+/gm, '')         // Remove headers
    .replace(/^\s*[-*+]\s+/gm, '')   // Remove list markers
    .trim();
}


