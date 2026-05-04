import { useSettingsStore } from '@/stores/settingsStore'
import type { ArticleFrontmatter } from '@/types/article'
import type { Mantra } from '@/types/mantra'
import {
  isPhoneticAnnotationLabel,
  parsePhoneticParens,
  extractMantrasFromMarkdown,
  splitSegmentsByBreaks,
} from '@/services/mantraFormatter'
import { toast } from 'sonner'

// ─── Types ───

interface NotionRichText {
  type: 'text'
  text: { content: string; link?: { url: string } | null }
  annotations?: {
    bold?: boolean
    italic?: boolean
    strikethrough?: boolean
    code?: boolean
  }
}

interface NotionBlock {
  object: 'block'
  type: string
  [key: string]: unknown
}

interface BatchProgress {
  current: number
  total: number
  title: string
  status: 'exporting' | 'skipped' | 'success' | 'error'
  error?: string
}

export type BindResult =
  | { articleTitle: string; articlePath: string; status: 'bound'; pageUrl: string }
  | { articleTitle: string; articlePath: string; status: 'already_set'; pageUrl: string }
  | { articleTitle: string; articlePath: string; status: 'mismatch'; notionPath: string; pageUrl: string }
  | { articleTitle: string; articlePath: string; status: 'no_match' }
  | { articleTitle: string; articlePath: string; status: 'error'; error: string }

// ─── Rate Limiter (3 req/sec) ───

let lastRequestTime = 0

async function rateLimit(): Promise<void> {
  const now = Date.now()
  const elapsed = now - lastRequestTime
  const wait = Math.max(334 - elapsed, 0)
  await new Promise((r) => setTimeout(r, wait))
  lastRequestTime = Date.now()
}

// ─── Rich Text Parser ───

const RICH_TEXT_LIMIT = 2000

