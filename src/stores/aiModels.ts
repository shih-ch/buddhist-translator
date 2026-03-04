import type { AIProviderId } from '@/types/settings'
import type { AIModel } from '@/types/chat'

export const DEFAULT_TRANSLATION_MODEL = { provider: 'openai' as AIProviderId, model: 'gpt-5.1' }

export const AI_PROVIDERS: Record<AIProviderId, { name: string; models: AIModel[] }> = {
  openai: {
    name: 'OpenAI',
    models: [
      // Flagship
      { id: 'gpt-5.2', name: 'GPT-5.2', inputPrice: 1.75, outputPrice: 14 },
      { id: 'gpt-5.2-pro', name: 'GPT-5.2 Pro', inputPrice: 21, outputPrice: 168 },
      { id: 'gpt-5.1', name: 'GPT-5.1', inputPrice: 1.25, outputPrice: 10 },
      { id: 'gpt-5', name: 'GPT-5', inputPrice: 1.25, outputPrice: 10 },
      { id: 'gpt-4.1', name: 'GPT-4.1', inputPrice: 2, outputPrice: 8 },
      { id: 'gpt-4o', name: 'GPT-4o', inputPrice: 2.5, outputPrice: 10 },
      // Reasoning
      { id: 'o3', name: 'o3', inputPrice: 2, outputPrice: 8 },
      { id: 'o4-mini', name: 'o4-mini', inputPrice: 1.1, outputPrice: 4.4 },
      { id: 'o3-mini', name: 'o3-mini', inputPrice: 1.1, outputPrice: 4.4 },
      // Mini
      { id: 'gpt-5-mini', name: 'GPT-5 Mini', inputPrice: 0.25, outputPrice: 2 },
      { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', inputPrice: 0.4, outputPrice: 1.6 },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', inputPrice: 0.15, outputPrice: 0.6 },
      // Nano
      { id: 'gpt-5-nano', name: 'GPT-5 Nano', inputPrice: 0.05, outputPrice: 0.4 },
      { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', inputPrice: 0.1, outputPrice: 0.4 },
    ],
  },
  anthropic: {
    name: 'Anthropic',
    models: [
      { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', inputPrice: 5, outputPrice: 25 },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', inputPrice: 3, outputPrice: 15 },
      { id: 'claude-opus-4-5', name: 'Claude Opus 4.5', inputPrice: 5, outputPrice: 25 },
      { id: 'claude-sonnet-4-5', name: 'Claude Sonnet 4.5', inputPrice: 3, outputPrice: 15 },
      { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', inputPrice: 1, outputPrice: 5 },
    ],
  },
  google: {
    name: 'Google Gemini',
    models: [
      { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro (Preview)', inputPrice: 2, outputPrice: 12 },
      { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro (Preview)', inputPrice: 2, outputPrice: 12 },
      { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash (Preview)', inputPrice: 0.5, outputPrice: 3 },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', inputPrice: 1.25, outputPrice: 10 },
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', inputPrice: 0.3, outputPrice: 2.5 },
      { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite', inputPrice: 0.1, outputPrice: 0.4 },
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', inputPrice: 0.1, outputPrice: 0.4 },
    ],
  },
  perplexity: {
    name: 'Perplexity',
    models: [
      { id: 'sonar-deep-research', name: 'Sonar Deep Research', inputPrice: 2, outputPrice: 8 },
      { id: 'sonar-reasoning-pro', name: 'Sonar Reasoning Pro', inputPrice: 2, outputPrice: 8 },
      { id: 'sonar-pro', name: 'Sonar Pro', inputPrice: 3, outputPrice: 15 },
      { id: 'sonar', name: 'Sonar', inputPrice: 1, outputPrice: 1 },
    ],
  },
}
