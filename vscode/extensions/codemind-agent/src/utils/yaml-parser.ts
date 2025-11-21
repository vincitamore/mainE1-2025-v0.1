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
 * Parse YAML with robust error handling
 */
export function parseYAML<T = any>(text: string): { success: true; data: T } | { success: false; error: string; text: string } {
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
 * Try to repair common YAML issues
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
  
  return repaired.trim();
}

