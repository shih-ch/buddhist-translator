/**
 * Simple heuristic token estimator.
 * Not meant to be precise — used for approximate display ("~xxx tokens").
 *
 * Rough ratios:
 *  - English / Latin-script: ~4 chars per token
 *  - Chinese / Japanese / Korean (CJK): ~2 chars per token
 *  - Russian / Cyrillic: ~3 chars per token
 */

const CJK_RANGE = /[\u4e00-\u9fff\u3400-\u4dbf\u3000-\u303f\uff00-\uffef]/g;
const CYRILLIC_RANGE = /[\u0400-\u04ff]/g;

export function estimateTokens(text: string): number {
  if (!text) return 0;

  const cjkChars = (text.match(CJK_RANGE) || []).length;
  const cyrillicChars = (text.match(CYRILLIC_RANGE) || []).length;
  const otherChars = text.length - cjkChars - cyrillicChars;

  const tokens = cjkChars / 2 + cyrillicChars / 3 + otherChars / 4;

  return Math.ceil(tokens);
}

export function formatTokenCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`;
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}k`;
  }
  return String(count);
}
