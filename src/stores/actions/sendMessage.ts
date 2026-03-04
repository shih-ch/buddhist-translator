import type { TranslatorStoreGet, TranslatorStoreSet } from '../translatorStore';
import type { AIMessage } from '@/services/ai/types';
import { callFunction } from '@/services/ai/router';
import { buildTranslationMessages, buildRetranslationMessages } from '@/services/ai/promptBuilder';
import { useAIFunctionsStore } from '@/stores/aiFunctionsStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useGlossaryStore } from '@/stores/glossaryStore';
import { AI_PROVIDERS } from '@/stores/aiModels';
import { useCostTrackingStore } from '@/stores/costTrackingStore';

let messageCounter = 0;
export function genId() {
  return `msg-${++messageCounter}-${Date.now()}`;
}

export async function performSendMessage(content: string, get: TranslatorStoreGet, set: TranslatorStoreSet): Promise<void> {
  const state = get();
  if (state.isLoading) return;

  // Check API key before proceeding
  const apiKeys = useSettingsStore.getState().apiKeys;
  const provider = state.currentModel.provider;
  if (!apiKeys[provider]) {
    const providerNames: Record<string, string> = {
      openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google', perplexity: 'Perplexity',
    };
    throw new Error(`請先在設定中填入 ${providerNames[provider] ?? provider} API Key`);
  }

  const abortController = new AbortController();

  // Add user message
  const userMsg = {
    id: genId(),
    role: 'user' as const,
    content,
    timestamp: Date.now(),
  };

  // Create placeholder assistant message for streaming
  const assistantMsg = {
    id: genId(),
    role: 'assistant' as const,
    content: '',
    timestamp: Date.now(),
    model: state.currentModel.model,
    provider: state.currentModel.provider,
  };

  set((s) => ({
    messages: [...s.messages, userMsg, assistantMsg],
    isLoading: true,
    abortController,
  }));

  try {
    // Build messages using promptBuilder
    const fnConfig = useAIFunctionsStore.getState().getFunctionConfig('translation');
    const glossaryTerms = useGlossaryStore.getState().glossary?.terms ?? [];

    // ── Relay translation: first translate to intermediate language ──
    const relay = state.translationParams.relayLanguage;
    let textForTranslation = content;
    if (relay && relay !== 'none' && state.messages.length === 0) {
      const relayLangName = relay === 'en' ? 'English' : 'Russian';
      const relayMessages: AIMessage[] = [
        {
          role: 'system',
          content: `You are a professional translator. Translate the following text into ${relayLangName}. Preserve all formatting, paragraph breaks, and structure. Output only the translation.`,
        },
        { role: 'user', content },
      ];

      // Update UI to show relay progress
      set((s) => {
        const msgs = [...s.messages];
        const last = msgs[msgs.length - 1];
        if (last.id === assistantMsg.id) {
          msgs[msgs.length - 1] = { ...last, content: `⏳ 中轉翻譯中（→ ${relayLangName}）...\n\n` };
        }
        return { messages: msgs };
      });

      const relayResponse = await callFunction(
        fnConfig,
        apiKeys,
        relayMessages,
        {
          overrideProvider: state.currentModel.provider,
          overrideModel: state.currentModel.model,
        }
      );
      textForTranslation = relayResponse.content;

      // Clear the progress message for the real translation
      set((s) => {
        const msgs = [...s.messages];
        const last = msgs[msgs.length - 1];
        if (last.id === assistantMsg.id) {
          msgs[msgs.length - 1] = { ...last, content: '' };
        }
        return { messages: msgs };
      });
    }

    // For the first message, use the full translation prompt builder
    // For follow-up messages, pass the conversation history
    let messages: AIMessage[];
    if (state.messages.length === 0) {
      if (state.replacementRange) {
        // Retranslation mode without prior messages: include full original as context
        messages = buildRetranslationMessages(
          fnConfig.prompt,
          state.originalText,
          textForTranslation,
          state.translationParams,
          glossaryTerms,
        );
      } else {
        messages = buildTranslationMessages(
          fnConfig.prompt,
          textForTranslation,
          state.translationParams,
          glossaryTerms,
          []
        );
      }
    } else {
      // Follow-up: build chat history for translation context
      const chatHistory: AIMessage[] = state.messages.map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      }));
      chatHistory.push({ role: 'user', content });
      messages = buildTranslationMessages(
        fnConfig.prompt,
        state.originalText,
        state.translationParams,
        glossaryTerms,
        chatHistory
      );
    }

    // Calculate cost using actual model prices
    const providerModels = AI_PROVIDERS[state.currentModel.provider];
    const modelInfo = providerModels?.models.find((m) => m.id === state.currentModel.model);
    const inputPrice = modelInfo?.inputPrice ?? 2.5;
    const outputPrice = modelInfo?.outputPrice ?? 10;

    const response = await callFunction(
      fnConfig,
      apiKeys,
      messages,
      {
        overrideProvider: state.currentModel.provider,
        overrideModel: state.currentModel.model,
        signal: abortController.signal,
        stream: {
          onChunk: (chunk) => {
            set((s) => {
              const msgs = [...s.messages];
              const last = msgs[msgs.length - 1];
              if (last.id === assistantMsg.id) {
                msgs[msgs.length - 1] = { ...last, content: last.content + chunk };
              }
              return { messages: msgs };
            });
          },
          onDone: () => {},
          onError: () => {},
        },
      }
    );

    // Update final message with usage info
    const callCost = (response.usage.prompt_tokens * inputPrice +
      response.usage.completion_tokens * outputPrice) / 1_000_000;

    // Record in persistent cost tracking
    useCostTrackingStore.getState().addEntry({
      provider: state.currentModel.provider,
      model: state.currentModel.model,
      functionType: 'translation',
      inputTokens: response.usage.prompt_tokens,
      outputTokens: response.usage.completion_tokens,
      cost: callCost,
    });

    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last.id === assistantMsg.id) {
        msgs[msgs.length - 1] = { ...last, content: response.content };
      }
      return {
        messages: msgs,
        isLoading: false,
        abortController: null,
        totalTokens: s.totalTokens + response.usage.total_tokens,
        totalCost: s.totalCost + callCost,
      };
    });
  } catch (err) {
    console.error('[sendMessage] API call error:', err);
    // Add error message to chat
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last.id === assistantMsg.id) {
        const errorText = err instanceof Error ? err.message : 'Unknown error';
        msgs[msgs.length - 1] = { ...last, content: `**Error:** ${errorText}` };
      }
      return { messages: msgs, isLoading: false, abortController: null };
    });
  }
}
