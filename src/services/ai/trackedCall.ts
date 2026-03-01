import { callFunction, type CallFunctionOptions } from './router';
import { useCostTrackingStore } from '@/stores/costTrackingStore';
import { AI_PROVIDERS } from '@/stores/aiModels';
import type { AIFunctionConfig, AIProviderId } from '@/types/settings';
import type { AIMessage, AIResponse } from './types';
import { toast } from 'sonner';

/**
 * Wrapper around callFunction that automatically records cost/usage data.
 */
export async function trackedCallFunction(
  functionConfig: AIFunctionConfig,
  apiKeys: Record<AIProviderId, string>,
  messages: AIMessage[],
  options?: CallFunctionOptions,
  functionType?: string
): Promise<AIResponse> {
  const providerId = options?.overrideProvider ?? functionConfig.provider;
  const modelId = options?.overrideModel ?? functionConfig.model;
  const providerName = AI_PROVIDERS[providerId]?.name ?? providerId;

  toast.info(`${functionConfig.name}：${providerName} / ${modelId}`, { duration: 3000 });

  const response = await callFunction(functionConfig, apiKeys, messages, options);

  // Calculate cost
  const providerModels = AI_PROVIDERS[providerId];
  const modelInfo = providerModels?.models.find((m) => m.id === modelId);
  const inputPrice = modelInfo?.inputPrice ?? 2.5;
  const outputPrice = modelInfo?.outputPrice ?? 10;
  const cost =
    (response.usage.prompt_tokens * inputPrice +
      response.usage.completion_tokens * outputPrice) /
    1_000_000;

  useCostTrackingStore.getState().addEntry({
    provider: providerId,
    model: modelId,
    functionType: functionType ?? functionConfig.id,
    inputTokens: response.usage.prompt_tokens,
    outputTokens: response.usage.completion_tokens,
    cost,
  });

  return response;
}
