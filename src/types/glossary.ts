export type SourceLanguage = 'sanskrit' | 'pali' | 'tibetan' | 'chinese' | 'english' | 'other';

export const LANGUAGE_LABELS: Record<SourceLanguage, string> = {
  sanskrit: '梵文',
  pali: '巴利文',
  tibetan: '藏文',
  chinese: '中文',
  english: '英文',
  other: '其他',
};

export interface GlossaryTerm {
  id: string;
  original: string;
  translation: string;
  sanskrit: string;
  language: SourceLanguage;
  category: 'concept' | 'person' | 'place' | 'practice' | 'text' | 'deity' | 'mantra';
  notes: string;
  added_at: string;
  source_article: string;
  tibetan?: string;
  wylie?: string;
  definition?: string;
  link?: string;
}

export interface Glossary {
  version: number;
  updated_at: string;
  terms: GlossaryTerm[];
}
