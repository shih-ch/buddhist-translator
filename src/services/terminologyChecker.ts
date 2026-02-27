import type { GlossaryTerm } from '@/types/glossary'

export interface ConsistencyIssue {
  term: string
  expected: string
  found: string[]
  line: number
}

/**
 * Check if translated text uses glossary terms consistently.
 * Finds glossary originals in source text, then verifies their
 * expected translations appear in the target text nearby.
 */
export function checkConsistency(
  originalText: string,
  translatedText: string,
  glossaryTerms: GlossaryTerm[]
): ConsistencyIssue[] {
  if (!originalText || !translatedText || glossaryTerms.length === 0) return []

  const issues: ConsistencyIssue[] = []
  const transLines = translatedText.split('\n')

  for (const term of glossaryTerms) {
    if (!term.original || !term.translation) continue

    // Check if the original term appears in source text
    const origLower = originalText.toLowerCase()
    const termLower = term.original.toLowerCase()

    // Also check sanskrit field
    const hasOriginal =
      origLower.includes(termLower) ||
      (term.sanskrit && origLower.includes(term.sanskrit.toLowerCase()))

    if (!hasOriginal) continue

    // Check if the expected translation appears in translated text
    const transLower = translatedText.toLowerCase()
    const expectedLower = term.translation.toLowerCase()

    if (transLower.includes(expectedLower)) continue

    // The expected translation is NOT found — this is a mismatch
    // Try to find what was used instead (look for partial matches)
    const found: string[] = []
    for (let i = 0; i < transLines.length; i++) {
      const line = transLines[i]
      // Look for the original term transcribed or partially translated
      if (
        line.toLowerCase().includes(termLower) ||
        (term.sanskrit && line.toLowerCase().includes(term.sanskrit.toLowerCase()))
      ) {
        found.push(`第${i + 1}行`)
      }
    }

    issues.push({
      term: term.original,
      expected: term.translation,
      found: found.length > 0 ? found : ['（未找到對應翻譯）'],
      line: 0, // general issue
    })
  }

  return issues
}
