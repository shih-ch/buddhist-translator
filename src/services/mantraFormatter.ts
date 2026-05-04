import { useAIFunctionsStore } from '@/stores/aiFunctionsStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { trackedCallFunction } from '@/services/ai/trackedCall'
import type { AIMessage } from '@/services/ai/types'
import type { AIProviderId } from '@/types/settings'
import type { Mantra, MantraRow, ExtractMantraResponse } from '@/types/mantra'

export interface ModelOverride {
  provider: AIProviderId
  model: string
}

const FENCE_RE = /^```mantra\s*\n([\s\S]*?)\n```$/gm
const SECTION_HEADING = '## 真言整理'

export function isPhoneticAnnotationLabel(label: string): boolean {
  return /音譯/.test(label)
}

export function normalizeFullWidthParens(s: string): string {
  return s.replace(/（/g, '(').replace(/）/g, ')')
}

export function parsePhoneticParens(text: string): Array<{ kind: 'main' | 'note'; text: string }> {
  const normalized = normalizeFullWidthParens(text)
  const result: Array<{ kind: 'main' | 'note'; text: string }> = []
  const re = /\(([^()]*)\)/g
  let lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(normalized)) !== null) {
    if (m.index > lastIndex) {
      result.push({ kind: 'main', text: normalized.slice(lastIndex, m.index) })
    }
    result.push({ kind: 'note', text: m[1] })
    lastIndex = m.index + m[0].length
  }
  if (lastIndex < normalized.length) {
    result.push({ kind: 'main', text: normalized.slice(lastIndex) })
  }
  return result
}

// ─── Serialization (native markdown) ───

function escapeMdCell(s: string): string {
  return s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
}

export function serializeMantra(mantra: Mantra): string {
  const lines: string[] = []
  if (mantra.title.trim()) {
    lines.push(`### ${mantra.title.trim()}`)
    lines.push('')
  }

  if (mantra.rows.length > 0 && mantra.segments.length > 0) {
    const numSeg = mantra.segments.length
    const allRows = mantra.rows.map((row) => [
      escapeMdCell(row.label),
      ...mantra.segments.map((seg) => escapeMdCell(seg[row.label] ?? '')),
    ])
    // Markdown requires a header row. Use the first row as header — visually
    // first-row-as-header is acceptable (悉曇/天城體 etc. usually goes first).
    lines.push(`| ${allRows[0].join(' | ')} |`)
    const sep = [':-', ...Array.from({ length: numSeg }, () => ':-:')]
    lines.push(`| ${sep.join(' | ')} |`)
    for (let i = 1; i < allRows.length; i++) {
      lines.push(`| ${allRows[i].join(' | ')} |`)
    }
    lines.push('')
  }

  if (mantra.summary.trim()) {
    for (const line of mantra.summary.trim().split('\n')) {
      lines.push(`> ${line}`)
    }
    lines.push('')
  }

  if (mantra.notes && mantra.notes.trim()) {
    lines.push(mantra.notes.trim())
    lines.push('')
  }

  return lines.join('\n').trimEnd()
}

export function serializeMantras(mantras: Mantra[]): string {
  if (mantras.length === 0) return ''
  // Separate multiple mantras with a horizontal rule so each is visually
  // distinct on GitHub / preview / Notion.
  return mantras.map((m) => serializeMantra(m)).join('\n\n---\n\n')
}

// ─── Parsing (native markdown + fence fallback) ───

/** Parse contiguous markdown table lines starting at index. Returns parsed
 *  data rows (separator row excluded) and how many lines were consumed. */
function parseMarkdownTable(
  lines: string[],
  startIdx: number
): { rows: string[][]; consumed: number } | null {
  const tableLines: string[] = []
  let i = startIdx
  while (
    i < lines.length &&
    lines[i].trim().startsWith('|') &&
    lines[i].trim().endsWith('|')
  ) {
    tableLines.push(lines[i])
    i++
  }
  if (tableLines.length < 2) return null

  const rows = tableLines
    .filter((l) => !/^\|\s*[-:]+\s*(\|\s*[-:]+\s*)*\|$/.test(l.trim()))
    .map((line) =>
      line
        .trim()
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim().replace(/\\\|/g, '|'))
    )

  return { rows, consumed: i - startIdx }
}

