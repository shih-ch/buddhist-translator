import { create } from 'zustand';
import type { ArticleFrontmatter, Article } from '@/types/article';
import type { ChatMessage } from '@/types/chat';
import type { AIProviderId, TranslationParams } from '@/types/settings';
import { assembleMarkdown } from '@/services/markdownUtils';
import { callFunction } from '@/services/ai/router';
import { buildTranslationMessages } from '@/services/ai/promptBuilder';
import { useAIFunctionsStore } from '@/stores/aiFunctionsStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useGlossaryStore } from '@/stores/glossaryStore';
import type { AIMessage } from '@/services/ai/types';
import { AI_PROVIDERS } from '@/stores/aiModels';
import { logTranslation } from '@/services/translationLogger';

const DEFAULT_PARAMS: TranslationParams = {
  keepOriginalPerLine: true,
  narrativePerLine: false,
  fiveColumnMode: false,
  fiveColumnScope: '全文',
  tibetanTranslitMode: 'A1',
  mantraTranslit: 'IAST',
  onlyVerseMantra: false,
  proofreadMode: 'annotate_only',
};

const DEFAULT_FRONTMATTER: ArticleFrontmatter = {
  title: '',
  author: '',
  source: '',
  date: new Date().toISOString().split('T')[0],
  original_language: 'ru',
  translator_model: 'gpt-4o',
  tags: [],
};

interface TranslatorState {
  // Input
  inputMode: 'paste' | 'url' | 'import';
  originalText: string;
  importedText: string;
  metadata: ArticleFrontmatter;

  // Params
  translationParams: TranslationParams;
  activePreset: string | null;

  // Chat
  messages: ChatMessage[];
  isLoading: boolean;
  currentModel: { provider: AIProviderId; model: string };
  totalTokens: number;
  totalCost: number;

  // Preview
  previewContent: string;
  previewMode: 'rendered' | 'source';

  // Editing (from Articles page)
  editingArticle: Article | null;

  // Abort controller for streaming
  abortController: AbortController | null;

  // Actions
  setInputMode: (mode: 'paste' | 'url' | 'import') => void;
  setOriginalText: (text: string) => void;
  setImportedText: (text: string) => void;
  updateMetadata: (updates: Partial<ArticleFrontmatter>) => void;
  setTranslationParams: (params: Partial<TranslationParams>) => void;
  applyPreset: (presetName: string, params: TranslationParams) => void;
  sendMessage: (content: string) => Promise<void>;
  adoptVersion: (messageId: string) => void;
  setPreviewContent: (content: string) => void;
  setPreviewMode: (mode: 'rendered' | 'source') => void;
  setCurrentModel: (provider: AIProviderId, model: string) => void;
  loadArticleForEdit: (article: Article) => void;
  stopGeneration: () => void;
  reset: () => void;
}

let messageCounter = 0;
function genId() {
  return `msg-${++messageCounter}-${Date.now()}`;
}

/** Extract a title from translated content: first markdown heading, or first non-empty line */
function extractTitle(content: string): string | null {
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Match markdown heading: # Title
    const headingMatch = trimmed.match(/^#{1,3}\s+(.+)/);
    if (headingMatch) return headingMatch[1].trim();
    // Use first non-empty line as fallback
    return trimmed;
  }
  return null;
}

