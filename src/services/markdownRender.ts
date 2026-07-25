import React from 'react';
import { markdownSanitizeSchema } from './markdownSanitize';

/**
 * Render a Markdown string to an HTML string (GFM tables + sanitized raw HTML).
 * All heavy deps are dynamically imported so they stay out of the main bundle.
 * Shared by the translator's HTML/PDF export and the batch B5 PDF booklet.
 */
export async function renderMarkdownToHtml(markdown: string): Promise<string> {
  const ReactMarkdown = (await import('react-markdown')).default;
  const remarkGfm = (await import('remark-gfm')).default;
  const rehypeRaw = (await import('rehype-raw')).default;
  const rehypeSanitize = (await import('rehype-sanitize')).default;
  const { renderToString } = await import('react-dom/server');
  return renderToString(
    React.createElement(
      ReactMarkdown,
      {
        remarkPlugins: [remarkGfm],
        // rehypeRaw must run first (it parses the raw HTML), sanitize right after.
        rehypePlugins: [rehypeRaw, [rehypeSanitize, markdownSanitizeSchema]],
      },
      markdown
    )
  );
}
