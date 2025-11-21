/**
 * YAML Parsing Utilities
 * 
 * Robust YAML parsing with extraction and validation.
 * YAML eliminates JSON escaping hell for complex, multiline content.
 */

import * as yaml from 'js-yaml';

/**
 * Extract YAML from markdown code blocks or raw text
 */
export function extractYAML(text: string): string {
  const trimmed = text.trim();
  
  // Try to extract from markdown code blocks first
  const yamlBlockMatch = trimmed.match(/```(?:yaml|yml)\s*\n([\s\S]*?)\n```/);
  if (yamlBlockMatch) {
    console.log('[YAML] Extracted from ```yaml code block');
    return yamlBlockMatch[1].trim();
  }
  
  // Try generic code block
  const codeBlockMatch = trimmed.match(/```\s*\n([\s\S]*?)\n```/);
  if (codeBlockMatch) {
    // Check if it looks like YAML (has keys with colons)
    const content = codeBlockMatch[1];
    if (content.includes(':') && !content.trim().startsWith('{')) {
      console.log('[YAML] Extracted from ``` code block (detected YAML structure)');
      return content.trim();
    }
  }
  
  // If no code blocks, return as-is (assume it's raw YAML)
  return trimmed;
}

/**
 * Parse YAML with robust error handling and auto-repair
 */
export function parseYAML<T = any>(text: string, attemptRepair: boolean = true): { success: true; data: T } | { success: false; error: string; text: string } {
  try {
    const extracted = extractYAML(text);
    const parsed = yaml.load(extracted, {
      // Strict mode for security
      schema: yaml.DEFAULT_SCHEMA,
      // Don't allow duplicate keys
      json: true
    });
    
    if (parsed === null || parsed === undefined) {
      return {
        success: false,
        error: 'YAML parsed to null/undefined',
        text: extracted
      };
    }
    
    return {
      success: true,
      data: parsed as T
    };
  } catch (error) {
    // If initial parse failed and we haven't tried repair yet, attempt repair
    if (attemptRepair) {
      console.log('[YAML] Initial parse failed, attempting intelligent repair...');
      const extracted = extractYAML(text);
      const repaired = repairYAML(extracted);
      
      // Try parsing the repaired version (without retry to avoid infinite loop)
      const retryResult = parseYAML<T>(repaired, false);
      if (retryResult.success) {
        console.log('[YAML] ✅ Repair successful!');
        return retryResult;
      } else {
        console.log('[YAML] ❌ Repair attempt failed:', retryResult.error);
      }
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown YAML parse error',
      text: text
    };
  }
}

/**
 * Validate YAML structure against expected shape
 */
export function validateYAMLStructure<T>(
  data: any,
  validator: (data: any) => data is T,
  errorMessage?: string
): { valid: true; data: T } | { valid: false; error: string } {
  if (validator(data)) {
    return { valid: true, data };
  }
  
  return {
    valid: false,
    error: errorMessage || 'YAML structure validation failed'
  };
}

/**
 * Common YAML validation helpers
 */
export const YAMLValidators = {
  /**
   * Check if value is a non-empty object
   */
  isObject: (value: any): value is Record<string, any> => {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  },
  
  /**
   * Check if value is an array
   */
  isArray: (value: any): value is any[] => {
    return Array.isArray(value);
  },
  
  /**
   * Check if value is a string
   */
  isString: (value: any): value is string => {
    return typeof value === 'string';
  },
  
  /**
   * Check if value is a number
   */
  isNumber: (value: any): value is number => {
    return typeof value === 'number' && !isNaN(value);
  },
  
  /**
   * Check if object has required fields
   */
  hasFields: (obj: any, fields: string[]): boolean => {
    if (!YAMLValidators.isObject(obj)) {
      return false;
    }
    return fields.every(field => field in obj);
  }
};

/**
 * Safe YAML parsing with detailed logging
 */
