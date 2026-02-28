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
import { useCostTrackingStore } from '@/stores/costTrackingStore';
import { useTranslationMemoryStore } from '@/stores/translationMemoryStore';
import { toast } from 'sonner';

export interface SavedVersion {
  id: string;
  name: string;
  content: string;
  model: string;
  provider: string;
  timestamp: number;
}

const VERSIONS_KEY_PREFIX = 'bt-saved-versions';

function loadVersions(): SavedVersion[] {
  try {
    const raw = localStorage.getItem(VERSIONS_KEY_PREFIX);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function persistVersions(versions: SavedVersion[]) {
  try {
    localStorage.setItem(VERSIONS_KEY_PREFIX, JSON.stringify(versions));
  } catch { /* ignore */ }
}

const DEFAULT_PARAMS: TranslationParams = {
  keepOriginalPerLine: true,
  narrativePerLine: false,
  fiveColumnMode: false,
  fiveColumnScope: '全文',
  tibetanTranslitMode: 'A1',
  mantraTranslit: 'IAST',
  onlyVerseMantra: false,
  proofreadMode: 'annotate_only',
  relayLanguage: 'none',
};

const DEFAULT_FRONTMATTER: ArticleFrontmatter = {
  title: '',
  author: '',
  source: '',
  date: new Date().toISOString().split('T')[0],
  original_language: 'ru',
  translator_model: '',
  tags: [],
};

interface TranslatorState {
  // Input
  inputMode: 'paste' | 'url' | 'import' | 'cbeta';
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

  // Versions
  savedVersions: SavedVersion[];

  // Editing (from Articles page)
  editingArticle: Article | null;

  // Abort controller for streaming
  abortController: AbortController | null;

  // Actions
  setInputMode: (mode: 'paste' | 'url' | 'import' | 'cbeta') => void;
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
  saveVersion: (name?: string) => void;
  loadVersion: (index: number) => void;
  deleteVersion: (index: number) => void;
}

let messageCounter = 0;
function genId() {
  return `msg-${++messageCounter}-${Date.now()}`;
}

/** Use AI to extract metadata (title, author) from translated content */
async function extractMetadataFromContent(
  content: string,
  originalText: string,
  provider: AIProviderId,
  model: string,
  fields: { title: boolean; author: boolean },
): Promise<{ title?: string; author?: string }> {
  try {
    const apiKeys = useSettingsStore.getState().apiKeys;
    if (!apiKeys[provider]) return {};

    const fnConfig = useAIFunctionsStore.getState().getFunctionConfig('translation');

    const requests: string[] = [];
    if (fields.title) requests.push('title: 根據內容生成一個簡潔的繁體中文標題');
    if (fields.author) requests.push('author: 從原文或譯文中找出文章作者姓名（保留原文語言）');

    const messages: AIMessage[] = [
      {
        role: 'system',
        content: `你是佛學文章元資料提取器。請從以下內容中提取資訊。
以 JSON 格式回覆，只包含以下欄位：
${requests.join('\n')}

只回覆 JSON，不要加其他說明。例如：{"title": "標題", "author": "作者"}`,
      },
      {
        role: 'user',
        content: `【譯文】\n${content.slice(0, 1500)}\n\n【原文】\n${originalText.slice(0, 1500)}`,
      },
    ];

    const response = await callFunction(
      { ...fnConfig, provider, model },
      apiKeys,
      messages,
      { overrideProvider: provider, overrideModel: model },
    );

    // Parse JSON from response (handle markdown code blocks)
    let text = response.content.trim();
    const codeBlock = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlock) text = codeBlock[1].trim();

    const parsed = JSON.parse(text);
    const result: { title?: string; author?: string } = {};
    if (fields.title && parsed.title) {
      result.title = String(parsed.title).replace(/^["「『]|["」』]$/g, '');
    }
    if (fields.author && parsed.author) {
      result.author = String(parsed.author).trim();
    }
    return result;
  } catch (err) {
    console.error('[extractMetadata] error:', err);
    return {};
  }
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
  currentModel: { provider: 'openai' as AIProviderId, model: 'gpt-5.1' },
  totalTokens: 0,
  totalCost: 0,
  previewContent: '',
  previewMode: 'rendered',
  savedVersions: loadVersions(),
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
          textForTranslation,
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
  },

  adoptVersion: (messageId: string) => {
    const state = get();
    const msg = state.messages.find((m) => m.id === messageId);
    if (!msg) return;

    // Set translator_model from the message's actual model (or current model)
    const actualModel = msg.model || state.currentModel.model;
    const metadata = { ...state.metadata, translator_model: actualModel };
    set({ metadata });

    // First, assemble with updated metadata
    const md = assembleMarkdown(metadata, msg.content, state.originalText || undefined);
    set({ previewContent: md });

    // Save to translation memory
    if (state.originalText) {
      useTranslationMemoryStore.getState().addEntry(
        state.originalText,
        msg.content,
        state.metadata.original_language,
        state.editingArticle?.path ?? '',
      );
    }

    // If title or author is empty, ask AI to extract from content
    const needTitle = !metadata.title.trim();
    const needAuthor = !metadata.author.trim();
    if (needTitle || needAuthor) {
      extractMetadataFromContent(
        msg.content,
        state.originalText,
        state.currentModel.provider,
        state.currentModel.model,
        { title: needTitle, author: needAuthor },
      ).then((extracted) => {
        if (extracted.title || extracted.author) {
          const updated = {
            ...get().metadata,
            ...(extracted.title ? { title: extracted.title } : {}),
            ...(extracted.author ? { author: extracted.author } : {}),
          };
          set({ metadata: updated });
          const newMd = assembleMarkdown(updated, msg.content, get().originalText || undefined);
          set({ previewContent: newMd });
          const parts: string[] = [];
          if (extracted.title) parts.push(`標題：${extracted.title}`);
          if (extracted.author) parts.push(`作者：${extracted.author}`);
          toast.success(`已自動提取 ${parts.join('、')}`);
        } else {
          toast.info('無法從內容中提取標題/作者，請手動填寫');
        }
      }).catch((err) => {
        console.error('[extractMetadata] failed:', err);
        toast.error(`提取標題/作者失敗：${err instanceof Error ? err.message : 'Unknown error'}`);
      });
    }

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

  loadArticleForEdit: (article) => {
    // Create synthetic chat messages so user sees the original conversation
    const syntheticMessages: ChatMessage[] = [];
    if (article.originalText) {
      syntheticMessages.push({
        id: genId(),
        role: 'user',
        content: article.originalText,
        timestamp: Date.now() - 1000,
      });
    }
    if (article.content) {
      syntheticMessages.push({
        id: genId(),
        role: 'assistant',
        content: article.content,
        timestamp: Date.now(),
        model: article.frontmatter.translator_model || undefined,
      });
    }
    set({
      editingArticle: article,
      metadata: { ...article.frontmatter },
      previewContent: assembleMarkdown(
        article.frontmatter,
        article.content,
        article.originalText
      ),
      originalText: article.originalText ?? '',
      messages: syntheticMessages,
    });
  },

  stopGeneration: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
      set({ isLoading: false, abortController: null });
    }
  },

  saveVersion: (name?: string) => {
    const state = get();
    if (!state.previewContent) return;
    const version: SavedVersion = {
      id: crypto.randomUUID(),
      name: name || `${state.currentModel.model} 翻譯 #${state.savedVersions.length + 1}`,
      content: state.previewContent,
      model: state.currentModel.model,
      provider: state.currentModel.provider,
      timestamp: Date.now(),
    };
    const updated = [...state.savedVersions, version];
    set({ savedVersions: updated });
    persistVersions(updated);
    toast.success(`已儲存版本：${version.name}`);
  },

  loadVersion: (index: number) => {
    const versions = get().savedVersions;
    if (index < 0 || index >= versions.length) return;
    set({ previewContent: versions[index].content });
    toast.success(`已載入版本：${versions[index].name}`);
  },

  deleteVersion: (index: number) => {
    const versions = [...get().savedVersions];
    if (index < 0 || index >= versions.length) return;
    const name = versions[index].name;
    versions.splice(index, 1);
    set({ savedVersions: versions });
    persistVersions(versions);
    toast.success(`已刪除版本：${name}`);
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
      currentModel: { provider: 'openai', model: 'gpt-5.1' },
      totalTokens: 0,
      totalCost: 0,
      previewContent: '',
      previewMode: 'rendered',
      savedVersions: [],
      editingArticle: null,
      abortController: null,
    }),
}));
