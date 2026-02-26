import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { parseFrontmatterOnly } from '@/services/markdownUtils';

interface MarkdownPreviewProps {
  content: string;
}

/**
 * Renders markdown with frontmatter displayed as a metadata table.
 */
export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  if (!content) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        尚無預覽內容
      </div>
    );
  }

  // Try to extract frontmatter for display
  const fm = parseFrontmatterOnly(content);
  const bodyStart = content.indexOf('---', 3);
  const body = fm && bodyStart !== -1
    ? content.slice(content.indexOf('\n', bodyStart) + 1)
    : content;

  return (
    <div className="p-4 space-y-4">
      {/* Metadata table */}
      {fm && (
        <div className="rounded-md border text-sm">
          <table className="w-full">
            <tbody>
              {fm.title && (
                <tr className="border-b"><td className="px-3 py-1.5 font-medium text-muted-foreground w-24">標題</td><td className="px-3 py-1.5">{fm.title}</td></tr>
              )}
              {fm.author && (
                <tr className="border-b"><td className="px-3 py-1.5 font-medium text-muted-foreground w-24">作者</td><td className="px-3 py-1.5">{fm.author}</td></tr>
              )}
              {fm.date && (
                <tr className="border-b"><td className="px-3 py-1.5 font-medium text-muted-foreground w-24">日期</td><td className="px-3 py-1.5">{fm.date}</td></tr>
              )}
              {fm.original_language && (
                <tr className="border-b"><td className="px-3 py-1.5 font-medium text-muted-foreground w-24">原文語言</td><td className="px-3 py-1.5">{fm.original_language}</td></tr>
              )}
              {fm.tags && fm.tags.length > 0 && (
                <tr><td className="px-3 py-1.5 font-medium text-muted-foreground w-24">標籤</td><td className="px-3 py-1.5">{fm.tags.join(', ')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Rendered markdown body */}
      <div className="prose prose-sm dark:prose-invert max-w-none [&_details]:border [&_details]:rounded-md [&_details]:p-3 [&_details]:my-3 [&_summary]:cursor-pointer [&_summary]:font-medium [&_table]:text-xs">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {body}
        </ReactMarkdown>
      </div>
    </div>
  );
}