function parseMantraGroup(
  lines: string[],
  startIdx: number
): { mantra: Mantra; consumed: number } | null {
  const titleMatch = lines[startIdx].match(/^###\s+(.*)$/)
  if (!titleMatch) return null
  const title = titleMatch[1].trim()

  let i = startIdx + 1
  while (i < lines.length && lines[i].trim() === '') i++

  const rows: MantraRow[] = []
  let segments: Array<Record<string, string>> = []

  if (i < lines.length && lines[i].trim().startsWith('|')) {
    const table = parseMarkdownTable(lines, i)
    if (table && table.rows.length > 0) {
      i += table.consumed
      const numCols = table.rows[0].length
      const numSegments = Math.max(numCols - 1, 0)
      segments = Array.from({ length: numSegments }, () => ({}))
      for (const row of table.rows) {
        const label = (row[0] ?? '').trim()
        if (!label) continue
        rows.push({ label })
        for (let s = 0; s < numSegments; s++) {
          segments[s][label] = (row[s + 1] ?? '').trim()
        }
      }
    }
  }

  while (i < lines.length && lines[i].trim() === '') i++

  let summary = ''
  if (i < lines.length && lines[i].startsWith('> ')) {
    const quoteLines: string[] = []
    while (i < lines.length && lines[i].startsWith('> ')) {
      quoteLines.push(lines[i].slice(2))
      i++
    }
    summary = quoteLines.join('\n').trim()
  }

  while (i < lines.length && lines[i].trim() === '') i++

  const notesLines: string[] = []
  while (
    i < lines.length &&
    !lines[i].startsWith('### ') &&
    !lines[i].startsWith('## ') &&
    lines[i].trim() !== '---'  // standalone divider = next mantra boundary
  ) {
    if (lines[i].trim() === '') {
      if (notesLines.length > 0) break
      i++
      continue
    }
    notesLines.push(lines[i])
    i++
  }
  const notes = notesLines.join('\n').trim()

  return {
    mantra: { title, rows, segments, summary, notes },
    consumed: i - startIdx,
  }
}

export function parseMantraFence(fenceContent: string): Mantra | null {
  try {
    const parsed = JSON.parse(fenceContent) as Mantra
    if (
      typeof parsed.title === 'string' &&
      Array.isArray(parsed.rows) &&
      Array.isArray(parsed.segments) &&
      typeof parsed.summary === 'string'
    ) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

function extractMantrasFromFences(md: string): Mantra[] {
  const result: Mantra[] = []
  FENCE_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = FENCE_RE.exec(md)) !== null) {
    const mantra = parseMantraFence(m[1])
    if (mantra) result.push(mantra)
  }
  return result
}

export function extractMantrasFromMarkdown(md: string): Mantra[] {
  const result: Mantra[] = []
  const section = findMantraSection(md)
  if (section) {
    const sectionContent = md.slice(section.start + SECTION_HEADING.length, section.end)
    const lines = sectionContent.split('\n')
    let i = 0
    while (i < lines.length) {
      if (lines[i].startsWith('### ')) {
        const parsed = parseMantraGroup(lines, i)
        if (parsed) {
          result.push(parsed.mantra)
          i += Math.max(parsed.consumed, 1)
          continue
        }
      }
      i++
    }
  }
  // Backward-compat: only fall back to legacy ```mantra fences if no native
  // markdown mantras were found (avoid double-counting in mixed-format files).
  if (result.length === 0) {
    return extractMantrasFromFences(md)
  }
  return result
}

export function findMantraSection(md: string): { start: number; end: number } | null {
  const headingIdx = md.indexOf(SECTION_HEADING)
  if (headingIdx === -1) return null
  const after = md.slice(headingIdx + SECTION_HEADING.length)

  // Section ends at whichever comes first:
  // - next non-mantra h2 heading
  // - a --- separator that precedes <details> or an image (the appended
  //   sections from assembleMarkdown). Plain --- between mantras inside
  //   the section is NOT an end marker.
  // - EOF
  const candidates: number[] = []

  const nextH2 = after.match(/\n## (?!真言整理)/)
  if (nextH2 && nextH2.index !== undefined) candidates.push(nextH2.index)

  const appendedBoundary = after.match(/\n---\s*\n+(?:<details>|!\[)/)
  if (appendedBoundary && appendedBoundary.index !== undefined) candidates.push(appendedBoundary.index)

  const sectionEnd = candidates.length > 0
    ? headingIdx + SECTION_HEADING.length + Math.min(...candidates)
    : md.length

  return { start: headingIdx, end: sectionEnd }
}

/**
 * Find the boundary where appended content (images, original-text <details>)
 * begins. Mantra section is inserted before this boundary so it stays within
 * the article body instead of after the original-text fold.
 */
function findContentEnd(md: string): number {
  const detailsMatch = md.match(/\n---\s*\n+<details>/)
  if (detailsMatch && detailsMatch.index !== undefined) return detailsMatch.index
  const imagesMatch = md.match(/\n---\s*\n+!\[/)
  if (imagesMatch && imagesMatch.index !== undefined) return imagesMatch.index
  return md.length
}

export function insertMantrasIntoMarkdown(
  md: string,
  mantras: Mantra[],
  mode: 'append' | 'replace'
): string {
  const block = `${SECTION_HEADING}\n\n${serializeMantras(mantras)}`
  const section = findMantraSection(md)

  if (section && mode === 'replace') {
    const before = md.slice(0, section.start).replace(/\s+$/, '')
    const after = md.slice(section.end)
    return before + '\n\n' + block + (after.startsWith('\n') ? '' : '\n') + after
  }

  if (section && mode === 'append') {
    const before = md.slice(0, section.end).replace(/\s+$/, '')
    const after = md.slice(section.end)
    return before + '\n\n' + serializeMantras(mantras) + (after.startsWith('\n') ? '' : '\n') + after
  }

  // No existing section — insert before the appended content boundary
  // (original-text <details> or images), or append to end if neither.
  const contentEnd = findContentEnd(md)
  const before = md.slice(0, contentEnd).replace(/\s+$/, '')
  const after = md.slice(contentEnd)
  if (after.length === 0) {
    return before + '\n\n' + block + '\n'
  }
  return before + '\n\n' + block + '\n' + after
}

// ─── AI helpers ───

function extractJsonFromResponse(text: string): string {
  let t = text.trim()
  const codeBlock = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlock) t = codeBlock[1].trim()
  return t
}

export async function extractMantras(
  sourceText: string,
  override?: ModelOverride
): Promise<Mantra[]> {
  const fnConfig = useAIFunctionsStore.getState().getFunctionConfig('extract_mantra')
  const apiKeys = useSettingsStore.getState().apiKeys

  const provider = override?.provider ?? fnConfig.provider
  const model = override?.model ?? fnConfig.model

  const messages: AIMessage[] = [
    { role: 'system', content: fnConfig.prompt },
    { role: 'user', content: sourceText },
  ]

  const response = await trackedCallFunction(
    fnConfig,
    apiKeys,
    messages,
    { overrideProvider: provider, overrideModel: model },
    'extract_mantra'
  )

  const text = extractJsonFromResponse(response.content)
  const parsed = JSON.parse(text) as ExtractMantraResponse
  return parsed.mantras ?? []
}

export async function formatMantra(
  mantra: Mantra,
  override?: ModelOverride
): Promise<Mantra> {
  const fnConfig = useAIFunctionsStore.getState().getFunctionConfig('format_mantra')
  const apiKeys = useSettingsStore.getState().apiKeys

  const provider = override?.provider ?? fnConfig.provider
  const model = override?.model ?? fnConfig.model

  const messages: AIMessage[] = [
    { role: 'system', content: fnConfig.prompt },
    { role: 'user', content: JSON.stringify(mantra, null, 2) },
  ]

  const response = await trackedCallFunction(
    fnConfig,
    apiKeys,
    messages,
    { overrideProvider: provider, overrideModel: model },
    'format_mantra'
  )

  const text = extractJsonFromResponse(response.content)
  return JSON.parse(text) as Mantra
}

export function emptyMantra(): Mantra {
  return {
    title: '',
    rows: [
      { label: '悉曇' },
      { label: '中文音譯' },
      { label: 'IAST' },
      { label: '字義' },
    ],
    segments: [],
    summary: '',
    notes: '',
  }
}
