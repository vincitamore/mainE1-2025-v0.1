/**
 * LLM Provider abstraction layer
 * Allows CodeMind to work with multiple LLM providers
 */

export interface LLMConfig {
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  tokensUsed: number;
  finishReason: 'stop' | 'length' | 'error';
  model: string;
}

export interface LLMProvider {
  name: string;
  models: string[];
  
  /**
   * Generate a completion from the LLM
   */
  generate(
    messages: LLMMessage[],
    config: LLMConfig
  ): Promise<LLMResponse>;
  
  /**
   * Stream a completion from the LLM
   */
  stream(
    messages: LLMMessage[],
    config: LLMConfig
  ): AsyncIterable<string>;
  
  /**
   * Count tokens in text (rough estimate)
   */
  countTokens(text: string): number;
}


