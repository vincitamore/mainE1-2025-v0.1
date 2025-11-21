/**
 * Advanced JSON Repair System
 * 
 * Handles common LLM JSON mistakes:
 * - Unescaped newlines in strings
 * - Unescaped quotes
 * - Trailing commas
 * - Missing commas
 * - Control characters
 * - Mixed quotes
 */

/**
 * Preprocess JSON string to fix common issues before parsing
 */
export function preprocessJSON(jsonStr: string): string {
  let processed = jsonStr;

  // Step 1: Remove any markdown code fences
  processed = processed.replace(/```json\s*/g, '');
  processed = processed.replace(/```\s*$/g, '');
  
  // Step 2: Fix unescaped newlines within string values
  // This is the most common LLM mistake
  processed = fixUnescapedNewlines(processed);
  
  // Step 3: Fix unescaped tabs
  processed = processed.replace(/([^\\])\t/g, '$1\\t');
  
  // Step 4: Remove trailing commas before } or ]
  processed = processed.replace(/,(\s*[}\]])/g, '$1');
  
  // Step 5: Fix missing commas between object properties
  processed = fixMissingCommas(processed);
  
  return processed.trim();
}

/**
 * Fix unescaped newlines in JSON string values
 * This is tricky because we need to distinguish between:
 * - Newlines INSIDE string values (need escaping)
 * - Newlines OUTSIDE string values (structural, keep as-is)
 */
function fixUnescapedNewlines(jsonStr: string): string {
  let result = '';
  let inString = false;
  let stringChar: '"' | "'" | null = null;
  let i = 0;

  while (i < jsonStr.length) {
    const char = jsonStr[i];
    const prevChar = i > 0 ? jsonStr[i - 1] : '';
    const nextChar = i < jsonStr.length - 1 ? jsonStr[i + 1] : '';

    // Check if we're entering/exiting a string
    if ((char === '"' || char === "'") && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
        result += char;
      } else if (char === stringChar) {
        inString = false;
        stringChar = null;
        result += char;
      } else {
        // Different quote inside string, keep as-is
        result += char;
      }
      i++;
      continue;
    }

    // If we're in a string and hit a newline, escape it
    if (inString) {
      if (char === '\n') {
        result += '\\n';
        i++;
        continue;
      } else if (char === '\r') {
        // Handle \r\n
        if (nextChar === '\n') {
          result += '\\n';
          i += 2; // Skip both \r and \n
          continue;
        } else {
          result += '\\n';
          i++;
          continue;
        }
      } else if (char === '\t') {
        result += '\\t';
        i++;
        continue;
      }
      // Other control characters
      else if (char.charCodeAt(0) < 32 && char !== ' ') {
        // Skip other control characters
        i++;
        continue;
      }
    }

    result += char;
    i++;
  }

  return result;
}

/**
 * Fix missing commas between object properties or array elements
 */
function fixMissingCommas(jsonStr: string): string {
  let result = '';
  let inString = false;
  let stringChar: '"' | "'" | null = null;

  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];
    const prevChar = i > 0 ? jsonStr[i - 1] : '';
    const nextChar = i < jsonStr.length - 1 ? jsonStr[i + 1] : '';

    // Track string state
    if ((char === '"' || char === "'") && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
        stringChar = null;
      }
    }

    result += char;

    // If we're not in a string, check for missing commas
    if (!inString) {
      // Case 1: }\n{ or ]\n[ (missing comma between array/object elements)
      if ((char === '}' || char === ']') && i < jsonStr.length - 1) {
        let j = i + 1;
        // Skip whitespace
        while (j < jsonStr.length && /\s/.test(jsonStr[j])) {
          j++;
        }
        if (j < jsonStr.length && (jsonStr[j] === '{' || jsonStr[j] === '[' || jsonStr[j] === '"')) {
          // Add comma before the whitespace
          result = result.slice(0, -1) + char + ',';
        }
      }
      // Case 2: "\n" (missing comma between object properties)
      else if (char === '"' && i < jsonStr.length - 1) {
        let j = i + 1;
        // Skip whitespace
        while (j < jsonStr.length && /\s/.test(jsonStr[j])) {
          j++;
        }
        if (j < jsonStr.length && jsonStr[j] === '"') {
          // Check if we're after a value (not a key)
          // Look back to see if this was a value, not a key
          let k = i - 1;
          while (k >= 0 && /\s/.test(jsonStr[k])) {
            k--;
          }
          // If we don't see a colon before this quote, it's likely a missing comma
          let foundColon = false;
          let bracketDepth = 0;
          for (let m = k; m >= Math.max(0, k - 50); m--) {
            if (jsonStr[m] === '}' || jsonStr[m] === ']') bracketDepth++;
            if (jsonStr[m] === '{' || jsonStr[m] === '[') bracketDepth--;
            if (jsonStr[m] === ':' && bracketDepth === 0) {
              foundColon = true;
              break;
            }
            if (jsonStr[m] === ',' && bracketDepth === 0) break;
          }
          // If we found a colon recently, this quote is ending a value, need comma
          if (foundColon) {
            result += ',';
          }
        }
      }
    }
  }

  return result;
}

