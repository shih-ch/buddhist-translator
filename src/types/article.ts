export interface ArticleFrontmatter {
  title: string;
  author: string;
  source: string;
  date: string;
  original_language: string;
  translator_model: string;
  translation_mode?: string;
  tags: string[];
}

export interface Article {
  path: string;
  frontmatter: ArticleFrontmatter;
  content: string;
  originalText?: string;
  sha?: string;
}

export interface ArticleSummary {
  path: string;
  title: string;
  author: string;
  date: string;
  original_language: string;
  sha: string;
}