function parseInlineMarkdown(text: string): NotionRichText[] {
  const result: NotionRichText[] = []

  // Fast path: no formatting characters → plain text
  if (!/[*`~\[]/.test(text)) {
    pushTextChunks(result, text, {})
    if (result.length === 0) result.push({ type: 'text', text: { content: '' } })
    return result
  }

  // Use non-backtracking patterns with [^] character classes instead of .+?
  const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|~~([^~]+)~~|\[([^\]]+)\]\(([^)]+)\))/g
  let lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      pushTextChunks(result, text.slice(lastIndex, match.index), {})
    }

    if (match[2]) {
      pushTextChunks(result, match[2], { bold: true })
    } else if (match[3]) {
      pushTextChunks(result, match[3], { italic: true })
    } else if (match[4]) {
      pushTextChunks(result, match[4], { code: true })
    } else if (match[5]) {
      pushTextChunks(result, match[5], { strikethrough: true })
    } else if (match[6] && match[7]) {
      pushTextChunks(result, match[6], {}, match[7])
    }

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    pushTextChunks(result, text.slice(lastIndex), {})
  }

  if (result.length === 0) result.push({ type: 'text', text: { content: '' } })
  return result
}

function pushTextChunks(
  result: NotionRichText[],
  content: string,
  annotations: NotionRichText['annotations'],
  link?: string
) {
  // Split into chunks of RICH_TEXT_LIMIT
  for (let i = 0; i < content.length; i += RICH_TEXT_LIMIT) {
    const chunk = content.slice(i, i + RICH_TEXT_LIMIT)
    const rt: NotionRichText = {
      type: 'text',
      text: { content: chunk, link: link ? { url: link } : null },
    }
    if (annotations && Object.values(annotations).some(Boolean)) {
      rt.annotations = annotations
    }
    result.push(rt)
  }
}

// ─── Mantra → Notion Blocks ───

function mantraCellRichText(text: string, isPhoneticRow: boolean): NotionRichText[] {
  if (!isPhoneticRow || !/[()（）]/.test(text)) {
    return [{ type: 'text', text: { content: text } }]
  }
  const parts = parsePhoneticParens(text)
  const result: NotionRichText[] = []
  for (const p of parts) {
    if (p.text.length === 0) continue
    if (p.kind === 'note') {
      result.push({
        type: 'text',
        text: { content: `(${p.text})` },
        annotations: { italic: true },
      })
    } else {
      result.push({ type: 'text', text: { content: p.text } })
    }
  }
  if (result.length === 0) result.push({ type: 'text', text: { content: '' } })
  return result
}

function mantraToBlocks(mantra: Mantra): NotionBlock[] {
  const blocks: NotionBlock[] = []

  if (mantra.title.trim()) {
    blocks.push({
      object: 'block',
      type: 'heading_3',
      heading_3: { rich_text: parseInlineMarkdown(mantra.title) },
    })
  }

  if (mantra.rows.length > 0 && mantra.segments.length > 0) {
    const sections = splitSegmentsByBreaks(mantra)
    for (const sectionSegments of sections) {
      const tableRows: NotionBlock[] = mantra.rows.map((row) => {
        const isPhonetic = isPhoneticAnnotationLabel(row.label)
        const cells: NotionRichText[][] = sectionSegments.map((seg) => {
          const cellText = seg[row.label] ?? ''
          return mantraCellRichText(cellText, isPhonetic)
        })
        return {
          object: 'block',
          type: 'table_row',
          table_row: { cells },
        }
      })
      blocks.push({
        object: 'block',
        type: 'table',
        table: {
          table_width: sectionSegments.length,
          has_column_header: false,
          has_row_header: false,
          children: tableRows,
        },
      })
    }
  }

  if (mantra.summary.trim()) {
    blocks.push({
      object: 'block',
      type: 'quote',
      quote: { rich_text: parseInlineMarkdown(mantra.summary) },
    })
  }

  if (mantra.notes && mantra.notes.trim()) {
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: parseInlineMarkdown(mantra.notes) },
    })
  }

  return blocks
}

// ─── Markdown → Notion Blocks ───

/** Count consecutive indented lines starting at `start` (≥2 spaces or tab) */
function countIndentedLines(lines: string[], start: number): number {
  let count = 0
  while (start + count < lines.length && /^[ \t]{2,}\S/.test(lines[start + count])) {
    count++
  }
  return count
}

/** Parse indented lines as nested list children (strip leading indent, recurse) */
function collectIndentedChildren(lines: string[], start: number): NotionBlock[] {
  const count = countIndentedLines(lines, start)
  if (count === 0) return []

  const children: NotionBlock[] = []
  for (let j = 0; j < count; j++) {
    const raw = lines[start + j].replace(/^[ \t]{2,}/, '')

    const numMatch = raw.match(/^\d+\.\s+(.*)/)
    if (numMatch) {
      children.push({
        object: 'block',
        type: 'numbered_list_item',
        numbered_list_item: { rich_text: parseInlineMarkdown(numMatch[1]) },
      })
      continue
    }

    if (/^[-*]\s+/.test(raw)) {
      const text = raw.replace(/^[-*]\s+/, '')
      children.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: parseInlineMarkdown(text) },
      })
      continue
    }

    // Fallback: treat as paragraph
    children.push({
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: parseInlineMarkdown(raw) },
    })
  }
  return children
}

export function markdownToBlocks(md: string): NotionBlock[] {
  const blocks: NotionBlock[] = []
  const lines = md.split('\n')
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Blank line
    if (line.trim() === '') {
      i++
      continue
    }

    // Special: ## 真言整理 section → emit heading_2 + structured mantra blocks
    // (preserves the no-row-label table layout regardless of how the mantras
    // are stored in markdown — native md tables or legacy ```mantra fences)
    if (line.trim() === '## 真言整理') {
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: { rich_text: parseInlineMarkdown('真言整理') },
      })
      // Slurp section content until next ## heading or EOF
      let j = i + 1
      while (j < lines.length && !/^##\s+(?!真言整理)/.test(lines[j])) {
        j++
      }
      const sectionMd = '## 真言整理\n' + lines.slice(i + 1, j).join('\n')
      const mantras = extractMantrasFromMarkdown(sectionMd)
      for (const mantra of mantras) {
        for (const b of mantraToBlocks(mantra)) blocks.push(b)
      }
      i = j
      continue
    }

    // Code block
    if (line.trimStart().startsWith('```')) {
      const lang = line.trim().slice(3).trim() || 'plain text'
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++ // skip closing ```
      const codeText = codeLines.join('\n')

      // Split code into 2000-char chunks
      const richTexts: NotionRichText[] = []
      for (let j = 0; j < codeText.length; j += RICH_TEXT_LIMIT) {
        richTexts.push({ type: 'text', text: { content: codeText.slice(j, j + RICH_TEXT_LIMIT) } })
      }
      if (richTexts.length === 0) {
        richTexts.push({ type: 'text', text: { content: '' } })
      }
      blocks.push({
        object: 'block',
        type: 'code',
        code: { rich_text: richTexts, language: lang },
      })
      continue
    }

    // <details>/<summary> → toggle
    if (line.trim().startsWith('<details>')) {
      let summary = ''
      const toggleContent: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith('</details>')) {
        const l = lines[i]
        const sumMatch = l.match(/<summary>(.*?)<\/summary>/)
        if (sumMatch) {
          summary = sumMatch[1]
        } else {
          toggleContent.push(l)
        }
        i++
      }
      i++ // skip </details>
      const childBlocks = markdownToBlocks(toggleContent.join('\n'))
      // Notion limits children to 100 per block; store overflow for post-creation append
      const first100 = childBlocks.slice(0, 100)
      const overflow = childBlocks.slice(100)
      const toggleBlock: NotionBlock = {
        object: 'block',
        type: 'toggle',
        toggle: {
          rich_text: parseInlineMarkdown(summary),
          children: first100.length > 0 ? first100 : undefined,
        },
      }
      if (overflow.length > 0) {
        // Tag for post-creation processing
        ;(toggleBlock as Record<string, unknown>)._overflow = overflow
      }
      blocks.push(toggleBlock)
      continue
    }

    // Table (| ... | ... |)
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i])
        i++
      }
      // Filter out separator row (|---|---|)
      const dataRows = tableLines.filter((l) => !/^\|\s*[-:]+\s*(\|\s*[-:]+\s*)*\|$/.test(l.trim()))
      if (dataRows.length > 0) {
        const parsedRows = dataRows.map((row) =>
          row.split('|').slice(1, -1).map((cell) => cell.trim())
        )
        const width = parsedRows[0].length
        const tableRows = parsedRows.map((cells) => ({
          object: 'block' as const,
          type: 'table_row',
          table_row: {
            cells: cells.map((cell) => parseInlineMarkdown(cell)),
          },
        }))
        blocks.push({
          object: 'block',
          type: 'table',
          table: {
            table_width: width,
            has_column_header: true,
            children: tableRows,
          },
        })
      }
      continue
    }

    // Headings
    const h3 = line.match(/^###\s+(.*)/)
    if (h3) {
      blocks.push({
        object: 'block',
        type: 'heading_3',
        heading_3: { rich_text: parseInlineMarkdown(h3[1]) },
      })
      i++
      continue
    }

    const h2 = line.match(/^##\s+(.*)/)
    if (h2) {
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: { rich_text: parseInlineMarkdown(h2[1]) },
      })
      i++
      continue
    }

    const h1 = line.match(/^#\s+(.*)/)
    if (h1) {
      blocks.push({
        object: 'block',
        type: 'heading_1',
        heading_1: { rich_text: parseInlineMarkdown(h1[1]) },
      })
      i++
      continue
    }

    // Divider
    if (/^---+$/.test(line.trim())) {
      blocks.push({ object: 'block', type: 'divider', divider: {} })
      i++
      continue
    }

    // Blockquote
    if (line.startsWith('> ')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2))
        i++
      }
      blocks.push({
        object: 'block',
        type: 'quote',
        quote: { rich_text: parseInlineMarkdown(quoteLines.join('\n')) },
      })
      continue
    }

    // Image
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/)
    if (imgMatch) {
      blocks.push({
        object: 'block',
        type: 'image',
        image: {
          type: 'external',
          external: { url: imgMatch[2] },
        },
      })
      i++
      continue
    }

    // Bulleted list
    if (/^[-*]\s+/.test(line)) {
      const text = line.replace(/^[-*]\s+/, '')
      const children = collectIndentedChildren(lines, i + 1)
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: parseInlineMarkdown(text),
          ...(children.length > 0 ? { children } : {}),
        },
      } as NotionBlock)
      i = i + 1 + countIndentedLines(lines, i + 1)
      continue
    }

    // Numbered list
    const numMatch = line.match(/^\d+\.\s+(.*)/)
    if (numMatch) {
      const children = collectIndentedChildren(lines, i + 1)
      blocks.push({
        object: 'block',
        type: 'numbered_list_item',
        numbered_list_item: {
          rich_text: parseInlineMarkdown(numMatch[1]),
          ...(children.length > 0 ? { children } : {}),
        },
      } as NotionBlock)
      i = i + 1 + countIndentedLines(lines, i + 1)
      continue
    }

    // Paragraph — one block per line to avoid huge strings
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: parseInlineMarkdown(line) },
    })
    i++
  }

  return blocks
}

