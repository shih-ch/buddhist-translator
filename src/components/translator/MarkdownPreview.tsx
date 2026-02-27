import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { parseMarkdown } from '@/services/markdownUtils';

interface MarkdownPreviewProps {
  content: string;
}

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  if (!content.trim()) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        翻譯結果會顯示在這裡
      </div>
    );
  }

  // Parse frontmatter for display
  let frontmatter: Record<string, unknown> | null = null;
  let body = content;
  try {
    const parsed = parseMarkdown(content);
    if (parsed.frontmatter.title) {
      frontmatter = parsed.frontmatter as unknown as Record<string, unknown>;
      // Reconstruct body with original text section
      body = parsed.content;
      if (parsed.originalText) {
        body +=
          '\n\n---\n\n<details>\n<summary>原文 (Original)</summary>\n\n' +
          parsed.originalText +
          '\n\n</details>';
      }
    }
  } catch {
    // Not parseable, just render as-is
  }

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none p-4">
      {/* Frontmatter as metadata table */}
      {frontmatter && (
        <div className="mb-4 rounded border bg-muted/30 p-3 text-xs">
          <table className="m-0 w-full">
            <tbody>
              {Object.entries(frontmatter).map(([key, value]) => {
                if (!value) return null;
                const display = Array.isArray(value) ? value.join(', ') : String(value);
                return (
                  <tr key={key} className="border-0">
                    <td className="border-0 py-0.5 pr-3 font-medium text-muted-foreground">
                      {key}
                    </td>
                    <td className="border-0 py-0.5">{display}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          // Render <details> as collapsible with styling
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          details: (props: any) => (
            <details className="my-4 rounded border bg-muted/20 p-4" {...props} />
          ),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          summary: (props: any) => (
            <summary className="cursor-pointer font-medium text-base mb-2" {...props} />
          ),
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
