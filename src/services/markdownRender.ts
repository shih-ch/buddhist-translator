import React from 'react';

/**
 * Render a Markdown string to an HTML string (GFM tables + raw HTML passthrough).
 * All heavy deps are dynamically imported so they stay out of the main bundle.
 * Shared by the translator's HTML/PDF export and the batch B5 PDF booklet.
 */
export async function renderMarkdownToHtml(markdown: string): Promise<string> {
  const ReactMarkdown = (await import('react-markdown')).default;
  const remarkGfm = (await import('remark-gfm')).default;
  const rehypeRaw = (await import('rehype-raw')).default;
  const { renderToString } = await import('react-dom/server');
  return renderToString(
    React.createElement(
      ReactMarkdown,
      { remarkPlugins: [remarkGfm], rehypePlugins: [rehypeRaw] },
      markdown
    )
  );
}
