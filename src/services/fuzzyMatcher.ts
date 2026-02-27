import type { TMEntry } from '@/stores/translationMemoryStore'

/**
 * Compute Levenshtein distance between two strings.
 * Uses optimized single-row approach.
 */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  // Use shorter string as column for memory efficiency
  if (a.length > b.length) [a, b] = [b, a]

  const aLen = a.length
  const bLen = b.length
  const row = new Array<number>(aLen + 1)

  for (let i = 0; i <= aLen; i++) row[i] = i

  for (let j = 1; j <= bLen; j++) {
    let prev = row[0]
    row[0] = j
    for (let i = 1; i <= aLen; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      const temp = row[i]
      row[i] = Math.min(
        row[i] + 1,      // deletion
        row[i - 1] + 1,  // insertion
        prev + cost       // substitution
      )
      prev = temp
    }
  }

  return row[aLen]
}

/**
 * Compute similarity between two strings (0 = different, 1 = identical).
 */
export function similarity(a: string, b: string): number {
  // For very long strings, compare just first 500 chars for performance
  const sa = a.slice(0, 500)
  const sb = b.slice(0, 500)
  const maxLen = Math.max(sa.length, sb.length)
  if (maxLen === 0) return 1
  return 1 - levenshtein(sa, sb) / maxLen
}

export interface TMMatch {
  entry: TMEntry
  score: number
}

/**
 * Find similar entries in translation memory.
 */
export function findSimilar(
  input: string,
  entries: TMEntry[],
  threshold = 0.6
): TMMatch[] {
  if (!input.trim() || entries.length === 0) return []

  const matches: TMMatch[] = []
  for (const entry of entries) {
    const score = similarity(input, entry.source)
    if (score >= threshold) {
      matches.push({ entry, score })
    }
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, 5)
}
