import type { ArticleFrontmatter } from '@/types/article';
import { getLanguageName } from '@/services/languageDetect';

// ─── Simple YAML frontmatter parser (browser-safe, no Buffer dependency) ───

function parseFrontmatterRaw(md: string): { data: Record<string, unknown>; content: string } {
  const match = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { data: {}, content: md };

  const yaml = match[1];
  const content = match[2];
  const data: Record<string, unknown> = {};

  let currentKey = '';
  let currentArray: string[] | null = null;

  for (const line of yaml.split('\n')) {
    const arrayItem = line.match(/^\s+-\s+(.+)/);
    if (arrayItem && currentKey) {
      if (!currentArray) currentArray = [];
      // Strip surrounding quotes
      let val = arrayItem[1].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      currentArray.push(val);
      data[currentKey] = currentArray;
      continue;
    }

    // Flush previous array
    currentArray = null;

    const kvMatch = line.match(/^(\w[\w_]*):\s*(.*)/);
    if (kvMatch) {
      currentKey = kvMatch[1];
      let val = kvMatch[2].trim();
      if (!val) {
        // Could be start of an array
        data[currentKey] = [];
        currentArray = data[currentKey] as string[];
        continue;
      }
      // Strip surrounding quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      data[currentKey] = val;
    }
  }

  return { data, content };
}

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
    original_language: getLanguageName(frontmatter.original_language) || frontmatter.original_language,
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
    // Preserve line breaks: convert single newlines to markdown line breaks (two trailing spaces)
    // but keep blank lines as paragraph separators
    const formattedOriginal = originalText
      .trim()
      .split('\n')
      .map((line, i, arr) => {
        // If next line is blank or this is the last line, no trailing spaces needed
        if (i === arr.length - 1) return line
        if (arr[i + 1].trim() === '') return line
        // If this line is blank, keep as-is (paragraph separator)
        if (line.trim() === '') return line
        // Add two trailing spaces for markdown line break
        return line + '  '
      })
      .join('\n')
    md += formattedOriginal + '\n\n';
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
  const { data, content: body } = parseFrontmatterRaw(md);

  const s = (v: unknown): string => (v == null ? '' : String(v));
  const frontmatter: ArticleFrontmatter = {
    title: s(data.title),
    author: s(data.author),
    source: s(data.source),
    date: data.date instanceof Date ? data.date.toISOString().split('T')[0] : s(data.date),
    original_language: s(data.original_language),
    translator_model: s(data.translator_model),
    translation_mode: data.translation_mode as string | undefined,
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
    const { data } = parseFrontmatterRaw(raw);
    if (!data.title) return null;
    const s = (v: unknown): string => (v == null ? '' : String(v));
    return {
      title: s(data.title),
      author: s(data.author),
      source: s(data.source),
      date: data.date instanceof Date ? data.date.toISOString().split('T')[0] : s(data.date),
      original_language: s(data.original_language),
      translator_model: s(data.translator_model),
      translation_mode: data.translation_mode as string | undefined,
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
