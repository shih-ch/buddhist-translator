import { useAIFunctionsStore } from '@/stores/aiFunctionsStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { trackedCallFunction } from '@/services/ai/trackedCall'
import type { AIMessage } from '@/services/ai/types'
import type { Mantra, ExtractMantraResponse } from '@/types/mantra'

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

export function serializeMantra(mantra: Mantra): string {
  const json = JSON.stringify(mantra, null, 2)
  return '```mantra\n' + json + '\n```'
}

export function serializeMantras(mantras: Mantra[]): string {
  if (mantras.length === 0) return ''
  return mantras.map((m) => serializeMantra(m)).join('\n\n')
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

export function extractMantrasFromMarkdown(md: string): Mantra[] {
  const result: Mantra[] = []
  FENCE_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = FENCE_RE.exec(md)) !== null) {
    const mantra = parseMantraFence(m[1])
    if (mantra) result.push(mantra)
  }
  return result
}

export function findMantraSection(md: string): { start: number; end: number } | null {
  const headingIdx = md.indexOf(SECTION_HEADING)
  if (headingIdx === -1) return null
  const after = md.slice(headingIdx + SECTION_HEADING.length)
  const nextHeadingMatch = after.match(/\n## (?!真言整理)/)
  const sectionEnd = nextHeadingMatch
    ? headingIdx + SECTION_HEADING.length + (nextHeadingMatch.index ?? 0)
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

function extractJsonFromResponse(text: string): string {
  let t = text.trim()
  const codeBlock = t.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlock) t = codeBlock[1].trim()
  return t
}

export async function extractMantras(sourceText: string): Promise<Mantra[]> {
  const fnConfig = useAIFunctionsStore.getState().getFunctionConfig('extract_mantra')
  const apiKeys = useSettingsStore.getState().apiKeys

  const messages: AIMessage[] = [
    { role: 'system', content: fnConfig.prompt },
    { role: 'user', content: sourceText },
  ]

  const response = await trackedCallFunction(
    fnConfig,
    apiKeys,
    messages,
    { overrideProvider: fnConfig.provider, overrideModel: fnConfig.model },
    'extract_mantra'
  )

  const text = extractJsonFromResponse(response.content)
  const parsed = JSON.parse(text) as ExtractMantraResponse
  return parsed.mantras ?? []
}

export async function formatMantra(mantra: Mantra): Promise<Mantra> {
  const fnConfig = useAIFunctionsStore.getState().getFunctionConfig('format_mantra')
  const apiKeys = useSettingsStore.getState().apiKeys

  const messages: AIMessage[] = [
    { role: 'system', content: fnConfig.prompt },
    { role: 'user', content: JSON.stringify(mantra, null, 2) },
  ]

  const response = await trackedCallFunction(
    fnConfig,
    apiKeys,
    messages,
    { overrideProvider: fnConfig.provider, overrideModel: fnConfig.model },
    'format_mantra'
  )

  const text = extractJsonFromResponse(response.content)
  return JSON.parse(text) as Mantra
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderPhoneticCellHtml(text: string): string {
  if (!/[()（）]/.test(text)) return escapeHtml(text)
  const parts = parsePhoneticParens(text)
  return parts
    .map((p) =>
      p.kind === 'note'
        ? `<sub class="mantra-note">${escapeHtml(p.text)}</sub>`
        : escapeHtml(p.text)
    )
    .join('')
}

export function mantraToHtml(mantra: Mantra): string {
  const titleHtml = mantra.title.trim()
    ? `<h3 class="mantra-title">${escapeHtml(mantra.title)}</h3>`
    : ''

  let tableHtml = ''
  if (mantra.rows.length > 0 && mantra.segments.length > 0) {
    const rowsHtml = mantra.rows
      .map((row) => {
        const isPhonetic = isPhoneticAnnotationLabel(row.label)
        const cellsHtml = mantra.segments
          .map((seg) => {
            const cellText = seg[row.label] ?? ''
            const inner = isPhonetic
              ? renderPhoneticCellHtml(cellText)
              : escapeHtml(cellText)
            return `<td>${inner || '&nbsp;'}</td>`
          })
          .join('')
        return `<tr>${cellsHtml}</tr>`
      })
      .join('')
    tableHtml = `<table class="mantra-table"><tbody>${rowsHtml}</tbody></table>`
  }

  const summaryHtml = mantra.summary.trim()
    ? `<blockquote class="mantra-summary">${escapeHtml(mantra.summary)}</blockquote>`
    : ''

  const notesHtml = mantra.notes && mantra.notes.trim()
    ? `<p class="mantra-notes">${escapeHtml(mantra.notes)}</p>`
    : ''

  return `<section class="mantra-block">${titleHtml}${tableHtml}${summaryHtml}${notesHtml}</section>`
}

export function preprocessMantraFences(md: string): string {
  return md.replace(FENCE_RE, (full, body: string) => {
    const mantra = parseMantraFence(body)
    if (!mantra) return full
    return '\n\n' + mantraToHtml(mantra) + '\n\n'
  })
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
