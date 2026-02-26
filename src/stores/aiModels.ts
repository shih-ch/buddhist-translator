import type { AIProviderId } from '@/types/settings'
import type { AIModel } from '@/types/chat'

export const AI_PROVIDERS: Record<AIProviderId, { name: string; models: AIModel[] }> = {
  openai: {
    name: 'OpenAI',
    models: [
      { id: 'gpt-5.2', name: 'GPT-5.2', inputPrice: 1.75, outputPrice: 14 },
      { id: 'gpt-5.1', name: 'GPT-5.1', inputPrice: 1.25, outputPrice: 10 },
      { id: 'gpt-5', name: 'GPT-5', inputPrice: 1.25, outputPrice: 10 },
      { id: 'o3', name: 'o3', inputPrice: 2, outputPrice: 8 },
      { id: 'o4-mini', name: 'o4-mini', inputPrice: 1.1, outputPrice: 4.4 },
      { id: 'gpt-4.1', name: 'GPT-4.1', inputPrice: 2, outputPrice: 8 },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', inputPrice: 0.4, outputPrice: 1.6 },
      { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', inputPrice: 0.1, outputPrice: 0.4 },
      { id: 'gpt-4o', name: 'GPT-4o', inputPrice: 2.5, outputPrice: 10 },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', inputPrice: 0.15, outputPrice: 0.6 },
      { id: 'o3-mini', name: 'o3-mini', inputPrice: 1.1, outputPrice: 4.4 },
    ],
  },
  anthropic: {
    name: 'Anthropic',
    models: [
      { id: 'claude-opus-4-6-20260320', name: 'Claude Opus 4.6', inputPrice: 5, outputPrice: 25 },
      { id: 'claude-sonnet-4-6-20260320', name: 'Claude Sonnet 4.6', inputPrice: 3, outputPrice: 15 },
      { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', inputPrice: 3, outputPrice: 15 },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', inputPrice: 1, outputPrice: 5 },
    ],
  },
  google: {
    name: 'Google Gemini',
    models: [
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', inputPrice: 1.25, outputPrice: 10 },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', inputPrice: 0.15, outputPrice: 0.6 },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', inputPrice: 0.1, outputPrice: 0.4 },
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
