import { create } from 'zustand'
import type { AIFunctionConfig, AIFunctionId, AIProviderId, TranslationPreset } from '@/types/settings'
import {
  DEFAULT_TRANSLATION_PROMPT,
  DEFAULT_FORMATTING_PROMPT,
  DEFAULT_TERM_EXTRACTION_PROMPT,
  DEFAULT_URL_CLEANUP_PROMPT,
  DEFAULT_DICTIONARY_LOOKUP_PROMPT,
} from './defaultPrompts'
import { usePromptHistoryStore } from './promptHistoryStore'

const DEFAULT_FUNCTIONS: AIFunctionConfig[] = [
  {
    id: 'translation',
    name: '翻譯',
    description: '將佛學文章翻譯為繁體中文',
    provider: 'openai',
    model: 'gpt-5.1',
    prompt: DEFAULT_TRANSLATION_PROMPT,
    defaultPrompt: DEFAULT_TRANSLATION_PROMPT,
  },
  {
    id: 'formatting',
    name: '格式整理',
    description: '整理已翻譯文章的格式與結構',
    provider: 'openai',
    model: 'gpt-4.1-mini',
    prompt: DEFAULT_FORMATTING_PROMPT,
    defaultPrompt: DEFAULT_FORMATTING_PROMPT,
  },
  {
    id: 'term_extraction',
    name: '術語提取',
    description: '從翻譯文章中提取佛學專有術語',
    provider: 'openai',
    model: 'gpt-4.1-mini',
    prompt: DEFAULT_TERM_EXTRACTION_PROMPT,
    defaultPrompt: DEFAULT_TERM_EXTRACTION_PROMPT,
  },
  {
    id: 'url_cleanup',
    name: '網頁摘取整理',
    description: '清理從網頁擷取的原始內容',
    provider: 'openai',
    model: 'gpt-4.1-mini',
    prompt: DEFAULT_URL_CLEANUP_PROMPT,
    defaultPrompt: DEFAULT_URL_CLEANUP_PROMPT,
  },
  {
    id: 'dictionary_lookup',
    name: '佛學辭典',
    description: '查詢梵文/藏文/巴利文佛學術語的詞源、定義與中文翻譯',
    provider: 'openai',
    model: 'gpt-4.1-mini',
    prompt: DEFAULT_DICTIONARY_LOOKUP_PROMPT,
    defaultPrompt: DEFAULT_DICTIONARY_LOOKUP_PROMPT,
  },
]

const DEFAULT_PRESETS: TranslationPreset[] = [
  {
    name: '一般文章',
    icon: '📄',
    params: {
      keepOriginalPerLine: true,
      narrativePerLine: false,
      fiveColumnMode: false,
      fiveColumnScope: '全文',
      tibetanTranslitMode: 'A1',
      mantraTranslit: 'wylie',
      onlyVerseMantra: false,
      proofreadMode: 'annotate_only',
      relayLanguage: 'none',
    },
  },
  {
    name: '五欄全文',
    icon: '📊',
    params: {
      keepOriginalPerLine: true,
      narrativePerLine: true,
      fiveColumnMode: true,
      fiveColumnScope: '全文',
      tibetanTranslitMode: 'A1',
      mantraTranslit: 'wylie',
      onlyVerseMantra: false,
      proofreadMode: 'annotate_only',
      relayLanguage: 'none',
    },
  },
  {
    name: '儀軌/偈頌',
    icon: '📿',
    params: {
      keepOriginalPerLine: true,
      narrativePerLine: false,
      fiveColumnMode: true,
      fiveColumnScope: '僅偈頌與咒語',
      tibetanTranslitMode: 'A1',
      mantraTranslit: 'wylie',
      onlyVerseMantra: true,
      proofreadMode: 'off',
      relayLanguage: 'none',
    },
  },
  {
    name: '校對模式',
    icon: '🔍',
    params: {
      keepOriginalPerLine: true,
      narrativePerLine: true,
      fiveColumnMode: false,
      fiveColumnScope: '全文',
      tibetanTranslitMode: 'A1',
      mantraTranslit: 'wylie',
      onlyVerseMantra: false,
      proofreadMode: 'annotate_only',
      relayLanguage: 'none',
    },
  },
]

const STORAGE_KEY = 'bt-ai-functions'
const PRESETS_KEY = 'bt-translation-presets'

function loadFunctions(): AIFunctionConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_FUNCTIONS
    const saved = JSON.parse(raw) as AIFunctionConfig[]
    // Merge with defaults to ensure new fields/functions are included
    return DEFAULT_FUNCTIONS.map((def) => {
      const found = saved.find((s) => s.id === def.id)
      return found ? { ...def, provider: found.provider, model: found.model, prompt: found.prompt } : def
    })
  } catch {
    return DEFAULT_FUNCTIONS
  }
}

function loadPresets(): TranslationPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY)
    return raw ? JSON.parse(raw) : DEFAULT_PRESETS
  } catch {
    return DEFAULT_PRESETS
  }
}

interface AIFunctionsState {
  functions: AIFunctionConfig[]
  presets: TranslationPreset[]

  getFunctionConfig: (id: AIFunctionId) => AIFunctionConfig
  updateFunctionConfig: (id: AIFunctionId, updates: Partial<Pick<AIFunctionConfig, 'provider' | 'model' | 'prompt'>>) => void
  resetFunctionPrompt: (id: AIFunctionId) => void
  getPresetsConfig: () => TranslationPreset[]
  updatePresets: (presets: TranslationPreset[]) => void
  syncFromRemote: (funcs: Record<AIFunctionId, { provider: AIProviderId; model: string; prompt: string }>, presets: TranslationPreset[]) => void
}

export const useAIFunctionsStore = create<AIFunctionsState>((set, get) => ({
  functions: loadFunctions(),
  presets: loadPresets(),

  getFunctionConfig: (id) => {
    const found = get().functions.find((f) => f.id === id)
    return found ?? DEFAULT_FUNCTIONS.find((f) => f.id === id)!
  },

  updateFunctionConfig: (id, updates) => {
    // Record prompt change in history (before applying)
    if (updates.prompt !== undefined) {
      const current = get().functions.find((f) => f.id === id)
      if (current && current.prompt !== updates.prompt) {
        usePromptHistoryStore.getState().addEntry(id, current.prompt, 'edit')
      }
    }
    set((state) => {
      const updated = state.functions.map((f) =>
        f.id === id ? { ...f, ...updates } : f
      )
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      return { functions: updated }
    })
  },

  resetFunctionPrompt: (id) => {
    const def = DEFAULT_FUNCTIONS.find((f) => f.id === id)
    if (!def) return
    // Record current prompt before resetting
    const current = get().functions.find((f) => f.id === id)
    if (current && current.prompt !== def.defaultPrompt) {
      usePromptHistoryStore.getState().addEntry(id, current.prompt, 'reset')
    }
    set((state) => {
      const updated = state.functions.map((f) =>
        f.id === id ? { ...f, prompt: def.defaultPrompt } : f
      )
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      return { functions: updated }
    })
  },

  getPresetsConfig: () => get().presets,

  updatePresets: (presets) => {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets))
    set({ presets })
  },

  syncFromRemote: (funcs, presets) => {
    set((state) => {
      const updated = state.functions.map((f) => {
        const remote = funcs[f.id]
        return remote ? { ...f, provider: remote.provider, model: remote.model, prompt: remote.prompt } : f
      })
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      localStorage.setItem(PRESETS_KEY, JSON.stringify(presets))
      return { functions: updated, presets }
    })
  },
}))
