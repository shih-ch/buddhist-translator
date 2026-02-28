export type AIProviderId = 'openai' | 'anthropic' | 'google' | 'perplexity';
export type AIFunctionId = 'translation' | 'formatting' | 'term_extraction' | 'url_cleanup' | 'dictionary_lookup';

export interface AIFunctionConfig {
  id: AIFunctionId;
  name: string;
  description: string;
  provider: AIProviderId;
  model: string;
  prompt: string;
  defaultPrompt: string;
}

export interface TranslationPreset {
  name: string;
  icon: string;
  params: TranslationParams;
}

export interface TranslationParams {
  keepOriginalPerLine: boolean;
  narrativePerLine: boolean;
  fiveColumnMode: boolean;
  fiveColumnScope: string;
  tibetanTranslitMode: 'A1' | 'A2';
  mantraTranslit: 'wylie' | 'IAST' | 'keep_original' | 'if_possible';
  onlyVerseMantra: boolean;
  proofreadMode: 'off' | 'annotate_only' | 'allow_correction';
  relayLanguage: 'none' | 'en' | 'ru';
}

export interface AppConfig {
  version: number;
  ai_functions: Record<AIFunctionId, {
    provider: AIProviderId;
    model: string;
    prompt: string;
  }>;
  translation_presets: TranslationPreset[];
  defaults: {
    target_language: string;
    source_language: string;
    default_author: string;
  };
}
