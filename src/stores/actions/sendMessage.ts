import type { TranslatorStoreGet, TranslatorStoreSet } from '../translatorStore';
import type { AIMessage, AIResponse } from '@/services/ai/types';
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

const NETWORK_ERROR_RE = /network error|failed to fetch|load failed|networkerror/i;

/** User pressed stop / the request was aborted — not a real failure. */
function isAbortError(err: unknown): boolean {
  return err instanceof Error && (err.name === 'AbortError' || /abort/i.test(err.message));
}

/** Transient errors worth retrying: connection drops + rate-limit / 5xx. */
function isRetryableError(err: unknown): boolean {
  if (isAbortError(err)) return false;
  if (!(err instanceof Error)) return false;
  if (NETWORK_ERROR_RE.test(err.message)) return true;
  // Adapter errors look like "OpenAI API error (429): ..."
  const status = Number(err.message.match(/\((\d{3})\)/)?.[1]);
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

/** Turn a raw fetch/stream error into a message the user can act on. */
function describeError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (NETWORK_ERROR_RE.test(raw)) {
    return '網路連線中斷（串流可能被中途中斷）。已自動重試仍失敗，請檢查網路後按「重新翻譯」再試一次。';
  }
  return raw;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

  // Content streamed in the current attempt — kept at function scope so the
  // catch block can preserve partial output when a request ultimately fails.
  let streamedContent = '';

  // Overwrite the assistant placeholder's content (used by streaming + banners).
  const setAssistantContent = (text: string) => {
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last.id === assistantMsg.id) {
        msgs[msgs.length - 1] = { ...last, content: text };
      }
      return { messages: msgs };
    });
  };

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

    // Stream the translation, auto-retrying transient failures (connection
    // drops / 429 / 5xx). Each attempt starts from a clean slate so retries
    // never append onto a previous attempt's partial output.
    const MAX_ATTEMPTS = 3;
    let response: AIResponse | undefined;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      streamedContent = '';
      setAssistantContent(attempt > 1 ? `⏳ 連線中斷，重試中（${attempt}/${MAX_ATTEMPTS}）…` : '');
      try {
        response = await callFunction(
          fnConfig,
          apiKeys,
          messages,
          {
            overrideProvider: state.currentModel.provider,
            overrideModel: state.currentModel.model,
            signal: abortController.signal,
            stream: {
              onChunk: (chunk) => {
                streamedContent += chunk;
                setAssistantContent(streamedContent);
              },
              onDone: () => {},
              onError: () => {},
            },
          }
        );
        break; // success
      } catch (err) {
        if (attempt < MAX_ATTEMPTS && isRetryableError(err)) {
          console.warn(`[sendMessage] attempt ${attempt}/${MAX_ATTEMPTS} failed, retrying:`, err);
          await delay(400 * attempt); // linear backoff
          continue;
        }
        throw err; // aborted, non-retryable, or out of attempts
      }
    }
    if (!response) throw new Error('翻譯失敗：未取得回應');

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
    const aborted = isAbortError(err);
    const partial = streamedContent.trim();
    set((s) => {
      const msgs = [...s.messages];
      const last = msgs[msgs.length - 1];
      if (last.id === assistantMsg.id) {
        let content: string;
        if (aborted) {
          // User stopped the request — keep whatever streamed, note the stop.
          content = partial ? `${streamedContent}\n\n_（已停止）_` : '_（已停止）_';
        } else if (partial) {
          // Genuine failure but we have partial output — preserve it, append note.
          content = `${streamedContent}\n\n> ⚠️ ${describeError(err)}`;
        } else {
          content = `**Error:** ${describeError(err)}`;
        }
        msgs[msgs.length - 1] = { ...last, content };
      }
      return { messages: msgs, isLoading: false, abortController: null };
    });
  }
}