export const useTranslatorStore = create<TranslatorState>((set, get) => ({
  // Initial state
  inputMode: 'paste',
  originalText: '',
  importedText: '',
  metadata: { ...DEFAULT_FRONTMATTER },
  translationParams: { ...DEFAULT_PARAMS },
  activePreset: '一般文章',
  messages: [],
  isLoading: false,
  currentModel: { provider: 'openai' as AIProviderId, model: 'gpt-5.2-pro' },
  totalTokens: 0,
  totalCost: 0,
  previewContent: '',
  previewMode: 'rendered',
  editingArticle: null,
  abortController: null,

  setInputMode: (mode) => set({ inputMode: mode }),

  setOriginalText: (text) => set({ originalText: text }),

  setImportedText: (text) => set({ importedText: text }),

  updateMetadata: (updates) =>
    set((state) => ({
      metadata: { ...state.metadata, ...updates },
    })),

  setTranslationParams: (params) =>
    set((state) => ({
      translationParams: { ...state.translationParams, ...params },
      activePreset: null,
    })),

  applyPreset: (presetName, params) =>
    set({
      translationParams: { ...params },
      activePreset: presetName,
    }),

  setCurrentModel: (provider, model) =>
    set({ currentModel: { provider, model } }),

  sendMessage: async (content: string) => {
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
    const userMsg: ChatMessage = {
      id: genId(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };

    // Create placeholder assistant message for streaming
    const assistantMsg: ChatMessage = {
      id: genId(),
      role: 'assistant',
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

      // Build chat history for translation context
      const chatHistory: AIMessage[] = state.messages.map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
      }));
      // Add current user message to history
      chatHistory.push({ role: 'user', content });

      // For the first message, use the full translation prompt builder
      // For follow-up messages, just pass the conversation history
      let messages: AIMessage[];
      if (state.messages.length === 0) {
        messages = buildTranslationMessages(
          fnConfig.prompt,
          content,
          state.translationParams,
          glossaryTerms,
          []
        );
      } else {
        // Follow-up: system prompt + full history
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
          totalCost:
            s.totalCost +
            (response.usage.prompt_tokens * inputPrice +
              response.usage.completion_tokens * outputPrice) /
              1_000_000,
        };
      });
    } catch (err) {
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
  },

  adoptVersion: (messageId: string) => {
    const state = get();
    const msg = state.messages.find((m) => m.id === messageId);
    if (!msg) return;

    // If title is empty, extract from translated content
    let metadata = state.metadata;
    if (!metadata.title.trim()) {
      const extracted = extractTitle(msg.content);
      if (extracted) {
        metadata = { ...metadata, title: extracted };
        set({ metadata });
      }
    }

    const md = assembleMarkdown(metadata, msg.content, state.originalText || undefined);
    set({ previewContent: md });

    // Log translation session to GitHub (fire-and-forget)
    const userMessages = state.messages.filter((m) => m.role === 'user');
    const corrections = userMessages.slice(1).map((m) => ({
      type: 'other' as const,
      instruction: m.content,
    }));
    const slug = state.metadata.title || state.metadata.date;
    logTranslation({
      date: new Date().toISOString().split('T')[0],
      article: slug,
      function: 'translation',
      provider: state.currentModel.provider,
      model: state.currentModel.model,
      params: state.translationParams as unknown as Record<string, unknown>,
      rounds: userMessages.length,
      corrections,
    }).catch(() => { /* non-blocking */ });
  },

  setPreviewContent: (content) => set({ previewContent: content }),

  setPreviewMode: (mode) => set({ previewMode: mode }),

  loadArticleForEdit: (article) =>
    set({
      editingArticle: article,
      metadata: { ...article.frontmatter },
      previewContent: assembleMarkdown(
        article.frontmatter,
        article.content,
        article.originalText
      ),
      originalText: article.originalText ?? '',
    }),

  stopGeneration: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
      set({ isLoading: false, abortController: null });
    }
  },

  reset: () =>
    set({
      inputMode: 'paste',
      originalText: '',
      importedText: '',
      metadata: { ...DEFAULT_FRONTMATTER },
      translationParams: { ...DEFAULT_PARAMS },
      activePreset: '一般文章',
      messages: [],
      isLoading: false,
      currentModel: { provider: 'openai', model: 'gpt-5.2-pro' },
      totalTokens: 0,
      totalCost: 0,
      previewContent: '',
      previewMode: 'rendered',
      editingArticle: null,
      abortController: null,
    }),
}));