export async function parseYAMLSafe<T>(
  text: string,
  context: string = 'unknown',
  requiredFields?: string[]
): Promise<T> {
  console.log(`[YAML-Safe] Parsing YAML for context: ${context}`);
  console.log(`[YAML-Safe] Input length: ${text.length} chars`);
  console.log(`[YAML-Safe] First 200 chars:`, text.substring(0, 200));
  
  const result = parseYAML<T>(text);
  
  if (!result.success) {
    console.error(`[YAML-Safe] ❌ Parse failed:`, result.error);
    throw new Error(`YAML parsing failed for ${context}: ${result.error}`);
  }
  
  // Validate required fields if specified
  if (requiredFields && !YAMLValidators.hasFields(result.data, requiredFields)) {
    const missing = requiredFields.filter(f => !(f in (result.data as any)));
    console.error(`[YAML-Safe] ❌ Missing required fields:`, missing);
    throw new Error(`YAML missing required fields for ${context}: ${missing.join(', ')}`);
  }
  
  console.log(`[YAML-Safe] ✅ Parse successful for ${context}`);
  return result.data;
}

/**
 * Convert object to YAML string
 */
export function toYAML(obj: any, options?: yaml.DumpOptions): string {
  return yaml.dump(obj, {
    indent: 2,
    lineWidth: 120,
    noRefs: true, // Don't use references
    sortKeys: false, // Preserve key order
    ...options
  });
}

/**
 * Try to repair common YAML issues with intelligent preprocessing
 */
export function repairYAML(text: string): string {
  let repaired = text;
  
  // Remove any leading/trailing markdown artifacts
  repaired = repaired.replace(/^```(?:yaml|yml)?\s*\n/gm, '');
  repaired = repaired.replace(/\n```$/gm, '');
  
  // Ensure proper line endings
  repaired = repaired.replace(/\r\n/g, '\n');
  
  // Remove trailing whitespace from lines (can cause YAML issues)
  repaired = repaired.split('\n').map(line => line.trimEnd()).join('\n');
  
  // CRITICAL: Fix unquoted strings with colons and quotes
  // Pattern: "  key: value with "quotes" and: colons"
  // This is the #1 cause of YAML parse failures
  repaired = intelligentlyQuoteYAMLValues(repaired);
  
  return repaired.trim();
}

/**
 * Intelligently quote YAML values that contain special characters
 * This is the most important repair for LLM-generated YAML
 */
function intelligentlyQuoteYAMLValues(yaml: string): string {
  const lines = yaml.split('\n');
  const result: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Skip empty lines, comments, list items without values, and already-quoted values
    if (!line.trim() || line.trim().startsWith('#')) {
      result.push(line);
      continue;
    }
    
    // Check if this is a key-value line (has a colon not in quotes)
    const match = line.match(/^(\s*)([a-zA-Z_][\w-]*)\s*:\s*(.*)$/);
    if (!match) {
      result.push(line);
      continue;
    }
    
    const [, indent, key, value] = match;
    
    // Skip if value is empty, already quoted, or is just a list/object marker
    if (!value || 
        value.trim() === '' ||
        value.trim().startsWith('"') ||
        value.trim().startsWith("'") ||
        value.trim() === '[]' ||
        value.trim() === '{}' ||
        value.trim().startsWith('-') ||
        /^\d+(\.\d+)?$/.test(value.trim()) || // numbers
        /^(true|false|null)$/i.test(value.trim())) { // booleans/null
      result.push(line);
      continue;
    }
    
    // Check if value contains dangerous patterns:
    // 1. Contains both quotes and colons: 'Add "key": "value"'
    // 2. Contains unbalanced quotes
    // 3. Contains multiple colons (suggests JSON-like structure)
    const dangerous = (
      (value.includes('"') && value.includes(':')) ||
      (value.includes("'") && value.includes(':')) ||
      (value.match(/:/g) || []).length > 1 ||
      (value.match(/"/g) || []).length % 2 !== 0
    );
    
    if (dangerous) {
      // Escape any existing quotes and wrap in quotes
      const escaped = value
        .trim()
        .replace(/\\/g, '\\\\')  // Escape backslashes
        .replace(/"/g, '\\"');    // Escape quotes
      
      result.push(`${indent}${key}: "${escaped}"`);
      console.log(`[YAML-Repair] Quoted dangerous value: ${key}`);
    } else {
      result.push(line);
    }
  }
  
  return result.join('\n');
}

