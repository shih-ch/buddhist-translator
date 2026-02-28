import type { GlossaryTerm } from '@/types/glossary'

export interface Raw84000Entry {
  wylie: string
  type: string
  translated: string[]
  sanskrit: string[]
  chinese: string
  definition: string
  link: string
}

const TYPE_TO_CATEGORY: Record<string, GlossaryTerm['category']> = {
  'eft:term': 'concept',
  'eft:person': 'person',
  'eft:place': 'place',
  'eft:text': 'text',
}

export function parse84000Txt(text: string): Raw84000Entry[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  const entries: Raw84000Entry[] = []

  for (const line of lines) {
    const tabIdx = line.indexOf('\t')
    if (tabIdx === -1) continue

    const wylie = line.slice(0, tabIdx).trim()
    const meta = line.slice(tabIdx + 1).trim()

    const fields: Record<string, string> = {}
    for (const part of meta.split(' / ')) {
      const colonIdx = part.indexOf(': ')
      if (colonIdx === -1) continue
      const key = part.slice(0, colonIdx).trim()
      const value = part.slice(colonIdx + 2).trim()
      fields[key] = value
    }

    entries.push({
      wylie,
      type: fields['Type'] || '',
      translated: (fields['Translated'] || '').split('; ').filter(Boolean),
      sanskrit: (fields['Sanskrit'] || '').split('; ').filter(Boolean),
      chinese: fields['Chinese'] || '',
      definition: fields['Definition'] || '',
      link: fields['Link'] || '',
    })
  }

  return entries
}

export function toGlossaryTerms(
  entries: Raw84000Entry[],
  existingOriginals: Set<string>,
): { terms: GlossaryTerm[]; skipped: number } {
  const terms: GlossaryTerm[] = []
  let skipped = 0
  const now = new Date().toISOString()

  for (const entry of entries) {
    const original = entry.translated[0] || ''
    if (!original) continue

    if (existingOriginals.has(original.toLowerCase())) {
      skipped++
      continue
    }
    existingOriginals.add(original.toLowerCase())

    const notesParts: string[] = []
    if (entry.definition) {
      notesParts.push(entry.definition.slice(0, 200))
    }
    notesParts.push(`Wylie: ${entry.wylie}`)

    terms.push({
      id: crypto.randomUUID(),
      original,
      translation: entry.chinese,
      sanskrit: entry.sanskrit[0] || '',
      language: 'tibetan',
      category: TYPE_TO_CATEGORY[entry.type] || 'concept',
      notes: notesParts.join('\n'),
      added_at: now,
      source_article: '84000',
    })
  }

  return { terms, skipped }
}
