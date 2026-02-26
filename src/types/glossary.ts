export interface GlossaryTerm {
  id: string;
  original: string;
  translation: string;
  sanskrit: string;
  category: 'concept' | 'person' | 'place' | 'practice' | 'text' | 'deity' | 'mantra';
  notes: string;
  added_at: string;
  source_article: string;
}

export interface Glossary {
  version: number;
  updated_at: string;
  terms: GlossaryTerm[];
}
