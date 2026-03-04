import type { GlossaryTerm } from '@/types/glossary';

export type AnnotationMode = 'abbr' | 'link';

export const CATEGORY_LABELS: Record<string, string> = {
  concept: '概念',
  person: '人名',
  place: '地名',
  practice: '修法',
  text: '經典',
  deity: '本尊/護法',
  mantra: '咒語',
};

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildTooltip(term: GlossaryTerm): string {
  const parts: string[] = [term.original];
  if (term.sanskrit) parts.push(`梵: ${term.sanskrit}`);
  if (CATEGORY_LABELS[term.category]) parts.push(CATEGORY_LABELS[term.category]);
  if (term.definition) {
    parts.push(term.definition.length > 60 ? term.definition.slice(0, 60) + '…' : term.definition);
  }
  return parts.join(' | ');
}

/**
 * Collect character ranges that should not be annotated:
 * - fenced code blocks (``` ... ```)
 * - inline code (` ... `)
 * - existing <abbr ...>...</abbr>
 * - existing markdown links [...](...)
 */
function getProtectedRanges(text: string): [number, number][] {
  const ranges: [number, number][] = [];
  const patterns = [
    /```[\s\S]*?```/g,           // fenced code blocks
    /`[^`]+`/g,                  // inline code
    /<abbr[\s\S]*?<\/abbr>/gi,   // existing abbr tags
    /\[[^\]]*\]\([^)]*\)/g,      // markdown links
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      ranges.push([m.index, m.index + m[0].length]);
    }
  }
  return ranges;
}

function isInProtectedRange(pos: number, len: number, ranges: [number, number][]): boolean {
  const end = pos + len;
  return ranges.some(([start, stop]) => pos >= start && end <= stop);
}

export function annotateGlossaryTerms(
  body: string,
  terms: GlossaryTerm[],
  mode: AnnotationMode,
): { text: string; count: number } {
  // 1. Filter: must have translation with length >= 2
  const eligible = terms.filter((t) => t.translation && t.translation.length >= 2);
  if (eligible.length === 0) return { text: body, count: 0 };

  // 2. Build map keyed by translation, longer first
  const termMap = new Map<string, GlossaryTerm>();
  // Sort by translation length descending so longer terms take priority
  const sorted = [...eligible].sort((a, b) => b.translation.length - a.translation.length);
  for (const t of sorted) {
    const key = t.translation;
    if (!termMap.has(key)) {
      termMap.set(key, t);
    }
  }

  // 3. Build regex from all translation keys, longest first
  const patterns = [...termMap.keys()].map(escapeRegExp);
  if (patterns.length === 0) return { text: body, count: 0 };

  let regex: RegExp;
  try {
    regex = new RegExp(patterns.join('|'), 'g');
  } catch {
    return { text: body, count: 0 };
  }

  // 4. Identify protected ranges
  const protectedRanges = getProtectedRanges(body);

  // 5. Replace: each term only on first occurrence
  const annotated = new Set<string>();
  let count = 0;
  let result = '';
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(body)) !== null) {
    const matchedText = match[0];

    // Skip if inside protected range
    if (isInProtectedRange(match.index, matchedText.length, protectedRanges)) continue;

    // Skip if already annotated this term
    if (annotated.has(matchedText)) continue;

    const term = termMap.get(matchedText);
    if (!term) continue;

    annotated.add(matchedText);
    count++;

    // Append text before match
    result += body.slice(lastIndex, match.index);

    // Generate annotation
    const tooltip = buildTooltip(term);

    if (mode === 'link' && term.link) {
      // Escape quotes in tooltip for markdown title
      const escaped = tooltip.replace(/"/g, '&quot;');
      result += `[${matchedText}](${term.link} "${escaped}")`;
    } else {
      // abbr mode (or link fallback when no link)
      const escaped = tooltip.replace(/"/g, '&quot;');
      result += `<abbr title="${escaped}">${matchedText}</abbr>`;
    }

    lastIndex = match.index + matchedText.length;
  }

  // Append remaining text
  result += body.slice(lastIndex);

  return { text: result, count };
}
