import { create } from 'zustand';
import type { ArticleFrontmatter, Article } from '@/types/article';
import type { ChatMessage } from '@/types/chat';
import type { AIProviderId, TranslationParams } from '@/types/settings';
import { mockStreamingCall } from '@/services/ai/mock';
import { assembleMarkdown } from '@/services/markdownUtils';

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
  author: 'Олег Ганченко',
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
  currentModel: { provider: 'openai' as AIProviderId, model: 'gpt-4o' },
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
      const allMessages = [...state.messages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await mockStreamingCall(
        allMessages,
        (chunk) => {
          set((s) => {
            const msgs = [...s.messages];
            const last = msgs[msgs.length - 1];
            if (last.id === assistantMsg.id) {
              msgs[msgs.length - 1] = { ...last, content: last.content + chunk };
            }
            return { messages: msgs };
          });
        },
        abortController.signal
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
            (response.usage.prompt_tokens * 2.5 + response.usage.completion_tokens * 10) /
              1_000_000,
        };
      });
    } catch {
      set({ isLoading: false, abortController: null });
    }
  },

  adoptVersion: (messageId: string) => {
    const state = get();
    const msg = state.messages.find((m) => m.id === messageId);
    if (!msg) return;

    const md = assembleMarkdown(state.metadata, msg.content, state.originalText || undefined);
    set({ previewContent: md });
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
      currentModel: { provider: 'openai', model: 'gpt-4o' },
      totalTokens: 0,
      totalCost: 0,
      previewContent: '',
      previewMode: 'rendered',
      editingArticle: null,
      abortController: null,
    }),
}));
