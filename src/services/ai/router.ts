import type { AIProviderId, AIFunctionConfig } from '../../types/settings';
import type { AIMessage, AIResponse, StreamCallbacks, AIModel, AIProviderAdapter } from './types';
import { openaiAdapter } from './openai';
import { anthropicAdapter } from './anthropic';
import { geminiAdapter } from './gemini';
import { perplexityAdapter } from './perplexity';

const providers = new Map<AIProviderId, AIProviderAdapter>([
  ['openai', openaiAdapter],
  ['anthropic', anthropicAdapter],
  ['google', geminiAdapter],
  ['perplexity', perplexityAdapter],
]);

/**
 * Resolve provider and model for a given AI function call.
 * Accepts explicit config + apiKeys so it doesn't depend on store imports.
 * The calling code (components / stores) is responsible for reading from stores.
 */
export interface CallFunctionOptions {
  stream?: StreamCallbacks;
  overrideProvider?: AIProviderId;
  overrideModel?: string;
}

export async function callFunction(
  functionConfig: AIFunctionConfig,
  apiKeys: Record<AIProviderId, string>,
  messages: AIMessage[],
  options?: CallFunctionOptions
): Promise<AIResponse> {
  const providerId = options?.overrideProvider ?? functionConfig.provider;
  const modelId = options?.overrideModel ?? functionConfig.model;

  const adapter = providers.get(providerId);
  if (!adapter) {
    throw new Error(`Unknown AI provider: ${providerId}`);
  }

  const apiKey = apiKeys[providerId];
  if (!apiKey) {
    throw new Error(`No API key configured for provider: ${adapter.name}`);
  }

  return adapter.call(messages, modelId, apiKey, options?.stream);
}

export function getModelsForProvider(providerId: AIProviderId): AIModel[] {
  return providers.get(providerId)?.models ?? [];
}

export function getAllModels(): AIModel[] {
  const all: AIModel[] = [];
  for (const adapter of providers.values()) {
    all.push(...adapter.models);
  }
  return all;
}

export async function testConnection(
  providerId: AIProviderId,
  apiKey: string
): Promise<boolean> {
  const adapter = providers.get(providerId);
  if (!adapter) return false;
  return adapter.testConnection(apiKey);
}

export function getProviderName(providerId: AIProviderId): string {
  return providers.get(providerId)?.name ?? providerId;
}

export function getAllProviders(): Array<{ id: AIProviderId; name: string }> {
  return Array.from(providers.entries()).map(([id, adapter]) => ({
    id,
    name: adapter.name,
  }));
}
