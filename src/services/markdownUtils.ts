import matter from 'gray-matter';
import type { ArticleFrontmatter } from '@/types/article';

/**
 * Assemble a complete Markdown file: frontmatter + body + original text collapsible.
 */
export function assembleMarkdown(
  frontmatter: ArticleFrontmatter,
  translatedContent: string,
  originalText?: string
): string {
  const fm: Record<string, unknown> = {
    title: frontmatter.title,
    author: frontmatter.author,
    source: frontmatter.source,
    date: frontmatter.date,
    original_language: frontmatter.original_language,
    translator_model: frontmatter.translator_model,
  };
  if (frontmatter.translation_mode) {
    fm.translation_mode = frontmatter.translation_mode;
  }
  if (frontmatter.tags.length > 0) {
    fm.tags = frontmatter.tags;
  }

  const yamlLines = ['---'];
  for (const [key, value] of Object.entries(fm)) {
    if (Array.isArray(value)) {
      yamlLines.push(`${key}:`);
      for (const item of value) {
        yamlLines.push(`  - ${JSON.stringify(item)}`);
      }
    } else if (typeof value === 'string' && (value.includes(':') || value.includes('"'))) {
      yamlLines.push(`${key}: ${JSON.stringify(value)}`);
    } else {
      yamlLines.push(`${key}: ${value}`);
    }
  }
  yamlLines.push('---');

  let md = yamlLines.join('\n') + '\n\n';
  md += translatedContent.trim() + '\n';

  if (originalText && originalText.trim()) {
    md += '\n---\n\n';
    md += '<details>\n';
    md += '<summary>原文 (Original)</summary>\n\n';
    md += originalText.trim() + '\n\n';
    md += '</details>\n';
  }

  return md;
}

/**
 * Parse a Markdown file into frontmatter, content, and optional original text.
 */
export function parseMarkdown(md: string): {
  frontmatter: ArticleFrontmatter;
  content: string;
  originalText?: string;
} {
  const { data, content: body } = matter(md);

  const frontmatter: ArticleFrontmatter = {
    title: data.title ?? '',
    author: data.author ?? '',
    source: data.source ?? '',
    date: data.date instanceof Date ? data.date.toISOString().split('T')[0] : (data.date ?? ''),
    original_language: data.original_language ?? '',
    translator_model: data.translator_model ?? '',
    translation_mode: data.translation_mode,
    tags: Array.isArray(data.tags) ? data.tags : [],
  };

  // Split body into content and original text (from <details> block)
  const detailsMatch = body.match(
    /\n---\s*\n+<details>\s*\n<summary>原文\s*\(Original\)<\/summary>\s*\n([\s\S]*?)\n<\/details>/
  );

  let content: string;
  let originalText: string | undefined;

  if (detailsMatch) {
    content = body.slice(0, detailsMatch.index!).trim();
    originalText = detailsMatch[1].trim();
  } else {
    content = body.trim();
  }

  return { frontmatter, content, originalText };
}

/**
 * Generate a URL-safe slug from a title (supports Chinese characters).
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff\u3400-\u4dbf-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

/**
 * Generate file path: translations/{year}/{month}/{date}-{slug}.md
 */
export function generateFilePath(date: string, title: string): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const slug = generateSlug(title);
  return `translations/${year}/${month}/${date}-${slug}.md`;
}

/**
 * Parse only frontmatter from markdown content (for listing).
 */
export function parseFrontmatterOnly(raw: string): ArticleFrontmatter | null {
  try {
    const { data } = matter(raw);
    if (!data.title) return null;
    return {
      title: data.title ?? '',
      author: data.author ?? '',
      source: data.source ?? '',
      date: data.date instanceof Date ? data.date.toISOString().split('T')[0] : (data.date ?? ''),
      original_language: data.original_language ?? '',
      translator_model: data.translator_model ?? '',
      translation_mode: data.translation_mode,
      tags: Array.isArray(data.tags) ? data.tags : [],
    };
  } catch {
    return null;
  }
}

/**
 * Convert frontmatter + path into ArticleSummary.
 */
export function toSummary(path: string, fm: ArticleFrontmatter): import('@/types/article').ArticleSummary {
  return {
    path,
    title: fm.title,
    author: fm.author,
    date: fm.date,
    original_language: fm.original_language,
  };
}