// ─── Notion Service ───

class NotionService {
  private dbInitialized = false
  private titlePropertyName = 'Title'

  private get token(): string {
    return useSettingsStore.getState().notionToken
  }

  private get databaseId(): string {
    return useSettingsStore.getState().notionDatabaseId
  }

  private get baseUrl(): string {
    return '/notion-api'
  }

  private async apiFetch(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    await rateLimit()
    const url = `${this.baseUrl}${endpoint}`
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> ?? {}),
    }
    const res = await fetch(url, { ...options, headers })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`Notion API ${res.status}: ${body}`)
    }
    return res
  }

  // ─── Database Setup ───

  async ensureDatabaseProperties(): Promise<string[]> {
    // Get current database schema
    const res = await this.apiFetch(`/v1/databases/${this.databaseId}`)
    const data = await res.json()
    const existing = data.properties ?? {}

    // Detect the actual title property name
    for (const [name, prop] of Object.entries(existing)) {
      if ((prop as { type: string }).type === 'title') {
        this.titlePropertyName = name
        break
      }
    }

    const existingNames = Object.keys(existing)

    const required: Record<string, Record<string, unknown>> = {
      'Author': { rich_text: {} },
      'Date': { date: {} },
      'Original Language': { select: {} },
      'Translator Model': { rich_text: {} },
      'Source': { url: {} },
      'Tags': { multi_select: {} },
      'GitHub Path': { rich_text: {} },
    }

    // Filter out properties that already exist
    const toCreate: Record<string, Record<string, unknown>> = {}
    const created: string[] = []
    for (const [name, config] of Object.entries(required)) {
      if (!existingNames.includes(name)) {
        toCreate[name] = config
        created.push(name)
      }
    }

    if (Object.keys(toCreate).length === 0) return []

    // PATCH to add missing properties
    await this.apiFetch(`/v1/databases/${this.databaseId}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties: toCreate }),
    })

    this.dbInitialized = true
    return created
  }

  private async autoInit(): Promise<void> {
    if (this.dbInitialized) return
    await this.ensureDatabaseProperties()
  }

  // ─── Bind existing page to a GitHub Path ───

  /** Parse a Notion page URL or raw ID into a normalized UUID. */
  parsePageId(input: string): string | null {
    const trimmed = input.trim()
    // Match a 32-hex-char tail (no dashes) — typical Notion URL format
    const noDash = trimmed.match(/([a-f0-9]{32})(?:[?#]|$)/i)
    if (noDash) {
      const id = noDash[1].toLowerCase()
      return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`
    }
    // Match a UUID with dashes
    const uuid = trimmed.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i)
    if (uuid) return uuid[1].toLowerCase()
    return null
  }

  async bindPageToGitHubPath(pageInput: string, githubPath: string): Promise<{ pageId: string; url: string }> {
    const pageId = this.parsePageId(pageInput)
    if (!pageId) {
      throw new Error('無法解析 Notion 頁面 ID。請貼完整 Notion URL 或 32 位 hex ID。')
    }
    await this.autoInit()
    const res = await this.apiFetch(`/v1/pages/${pageId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        properties: {
          'GitHub Path': {
            rich_text: [{ type: 'text', text: { content: githubPath } }],
          },
        },
      }),
    })
    const data = await res.json()
    return { pageId, url: data.url ?? '' }
  }

  // ─── Batch operations ───

  async listAllPages(): Promise<Array<{ id: string; title: string; githubPath: string; url: string }>> {
    await this.autoInit()
    const pages: Array<{ id: string; title: string; githubPath: string; url: string }> = []
    let cursor: string | undefined
    do {
      const body: Record<string, unknown> = { page_size: 100 }
      if (cursor) body.start_cursor = cursor
      const res = await this.apiFetch(`/v1/databases/${this.databaseId}/query`, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      const data = await res.json()
      for (const page of data.results ?? []) {
        const titleProp = page.properties?.[this.titlePropertyName]
        const title = (titleProp?.title as Array<{ plain_text?: string }> | undefined)
          ?.map((t) => t.plain_text ?? '')
          .join('') ?? ''
        const ghProp = page.properties?.['GitHub Path']
        const githubPath = (ghProp?.rich_text as Array<{ plain_text?: string }> | undefined)
          ?.map((t) => t.plain_text ?? '')
          .join('') ?? ''
        pages.push({ id: page.id as string, title, githubPath, url: page.url as string })
      }
      cursor = data.has_more ? data.next_cursor : undefined
    } while (cursor)
    return pages
  }

  async batchBindPages(
    articles: Array<{ title: string; path: string }>,
    onProgress: (current: number, total: number) => void,
    onResult: (result: BindResult) => void
  ): Promise<void> {
    const pages = await this.listAllPages()
    const pageByTitle = new Map<string, typeof pages[0]>()
    for (const p of pages) {
      if (!pageByTitle.has(p.title)) pageByTitle.set(p.title, p)
    }

    for (let i = 0; i < articles.length; i++) {
      const article = articles[i]
      onProgress(i + 1, articles.length)
      const page = pageByTitle.get(article.title)
      if (!page) {
        onResult({ articleTitle: article.title, articlePath: article.path, status: 'no_match' })
        continue
      }
      if (page.githubPath === article.path) {
        onResult({ articleTitle: article.title, articlePath: article.path, status: 'already_set', pageUrl: page.url })
        continue
      }
      if (page.githubPath && page.githubPath !== article.path) {
        onResult({
          articleTitle: article.title,
          articlePath: article.path,
          status: 'mismatch',
          notionPath: page.githubPath,
          pageUrl: page.url,
        })
        continue
      }
      try {
        await this.apiFetch(`/v1/pages/${page.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            properties: {
              'GitHub Path': {
                rich_text: [{ type: 'text', text: { content: article.path } }],
              },
            },
          }),
        })
        onResult({ articleTitle: article.title, articlePath: article.path, status: 'bound', pageUrl: page.url })
      } catch (err) {
        onResult({
          articleTitle: article.title,
          articlePath: article.path,
          status: 'error',
          error: err instanceof Error ? err.message : 'Unknown',
        })
      }
    }
  }

  // ─── Database Query ───

  async findPageByGitHubPath(githubPath: string): Promise<string | null> {
    await this.autoInit()
    console.log('[Notion] findPageByGitHubPath query:', JSON.stringify(githubPath))
    const res = await this.apiFetch(`/v1/databases/${this.databaseId}/query`, {
      method: 'POST',
      body: JSON.stringify({
        filter: {
          property: 'GitHub Path',
          rich_text: { equals: githubPath },
        },
        page_size: 1,
      }),
    })
    const data = await res.json()
    console.log('[Notion] findPageByGitHubPath results:', data.results?.length ?? 0)
    if (data.results && data.results.length > 0) {
      console.log('[Notion] matched page id:', data.results[0].id)
      return data.results[0].id
    }
    return null
  }

  // ─── Build Properties ───

  private buildProperties(
    frontmatter: ArticleFrontmatter,
    githubPath: string
  ): Record<string, unknown> {
    const props: Record<string, unknown> = {
      [this.titlePropertyName]: {
        title: [{ type: 'text', text: { content: frontmatter.title || 'Untitled' } }],
      },
      'GitHub Path': {
        rich_text: [{ type: 'text', text: { content: githubPath } }],
      },
    }

    if (frontmatter.author) {
      props['Author'] = {
        rich_text: [{ type: 'text', text: { content: frontmatter.author } }],
      }
    }

    if (frontmatter.date) {
      props['Date'] = {
        date: { start: frontmatter.date },
      }
    }

    if (frontmatter.original_language) {
      props['Original Language'] = {
        select: { name: frontmatter.original_language },
      }
    }

    if (frontmatter.translator_model) {
      props['Translator Model'] = {
        rich_text: [{ type: 'text', text: { content: frontmatter.translator_model } }],
      }
    }

    if (frontmatter.source) {
      props['Source'] = { url: frontmatter.source || null }
    }

    if (frontmatter.tags && frontmatter.tags.length > 0) {
      props['Tags'] = {
        multi_select: frontmatter.tags.map((t) => ({ name: t })),
      }
    }

    return props
  }

  // ─── Save Translation ───

  async saveTranslation(article: {
    path: string
    frontmatter: ArticleFrontmatter
    content: string
    originalText?: string
  }): Promise<{ pageId: string; url: string }> {
    // Build full markdown body for block conversion (content + original)
    let bodyMd = article.content
    if (article.originalText?.trim()) {
      bodyMd += '\n\n---\n\n<details>\n<summary>原文 (Original)</summary>\n\n'
      bodyMd += article.originalText.trim()
      bodyMd += '\n\n</details>'
    }

    // Ensure DB is initialized (detects title property name) before building properties
    await this.autoInit()

    const allBlocks = markdownToBlocks(bodyMd)
    const properties = this.buildProperties(article.frontmatter, article.path)

    // Strip _overflow tags before sending (Notion API would reject unknown fields)
    const overflowMap: Array<{ index: number; blocks: NotionBlock[] }> = []
    for (let idx = 0; idx < allBlocks.length; idx++) {
      const block = allBlocks[idx] as Record<string, unknown>
      if (block._overflow) {
        overflowMap.push({ index: idx, blocks: block._overflow as NotionBlock[] })
        delete block._overflow
      }
    }

    // Check if page already exists
    const existingPageId = await this.findPageByGitHubPath(article.path)

    if (existingPageId) {
      // Update existing page in place: PATCH properties → delete child blocks → append new blocks.
      // Preserves page ID, URL, and Notion-side comments.
      return await this.updatePageInPlace(existingPageId, properties, allBlocks, overflowMap)
    }

    // Create new page
    const firstBatch = allBlocks.slice(0, 100)
    const remaining = allBlocks.slice(100)

    const res = await this.apiFetch('/v1/pages', {
      method: 'POST',
      body: JSON.stringify({
        parent: { database_id: this.databaseId },
        properties,
        children: firstBatch,
      }),
    })
    const data = await res.json()
    const pageId = data.id

    if (remaining.length > 0) {
      await this.appendBlocksBatched(pageId, remaining)
    }

    if (overflowMap.length > 0) {
      await this.appendToggleOverflow(pageId, overflowMap)
    }

    return { pageId, url: data.url }
  }

  // ─── Update existing page in place ───

  private async updatePageInPlace(
    pageId: string,
    properties: Record<string, unknown>,
    allBlocks: NotionBlock[],
    overflowMap: Array<{ index: number; blocks: NotionBlock[] }>
  ): Promise<{ pageId: string; url: string }> {
    const toastId = `notion-update-${pageId}`

    // 1. Update properties
    toast.loading('更新 Notion 頁面屬性...', { id: toastId })
    const pageRes = await this.apiFetch(`/v1/pages/${pageId}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties }),
    })
    const pageData = await pageRes.json()
    const pageUrl = pageData.url as string

    // 2. List existing top-level child blocks
    let existingBlocks: Array<{ id: string }> = []
    let cursor: string | undefined
    do {
      const url = `/v1/blocks/${pageId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`
      const res = await this.apiFetch(url)
      const data = await res.json()
      existingBlocks = existingBlocks.concat(data.results ?? [])
      cursor = data.has_more ? data.next_cursor : undefined
    } while (cursor)

    // 3. Delete existing blocks (one DELETE per block; rate-limited by apiFetch)
    if (existingBlocks.length > 0) {
      toast.loading(`正在刪除舊內容 0/${existingBlocks.length}...`, { id: toastId })
      let deleted = 0
      for (const b of existingBlocks) {
        try {
          await this.apiFetch(`/v1/blocks/${b.id}`, { method: 'DELETE' })
        } catch (err) {
          console.warn(`[Notion] Failed to delete block ${b.id}:`, err)
        }
        deleted++
        if (deleted % 5 === 0 || deleted === existingBlocks.length) {
          toast.loading(`正在刪除舊內容 ${deleted}/${existingBlocks.length}...`, { id: toastId })
        }
      }
    }

    // 4. Append new blocks
    toast.loading(`寫入新內容（${allBlocks.length} blocks）...`, { id: toastId })
    if (allBlocks.length > 0) {
      await this.appendBlocksBatched(pageId, allBlocks)
    }

    // 5. Toggle overflow
    if (overflowMap.length > 0) {
      await this.appendToggleOverflow(pageId, overflowMap)
    }

    toast.success('Notion 更新完成', { id: toastId })
    return { pageId, url: pageUrl }
  }

  // ─── Block Operations ───

  private async appendBlocksBatched(
    blockId: string,
    blocks: NotionBlock[]
  ): Promise<void> {
    for (let i = 0; i < blocks.length; i += 100) {
      const batch = blocks.slice(i, i + 100)
      await this.apiFetch(`/v1/blocks/${blockId}/children`, {
        method: 'PATCH',
        body: JSON.stringify({ children: batch }),
      })
    }
  }

  private async appendToggleOverflow(
    pageId: string,
    overflowMap: Array<{ index: number; blocks: NotionBlock[] }>
  ): Promise<void> {
    // Get page children to find the actual block IDs
    let allPageBlocks: Array<{ id: string }> = []
    let cursor: string | undefined
    do {
      const url = `/v1/blocks/${pageId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`
      const res = await this.apiFetch(url)
      const data = await res.json()
      allPageBlocks = allPageBlocks.concat(data.results ?? [])
      cursor = data.has_more ? data.next_cursor : undefined
    } while (cursor)

    for (const { index, blocks } of overflowMap) {
      if (index < allPageBlocks.length) {
        const toggleBlockId = allPageBlocks[index].id
        await this.appendBlocksBatched(toggleBlockId, blocks)
      }
    }
  }

  // ─── Test Connection ───

  async testConnection(): Promise<boolean> {
    if (!this.token || !this.databaseId) return false
    try {
      const res = await this.apiFetch(`/v1/databases/${this.databaseId}`)
      if (!res.ok) return false
      // Detect title property name while we have the schema
      const data = await res.json()
      for (const [name, prop] of Object.entries(data.properties ?? {})) {
        if ((prop as { type: string }).type === 'title') {
          this.titlePropertyName = name
          break
        }
      }
      return true
    } catch {
      return false
    }
  }

  // ─── Batch Export ───

  async batchExport(
    articles: Array<{
      path: string
      frontmatter: ArticleFrontmatter
      content: string
      originalText?: string
    }>,
    onProgress: (progress: BatchProgress) => void,
    onError: (path: string, error: string) => void,
    signal?: AbortSignal
  ): Promise<{ success: number; skipped: number; failed: number }> {
    let success = 0
    let skipped = 0
    let failed = 0

    for (let i = 0; i < articles.length; i++) {
      if (signal?.aborted) break

      const article = articles[i]
      const title = article.frontmatter.title || article.path

      onProgress({
        current: i + 1,
        total: articles.length,
        title,
        status: 'exporting',
      })

      try {
        // Check if already exists
        const existingId = await this.findPageByGitHubPath(article.path)
        if (existingId) {
          skipped++
          onProgress({
            current: i + 1,
            total: articles.length,
            title,
            status: 'skipped',
          })
          continue
        }

        await this.saveTranslation(article)
        success++
        onProgress({
          current: i + 1,
          total: articles.length,
          title,
          status: 'success',
        })
      } catch (err) {
        failed++
        const errMsg = err instanceof Error ? err.message : 'Unknown error'
        onError(article.path, errMsg)
        onProgress({
          current: i + 1,
          total: articles.length,
          title,
          status: 'error',
          error: errMsg,
        })
      }
    }

    return { success, skipped, failed }
  }
}

export const notionService = new NotionService()
