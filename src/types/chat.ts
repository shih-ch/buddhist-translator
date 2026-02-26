export interface ChatMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
  model?: string;
  provider?: string;
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  model: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface AIModel {
  id: string;
  name: string;
  inputPrice: number;
  outputPrice: number;
}

export interface AIProvider {
  id: string;
  name: string;
  models: AIModel[];
}
