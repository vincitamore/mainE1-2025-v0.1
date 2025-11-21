/**
 * JSON repair utilities for handling malformed LLM responses
 * Common issues: unescaped quotes, unescaped newlines, trailing commas
 */

/**
 * Attempt to repair common JSON syntax errors
 */
export function repairJSON(jsonStr: string): string {
  let repaired = jsonStr.trim();
  
  // Remove any leading/trailing markdown
  repaired = repaired.replace(/^```(?:json)?\s*\n?/, '');
  repaired = repaired.replace(/\n?```\s*$/, '');
  
  // Fix common issues:
  
  // 1. Remove trailing commas before } or ]
  repaired = repaired.replace(/,(\s*[}\]])/g, '$1');
  
  // 2. Fix unescaped newlines in strings (this is tricky)
  // We'll try to detect strings that span multiple lines and escape the newlines
  repaired = repaired.replace(/"([^"]*?)(\r?\n)([^"]*?)"/g, (match, before, newline, after) => {
    // Only fix if it looks like an unintended line break
    if (!before.endsWith('\\')) {
      return `"${before}\\n${after}"`;
    }
    return match;
  });
  
  // 3. Remove comments (JSON doesn't support them, but LLMs sometimes add them)
  repaired = repaired.replace(/\/\/.*$/gm, '');
  repaired = repaired.replace(/\/\*[\s\S]*?\*\//g, '');
  
  // 4. Fix single quotes (JSON requires double quotes)
  // This is dangerous, so we only do it in obvious cases
  repaired = repaired.replace(/:\s*'([^']*)'/g, ': "$1"');
  
  return repaired.trim();
}

/**
 * Try multiple strategies to parse JSON
 */
export function safeJSONParse<T>(content: string, fallback: T, debugLabel?: string): T {
  const label = debugLabel ? `[${debugLabel}]` : '[JSON Parse]';
  
  // Log the raw content for debugging
  console.log(`${label} ===== RAW LLM RESPONSE (${content.length} chars) =====`);
  console.log(content);
  console.log(`${label} ===== END RAW RESPONSE =====\n`);
  
  const attempts = [
    { name: 'Direct parse', fn: () => JSON.parse(content) },
    { name: 'Trim and parse', fn: () => JSON.parse(content.trim()) },
    { name: 'Repair and parse', fn: () => JSON.parse(repairJSON(content)) },
    { 
      name: 'Extract JSON object and parse',
      fn: () => {
        const match = content.match(/\{[\s\S]*\}/);
        if (match) {
          return JSON.parse(match[0]);
        }
        throw new Error('No JSON object found');
      }
    },
    { 
      name: 'Repair extracted JSON',
      fn: () => {
        const match = content.match(/\{[\s\S]*\}/);
        if (match) {
          const extracted = match[0];
          const repaired = repairJSON(extracted);
          console.log(`${label} Extracted and repaired JSON (${repaired.length} chars)`);
          return JSON.parse(repaired);
        }
        throw new Error('No JSON object found');
      }
    },
    { 
      name: 'Lenient parse',
      fn: () => parseLenientJSON(content)
    }
  ];
  
  for (let i = 0; i < attempts.length; i++) {
    try {
      console.log(`${label} Attempt ${i + 1}/${attempts.length}: ${attempts[i].name}...`);
      const result = attempts[i].fn();
      if (i > 0) {
        console.log(`${label} ✓ SUCCESS on attempt ${i + 1} (${attempts[i].name})`);
      }
      return result as T;
    } catch (error: any) {
      const errorMsg = error.message || String(error);
      console.warn(`${label} ✗ Attempt ${i + 1} failed: ${errorMsg}`);
      
      // On last attempt, show detailed error
      if (i === attempts.length - 1) {
        console.error(`${label} ===== ALL PARSING ATTEMPTS FAILED =====`);
        console.error(getJSONError(content));
        console.error(`${label} =========================================\n`);
      }
    }
  }
  
  return fallback;
}

/**
 * Lenient JSON parser that handles common mistakes
 * NOT a full JSON5 parser, just handles common LLM mistakes
 */
function parseLenientJSON(str: string): any {
  let cleaned = str.trim();
  
  // Remove trailing commas more aggressively
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
  
  // Remove comments
  cleaned = cleaned.replace(/\/\/.*$/gm, '');
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
  
  // Try to fix unescaped quotes in strings by escaping them
  // This is a heuristic and might not work in all cases
  cleaned = cleaned.replace(/"([^"\\]*)\\?"([^"\\]*?)"/g, (match) => {
    // If we find \" inside a string, make sure it's escaped
    return match;
  });
  
  return JSON.parse(cleaned);
}

/**
 * Validate that a string is valid JSON
 */
export function isValidJSON(str: string): boolean {
  try {
    JSON.parse(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get a helpful error message about why JSON parsing failed
 */
export function getJSONError(str: string): string {
  try {
    JSON.parse(str);
    return 'Valid JSON';
  } catch (error: any) {
    const message = error.message || 'Unknown error';
    
    // Extract position if available
    const posMatch = message.match(/position (\d+)/);
    if (posMatch) {
      const pos = parseInt(posMatch[1]);
      const contextSize = 200; // Show more context
      const start = Math.max(0, pos - contextSize);
      const end = Math.min(str.length, pos + contextSize);
      const context = str.substring(start, end);
      
      // Find the specific line and character
      const lineMatch = message.match(/line (\d+) column (\d+)/);
      let lineInfo = '';
      if (lineMatch) {
        const lineNum = parseInt(lineMatch[1]);
        const colNum = parseInt(lineMatch[2]);
        const lines = str.split('\n');
        if (lineNum > 0 && lineNum <= lines.length) {
          const problemLine = lines[lineNum - 1];
          const pointer = ' '.repeat(colNum - 1) + '^';
          lineInfo = `\nLine ${lineNum}:\n${problemLine}\n${pointer}`;
        }
      }
      
      // Highlight the error position with markers
      const before = context.substring(0, Math.min(contextSize, pos - start));
      const after = context.substring(Math.min(contextSize, pos - start));
      const markedContext = before + ' <<ERROR_HERE>> ' + after;
      
      return `JSON Error: ${message}\nContext: ...${markedContext}...${lineInfo}`;
    }
    
    return `JSON Error: ${message}`;
  }
}

