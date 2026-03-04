import type { AIProviderId } from '../../types/settings';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  model: string;
  provider: AIProviderId;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface AIModel {
  id: string;
  name: string;
  provider: AIProviderId;
  inputPrice: number;    // USD per 1M tokens
  outputPrice: number;   // USD per 1M tokens
}

export interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onDone: (fullText: string, usage?: AIResponse['usage']) => void;
  onError: (error: Error) => void;
}

export interface AIProviderAdapter {
  id: AIProviderId;
  name: string;
  models: AIModel[];
  call(
    messages: AIMessage[],
    model: string,
    apiKey: string,
    stream?: StreamCallbacks,
    signal?: AbortSignal
  ): Promise<AIResponse>;
  testConnection(apiKey: string): Promise<boolean>;
}
