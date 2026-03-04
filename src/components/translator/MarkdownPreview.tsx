import { useMemo, useState, Component, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { parseMarkdown } from '@/services/markdownUtils';
import { useGlossaryStore } from '@/stores/glossaryStore';
import { Button } from '@/components/ui/button';
import { Highlighter } from 'lucide-react';
import type { GlossaryTerm } from '@/types/glossary';
import { CATEGORY_LABELS, escapeRegExp } from '@/services/glossaryAnnotator';

interface MarkdownPreviewProps {
  content: string;
}

/** Build a native title string for a glossary term */
function buildTermTitle(term: GlossaryTerm): string {
  const lines = [`${term.original} → ${term.translation}`];
  if (term.sanskrit) lines.push(`梵: ${term.sanskrit}`);
  if (term.tibetan) lines.push(`藏: ${term.tibetan}`);
  if (term.wylie) lines.push(`Wylie: ${term.wylie}`);
  lines.push(CATEGORY_LABELS[term.category] ?? term.category);
  if (term.definition) {
    lines.push(term.definition.length > 100 ? term.definition.slice(0, 100) + '…' : term.definition);
  }
  if (term.notes) lines.push(term.notes);
  return lines.join('\n');
}

/** Highlight glossary terms in a text string, returning React nodes */
function highlightTerms(
  text: string,
  regex: RegExp,
  termMap: Map<string, GlossaryTerm>,
): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Reset regex state
  regex.lastIndex = 0;

  while ((match = regex.exec(text)) !== null) {
    const matchedText = match[0];
    const term = termMap.get(matchedText.toLowerCase());
    if (!term) continue;

    // Add preceding text
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    // Add highlighted term with native title tooltip
    nodes.push(
      <mark
        key={`${match.index}-${matchedText}`}
        className="bg-yellow-100/60 dark:bg-yellow-900/30 rounded px-0.5 cursor-help"
        title={buildTermTitle(term)}
      >
        {matchedText}
      </mark>,
    );

    lastIndex = match.index + matchedText.length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}

/** Recursively process React children, highlighting text nodes */
function processChildren(
  children: ReactNode,
  regex: RegExp,
  termMap: Map<string, GlossaryTerm>,
): ReactNode {
  if (children == null || typeof children === 'boolean') return children;
  if (typeof children === 'number') return String(children);
  if (typeof children === 'string') {
    const result = highlightTerms(children, regex, termMap);
    return result.length === 1 && typeof result[0] === 'string' ? result[0] : <>{result}</>;
  }
  if (Array.isArray(children)) {
    return children.map((child, i) => {
      const processed = processChildren(child, regex, termMap);
      return typeof processed === 'string' ? processed : <span key={i}>{processed}</span>;
    });
  }
  return children;
}

/** Error Boundary to prevent highlighting crashes from blanking the page */
class HighlightErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    console.error('[MarkdownPreview] Highlight rendering error:', error);
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const [highlightEnabled, setHighlightEnabled] = useState(true);
  const terms = useGlossaryStore((s) => s.glossary?.terms ?? []);

  // Build regex and term lookup map
  const { regex, termMap } = useMemo(() => {
    if (terms.length === 0) return { regex: null, termMap: new Map<string, GlossaryTerm>() };

    const map = new Map<string, GlossaryTerm>();
    for (const t of terms) {
      if (t.category === 'person' || t.category === 'place') continue;
      for (const val of [t.sanskrit, t.tibetan, t.wylie]) {
        if (val && val.length > 1) {
          map.set(val.toLowerCase(), t);
        }
      }
    }

    const patterns = [...map.keys()].sort((a, b) => b.length - a.length);
    if (patterns.length === 0) return { regex: null, termMap: map };

    try {
      const re = new RegExp(patterns.map(escapeRegExp).join('|'), 'gi');
      return { regex: re, termMap: map };
    } catch {
      // Regex too large — fall back to sanskrit only
      const fallbackMap = new Map<string, GlossaryTerm>();
      const fallbackPatterns: string[] = [];
      for (const t of terms) {
        if (t.sanskrit && t.sanskrit.length > 1) {
          fallbackMap.set(t.sanskrit.toLowerCase(), t);
          fallbackPatterns.push(escapeRegExp(t.sanskrit.toLowerCase()));
        }
      }
      const unique = [...new Set(fallbackPatterns)].sort((a, b) => b.length - a.length);
      if (unique.length === 0) return { regex: null, termMap: fallbackMap };
      const re = new RegExp(unique.join('|'), 'gi');
      return { regex: re, termMap: fallbackMap };
    }
  }, [terms]);

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

  const shouldHighlight = highlightEnabled && regex && termMap.size > 0;

  const highlightComponents = shouldHighlight
    ? {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        p: ({ children, ...props }: any) => (
          <p {...props}>{processChildren(children, regex!, termMap)}</p>
        ),
      }
    : {};

  const markdownContent = (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      components={{
        ...highlightComponents,
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
  );

  // Fallback: render without highlighting
  const fallbackContent = (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      components={{
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
  );

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none p-4">
      {/* Highlight toggle */}
      {terms.length > 0 && (
        <div className="flex justify-end mb-2 not-prose">
          <Button
            type="button"
            variant={highlightEnabled ? 'secondary' : 'ghost'}
            size="sm"
            className="h-6 text-xs px-2"
            onClick={(e) => {
              e.preventDefault();
              setHighlightEnabled(!highlightEnabled);
            }}
            title="術語標註"
          >
            <Highlighter className="size-3 mr-1" />
            術語標註
          </Button>
        </div>
      )}

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

      <HighlightErrorBoundary fallback={fallbackContent}>
        {markdownContent}
      </HighlightErrorBoundary>
    </div>
  );
}
