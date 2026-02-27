import type { GlossaryTerm } from '@/types/glossary';

/**
 * Filter glossary terms to only those relevant to the given text.
 * Uses direct text matching + category boosting.
 *
 * @param terms All glossary terms
 * @param originalText The source text being translated
 * @param maxTerms Maximum terms to include (default 80)
 */
export function filterRelevantTerms(
  terms: GlossaryTerm[],
  originalText: string,
  maxTerms = 80
): GlossaryTerm[] {
  if (terms.length <= maxTerms) return terms;

  const textLower = originalText.toLowerCase();

  // Score each term by relevance
  const scored = terms.map((term) => {
    let score = 0;

    // Direct match of original term in text (highest priority)
    if (term.original && textLower.includes(term.original.toLowerCase())) {
      score += 10;
    }

    // Sanskrit/Pali/Tibetan match
    if (term.sanskrit && textLower.includes(term.sanskrit.toLowerCase())) {
      score += 8;
    }

    // Translation match (for proofreading / imported text)
    if (term.translation && textLower.includes(term.translation.toLowerCase())) {
      score += 5;
    }

    // Category relevance boosting based on content signals
    if (term.category === 'mantra' && /[oṃo][mṁm]/i.test(originalText)) {
      score += 2;
    }
    if (term.category === 'deity' && /[Dd]eity|[Yy]idam|本尊|護法/i.test(originalText)) {
      score += 2;
    }

    // Partial word match (for compound terms)
    if (score === 0 && term.original) {
      const words = term.original.split(/\s+/);
      for (const word of words) {
        if (word.length >= 3 && textLower.includes(word.toLowerCase())) {
          score += 3;
          break;
        }
      }
    }

    return { term, score };
  });

  // Sort by score descending, then by original term length (longer = more specific)
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.term.original?.length ?? 0) - (a.term.original?.length ?? 0);
  });

  return scored.slice(0, maxTerms).map((s) => s.term);
}
