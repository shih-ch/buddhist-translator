import { create, type StoreApi } from 'zustand';
import type { ArticleFrontmatter, Article } from '@/types/article';
import type { ChatMessage } from '@/types/chat';
import type { AIProviderId, TranslationParams } from '@/types/settings';
import type { ArticleImage, SavedVersion } from '@/types/translator';
import { assembleMarkdown } from '@/services/markdownUtils';
import { DEFAULT_TRANSLATION_MODEL } from '@/stores/aiModels';
import { performSendMessage, genId } from './actions/sendMessage';
import { performAdoptVersion } from './actions/adoptVersion';
import { loadVersions, persistVersions } from './actions/versionStorage';
import { toast } from 'sonner';

export type { ArticleImage, SavedVersion } from '@/types/translator';

const DEFAULT_PARAMS: TranslationParams = {
  keepOriginalPerLine: true,
  narrativePerLine: false,
  fiveColumnMode: false,
  fiveColumnScope: '全文',
  tibetanTranslitMode: 'A1',
  mantraTranslit: 'wylie',
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

export interface TranslatorState {
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

  // Images
  articleImages: ArticleImage[];

  // Editing (from Articles page)
  editingArticle: Article | null;

  // Abort controller for streaming
  abortController: AbortController | null;

  // Partial replacement (select & retranslate)
  replacementRange: { start: number; end: number; originalPreview: string } | null;

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
  addArticleImage: (img: ArticleImage) => void;
  removeArticleImage: (path: string) => void;
  loadArticleForEdit: (article: Article) => void;
  setReplacementRange: (range: { start: number; end: number; originalPreview: string } | null) => void;
  stopGeneration: () => void;
  reset: () => void;
  saveVersion: (name?: string) => void;
  loadVersion: (index: number) => void;
  deleteVersion: (index: number) => void;
}

export type TranslatorStoreGet = StoreApi<TranslatorState>['getState'];
export type TranslatorStoreSet = StoreApi<TranslatorState>['setState'];

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
  currentModel: { ...DEFAULT_TRANSLATION_MODEL },
  totalTokens: 0,
  totalCost: 0,
  previewContent: '',
  previewMode: 'rendered',
  savedVersions: loadVersions(),
  articleImages: [],
  editingArticle: null,
  abortController: null,
  replacementRange: null,

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

  sendMessage: (content) => performSendMessage(content, get, set),
  adoptVersion: (messageId) => performAdoptVersion(messageId, get, set),

  setPreviewContent: (content) => set({ previewContent: content }),
  setPreviewMode: (mode) => set({ previewMode: mode }),

  addArticleImage: (img) =>
    set((state) => ({ articleImages: [...state.articleImages, img] })),

  removeArticleImage: (path) =>
    set((state) => ({ articleImages: state.articleImages.filter((i) => i.path !== path) })),

  loadArticleForEdit: (article) => {
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

  setReplacementRange: (range) => set({ replacementRange: range }),

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
    if (persistVersions(updated)) {
      toast.success(`已儲存版本：${version.name}`);
    } else {
      toast.error('版本儲存失敗：localStorage 空間不足');
    }
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

  reset: () => {
    get().abortController?.abort();
    set({
      inputMode: 'paste',
      originalText: '',
      importedText: '',
      metadata: { ...DEFAULT_FRONTMATTER },
      translationParams: { ...DEFAULT_PARAMS },
      activePreset: '一般文章',
      messages: [],
      isLoading: false,
      currentModel: { ...DEFAULT_TRANSLATION_MODEL },
      totalTokens: 0,
      totalCost: 0,
      previewContent: '',
      previewMode: 'rendered',
      savedVersions: [],
      articleImages: [],
      editingArticle: null,
      abortController: null,
      replacementRange: null,
    });
  },
}));
