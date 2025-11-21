/**
 * OpenRouter Provider for CodeMind
 * Uses OpenRouter API to access multiple models including Grok 4.1 Fast
 * 
 * API Reference: https://openrouter.ai/docs
 */

import { LLMProvider, LLMConfig, LLMMessage, LLMResponse } from './provider';

export class OpenRouterProvider implements LLMProvider {
  name = 'openrouter';
  models = [
    'x-ai/grok-4.1-fast',              // xAI Grok 4.1 Fast - Free for 2 weeks, 2M context
    'anthropic/claude-3.5-sonnet',      // Anthropic Claude 3.5 Sonnet
    'meta-llama/llama-3.1-405b-instruct', // Meta Llama 3.1 405B
    'google/gemini-2.0-flash-exp:free'  // Google Gemini 2.0 Flash (free)
  ];
  
  private apiKey: string;
  private baseURL = 'https://openrouter.ai/api/v1';
  private maxRetries = 3;
  private retryDelay = 2000; // Start with 2 seconds
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  async generate(
    messages: LLMMessage[],
    config: LLMConfig
  ): Promise<LLMResponse> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`[OpenRouter] Attempt ${attempt}/${this.maxRetries} for model ${config.model}`);
        
        // Create abort controller for timeout (5 minutes max)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout
        
        const response = await fetch(`${this.baseURL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/yourusername/codemind',
            'X-Title': 'CodeMind'
          },
          body: JSON.stringify({
            model: config.model || 'x-ai/grok-4.1-fast',
            messages: messages,
            temperature: config.temperature,
            max_tokens: config.maxTokens,
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({})) as any;
          const errorMessage = errorData.error?.message || response.statusText;
          
          // Check for specific error types
          if (response.status === 429) {
            console.log(`[OpenRouter] Rate limit hit (attempt ${attempt}), waiting ${this.retryDelay * attempt}ms...`);
            lastError = new Error(`Rate limit exceeded. ${errorMessage}`);
            
            // Don't retry if we're out of attempts
            if (attempt < this.maxRetries) {
              await this.sleep(this.retryDelay * attempt); // Exponential backoff
              continue;
            }
          } else if (response.status === 503 || response.status === 502) {
            console.log(`[OpenRouter] Service unavailable (attempt ${attempt}), waiting ${this.retryDelay * attempt}ms...`);
            lastError = new Error(`OpenRouter service temporarily unavailable. ${errorMessage}`);
            
            if (attempt < this.maxRetries) {
              await this.sleep(this.retryDelay * attempt);
              continue;
            }
          } else {
            throw new Error(`OpenRouter API error (${response.status}): ${errorMessage}`);
          }
        }
        
        const data = await response.json() as any;
        
        if (!data.choices || !data.choices[0]) {
          throw new Error('Invalid response from OpenRouter: missing choices');
        }
        
        console.log(`[OpenRouter] Success on attempt ${attempt}, tokens: ${data.usage?.total_tokens || 0}`);
        
        return {
          content: data.choices[0].message.content || '',
          tokensUsed: data.usage?.total_tokens || 0,
          finishReason: data.choices[0].finish_reason || 'stop',
          model: data.model
        };
        
      } catch (error: any) {
        lastError = error;
        
        // Check for specific error types
        if (error.name === 'AbortError') {
          console.error(`[OpenRouter] Request timeout (attempt ${attempt})`);
          lastError = new Error('Request timed out after 5 minutes. Try a shorter code selection or simpler request.');
          // Don't retry on timeout
          break;
        } else if (error.message.includes('terminated') || error.message.includes('network')) {
          console.log(`[OpenRouter] Network error (attempt ${attempt}): ${error.message}`);
          lastError = new Error(`Network connection interrupted: ${error.message}`);
          
          if (attempt < this.maxRetries) {
            console.log(`[OpenRouter] Retrying in ${this.retryDelay * attempt}ms...`);
            await this.sleep(this.retryDelay * attempt);
            continue;
          }
        } else {
          // Unknown error, don't retry
          console.error(`[OpenRouter] Error (attempt ${attempt}):`, error);
          throw new Error(`OpenRouter API error: ${error.message}`);
        }
      }
    }
    
    // If we got here, all retries failed
    throw new Error(
      `OpenRouter request failed after ${this.maxRetries} attempts. Last error: ${lastError?.message || 'Unknown error'}\n\n` +
      `Possible causes:\n` +
      `- Rate limit exceeded (free tier limits)\n` +
      `- Network connection interrupted\n` +
      `- OpenRouter service temporarily unavailable\n\n` +
      `Try again in a few minutes, or switch to a different model in settings.`
    );
  }
  
  async *stream(
    messages: LLMMessage[],
    config: LLMConfig
  ): AsyncIterable<string> {
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/yourusername/codemind',
        'X-Title': 'CodeMind'
      },
      body: JSON.stringify({
        model: config.model || 'x-ai/grok-4.1-fast',
        messages: messages,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        stream: true
      })
    });
    
    if (!response.ok || !response.body) {
      throw new Error(`OpenRouter stream error: ${response.statusText}`);
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim().startsWith('data:'));
      
      for (const line of lines) {
        const data = line.replace('data: ', '').trim();
        if (data === '[DONE]') continue;
        
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices[0]?.delta?.content;
          if (content) {
            yield content;
          }
        } catch (e) {
          // Skip invalid JSON chunks
        }
      }
    }
  }
  
  countTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 characters for English text
    // This is a conservative estimate that works across most models
    return Math.ceil(text.length / 4);
  }
}

