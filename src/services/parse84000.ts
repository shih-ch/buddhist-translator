import type { GlossaryTerm } from '@/types/glossary'

export interface Raw84000Entry {
  tibetan: string
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

  // Detect if first key contains Tibetan Unicode (bo file vs wy file)
  const firstLine = lines.find((l) => l.indexOf('\t') !== -1)
  const firstKey = firstLine ? firstLine.slice(0, firstLine.indexOf('\t')).trim() : ''
  const isTibetanFile = /[\u0F00-\u0FFF]/.test(firstKey)

  for (const line of lines) {
    const tabIdx = line.indexOf('\t')
    if (tabIdx === -1) continue

    const key = line.slice(0, tabIdx).trim()
    const meta = line.slice(tabIdx + 1).trim()

    const fields: Record<string, string> = {}
    for (const part of meta.split(' / ')) {
      const colonIdx = part.indexOf(': ')
      if (colonIdx === -1) continue
      const k = part.slice(0, colonIdx).trim()
      const value = part.slice(colonIdx + 2).trim()
      fields[k] = value
    }

    entries.push({
      tibetan: isTibetanFile ? key : '',
      wylie: isTibetanFile ? '' : key,
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

export interface MergedUpdate {
  id: string
  updates: Partial<GlossaryTerm>
}

export function toGlossaryTerms(
  entries: Raw84000Entry[],
  existingTermMap: Map<string, GlossaryTerm>,
): { terms: GlossaryTerm[]; merged: MergedUpdate[]; skipped: number } {
  const terms: GlossaryTerm[] = []
  const merged: MergedUpdate[] = []
  let skipped = 0
  const now = new Date().toISOString()
  const seenOriginals = new Set<string>()

  for (const entry of entries) {
    const original = entry.translated[0] || ''
    if (!original) continue

    const key = original.toLowerCase()

    // Already processed in this batch
    if (seenOriginals.has(key)) {
      skipped++
      continue
    }
    seenOriginals.add(key)

    const existing = existingTermMap.get(key)
    if (existing) {
      // Merge: fill in missing tibetan/wylie fields
      const updates: Partial<GlossaryTerm> = {}
      if (entry.tibetan && !existing.tibetan) updates.tibetan = entry.tibetan
      if (entry.wylie && !existing.wylie) updates.wylie = entry.wylie
      if (entry.definition && !existing.definition) updates.definition = entry.definition
      if (entry.link && !existing.link) updates.link = entry.link
      if (entry.sanskrit.length > 0 && !existing.sanskrit) {
        updates.sanskrit = entry.sanskrit.join('; ')
      }

      if (Object.keys(updates).length > 0) {
        merged.push({ id: existing.id, updates })
      } else {
        skipped++
      }
      continue
    }

    terms.push({
      id: crypto.randomUUID(),
      original,
      translation: entry.chinese,
      sanskrit: entry.sanskrit.join('; '),
      language: 'tibetan',
      category: TYPE_TO_CATEGORY[entry.type] || 'concept',
      notes: '',
      added_at: now,
      source_article: entry.link || '84000',
      tibetan: entry.tibetan || '',
      wylie: entry.wylie || '',
      definition: entry.definition,
      link: entry.link || '',
    })
  }

  return { terms, merged, skipped }
}