/**
 * Attempt to parse JSON with multiple repair strategies
 */
export function parseJSONWithRepair<T = any>(jsonStr: string, context?: string): T | null {
  const attempts: Array<{ name: string; fn: () => T }> = [];

  // Attempt 1: Direct parse (maybe it's already valid)
  attempts.push({
    name: 'Direct parse',
    fn: () => JSON.parse(jsonStr)
  });

  // Attempt 2: Preprocess and parse
  attempts.push({
    name: 'Preprocessed parse',
    fn: () => {
      const preprocessed = preprocessJSON(jsonStr);
      return JSON.parse(preprocessed);
    }
  });

  // Attempt 3: Extract JSON structure and parse
  attempts.push({
    name: 'Extract JSON structure',
    fn: () => {
      const match = jsonStr.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (!match) throw new Error('No JSON structure found');
      const preprocessed = preprocessJSON(match[0]);
      return JSON.parse(preprocessed);
    }
  });

  // Attempt 4: Aggressive newline fixing
  attempts.push({
    name: 'Aggressive newline repair',
    fn: () => {
      let fixed = jsonStr;
      // Find all occurrences of unescaped newlines in strings
      fixed = fixed.replace(/"([^"]*?)"/gs, (match, content) => {
        // Escape newlines, tabs, and control chars in the content
        const escaped = content
          .replace(/\\/g, '\\\\')  // Escape backslashes first
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '')
          .replace(/\t/g, '\\t')
          .replace(/[\x00-\x1F]/g, ''); // Remove other control chars
        return `"${escaped}"`;
      });
      return JSON.parse(fixed);
    }
  });

  // Attempt 5: Use JSON5 (more lenient parser) if available
  attempts.push({
    name: 'Lenient parse with manual fixes',
    fn: () => {
      let fixed = jsonStr;
      // Remove comments
      fixed = fixed.replace(/\/\/.*$/gm, '');
      fixed = fixed.replace(/\/\*[\s\S]*?\*\//g, '');
      // Fix trailing commas
      fixed = fixed.replace(/,(\s*[}\]])/g, '$1');
      // Fix unquoted keys (basic attempt)
      fixed = fixed.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
      const preprocessed = preprocessJSON(fixed);
      return JSON.parse(preprocessed);
    }
  });

  // Try each attempt
  for (let i = 0; i < attempts.length; i++) {
    const attempt = attempts[i];
    try {
      console.log(`[JSON Repair${context ? `-${context}` : ''}] Attempt ${i + 1}/${attempts.length}: ${attempt.name}...`);
      const result = attempt.fn();
      console.log(`[JSON Repair${context ? `-${context}` : ''}] ✓ ${attempt.name} succeeded`);
      return result;
    } catch (error: any) {
      console.log(`[JSON Repair${context ? `-${context}` : ''}] ✗ ${attempt.name} failed:`, error.message);
      if (i === attempts.length - 1) {
        // Last attempt failed, log details
        console.error(`[JSON Repair${context ? `-${context}` : ''}] ===== ALL PARSING ATTEMPTS FAILED =====`);
        console.error(`[JSON Repair${context ? `-${context}` : ''}] JSON Error:`, error.message);
        
        // Show context around error if available
        if (error.message.includes('position')) {
          const match = error.message.match(/position (\d+)/);
          if (match) {
            const pos = parseInt(match[1]);
            const start = Math.max(0, pos - 100);
            const end = Math.min(jsonStr.length, pos + 100);
            const context = jsonStr.substring(start, end);
            const errorPos = pos - start;
            console.error('[JSON Repair] Context:', context);
            console.error('[JSON Repair] Position:', ' '.repeat(errorPos) + '^');
          }
        }
        
        console.error(`[JSON Repair${context ? `-${context}` : ''}] =========================================`);
      }
    }
  }

  return null;
}

/**
 * Safe JSON parse with automatic repair
 * This is a drop-in replacement for safeJSONParse
 */
export function safeJSONParseWithRepair<T = any>(jsonStr: string, defaultValue: T | null = null, context?: string): T | null {
  const result = parseJSONWithRepair<T>(jsonStr, context);
  return result !== null ? result : defaultValue;
}

