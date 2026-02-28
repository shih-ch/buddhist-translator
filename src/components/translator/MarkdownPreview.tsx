import { useMemo, useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { parseMarkdown } from '@/services/markdownUtils';
import { useGlossaryStore } from '@/stores/glossaryStore';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Highlighter } from 'lucide-react';
import type { GlossaryTerm } from '@/types/glossary';

const CATEGORY_LABELS: Record<string, string> = {
  concept: '概念',
  person: '人名',
  place: '地名',
  practice: '修法',
  text: '經典',
  deity: '本尊/護法',
  mantra: '咒語',
};

interface MarkdownPreviewProps {
  content: string;
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

    // Add highlighted term
    nodes.push(
      <Tooltip key={`${match.index}-${matchedText}`}>
        <TooltipTrigger asChild>
          <mark className="bg-yellow-100/60 dark:bg-yellow-900/30 rounded px-0.5 cursor-help">
            {matchedText}
          </mark>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs space-y-1 p-2">
          <div className="font-medium">{term.original} → {term.translation}</div>
          {term.sanskrit && <div className="text-[10px] opacity-80">梵: {term.sanskrit}</div>}
          {term.tibetan && <div className="text-[10px] opacity-80">藏: {term.tibetan}</div>}
          {term.wylie && <div className="text-[10px] opacity-80">Wylie: {term.wylie}</div>}
          <Badge variant="outline" className="text-[10px] h-4 text-gray-400 border-gray-400/50">{CATEGORY_LABELS[term.category] ?? term.category}</Badge>
          {term.definition && <div className="text-[10px] opacity-70 mt-1">{term.definition.length > 100 ? term.definition.slice(0, 100) + '…' : term.definition}</div>}
          {term.notes && <div className="text-[10px] opacity-70 mt-1">{term.notes}</div>}
        </TooltipContent>
      </Tooltip>,
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

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const [highlightEnabled, setHighlightEnabled] = useState(true);
  const terms = useGlossaryStore((s) => s.glossary?.terms ?? []);

  // Build regex and term lookup map
  // Map uses lowercase key → term (auto-deduplicates)
  // Supports reverse lookup: original, sanskrit, tibetan, wylie (excludes Chinese translation)
  const { regex, termMap } = useMemo(() => {
    if (terms.length === 0) return { regex: null, termMap: new Map<string, GlossaryTerm>() };

    const map = new Map<string, GlossaryTerm>();
    for (const t of terms) {
      if (t.category === 'person' || t.category === 'place') continue;
      for (const val of [t.original, t.sanskrit, t.tibetan, t.wylie]) {
        if (val && val.length > 1) {
          map.set(val.toLowerCase(), t);
        }
      }
    }

    // Use deduplicated map keys as patterns, sorted by length desc
    const patterns = [...map.keys()].sort((a, b) => b.length - a.length);
    if (patterns.length === 0) return { regex: null, termMap: map };

    try {
      const re = new RegExp(patterns.map(escapeRegExp).join('|'), 'gi');
      return { regex: re, termMap: map };
    } catch {
      // Regex too large — fall back to original only
      const fallbackMap = new Map<string, GlossaryTerm>();
      const fallbackPatterns: string[] = [];
      for (const t of terms) {
        if (t.original && t.original.length > 1) {
          fallbackMap.set(t.original.toLowerCase(), t);
          fallbackPatterns.push(escapeRegExp(t.original.toLowerCase()));
        }
      }
      const unique = [...new Set(fallbackPatterns)].sort((a, b) => b.length - a.length);
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

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none p-4">
      {/* Highlight toggle */}
      {terms.length > 0 && (
        <div className="flex justify-end mb-2 not-prose">
          <Button
            variant={highlightEnabled ? 'secondary' : 'ghost'}
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => setHighlightEnabled(!highlightEnabled)}
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

      <TooltipProvider>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={{
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            p: shouldHighlight
              ? ({ children, ...props }: any) => (
                  <p {...props}>{processChildren(children, regex!, termMap)}</p>
                )
              : undefined,
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
      </TooltipProvider>
    </div>
  );
}
