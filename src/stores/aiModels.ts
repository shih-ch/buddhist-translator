import type { AIProviderId } from '@/types/settings'
import type { AIModel } from '@/types/chat'

export const AI_PROVIDERS: Record<AIProviderId, { name: string; models: AIModel[] }> = {
  openai: {
    name: 'OpenAI',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', inputPrice: 2.5, outputPrice: 10 },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', inputPrice: 0.15, outputPrice: 0.6 },
    ],
  },
  anthropic: {
    name: 'Anthropic',
    models: [
      { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet', inputPrice: 3, outputPrice: 15 },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku', inputPrice: 0.8, outputPrice: 4 },
    ],
  },
  google: {
    name: 'Google Gemini',
    models: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', inputPrice: 0.1, outputPrice: 0.4 },
      { id: 'gemini-2.0-pro', name: 'Gemini 2.0 Pro', inputPrice: 1.25, outputPrice: 10 },
    ],
  },
  perplexity: {
    name: 'Perplexity',
    models: [
      { id: 'sonar', name: 'Sonar', inputPrice: 1, outputPrice: 1 },
      { id: 'sonar-pro', name: 'Sonar Pro', inputPrice: 3, outputPrice: 15 },
    ],
  },
}
