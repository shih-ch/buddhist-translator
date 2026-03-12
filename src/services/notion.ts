import { useSettingsStore } from '@/stores/settingsStore'
import type { ArticleFrontmatter } from '@/types/article'

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

// ─── Markdown → Notion Blocks ───

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
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: parseInlineMarkdown(text) },
      })
      i++
      continue
    }

    // Numbered list
    const numMatch = line.match(/^\d+\.\s+(.*)/)
    if (numMatch) {
      blocks.push({
        object: 'block',
        type: 'numbered_list_item',
        numbered_list_item: { rich_text: parseInlineMarkdown(numMatch[1]) },
      })
      i++
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

  // ─── Database Query ───

  async findPageByGitHubPath(githubPath: string): Promise<string | null> {
    await this.autoInit()
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
    if (data.results && data.results.length > 0) {
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

    const allBlocks = markdownToBlocks(bodyMd)
    const properties = this.buildProperties(article.frontmatter, article.path)

    // Check if page already exists
    const existingPageId = await this.findPageByGitHubPath(article.path)

    if (existingPageId) {
      // Archive old page, then create new one (much faster than deleting blocks one by one)
      await this.apiFetch(`/v1/pages/${existingPageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ archived: true }),
      })
    }

    {
      // Strip _overflow tags before sending (Notion API would reject unknown fields)
      const overflowMap: Array<{ index: number; blocks: NotionBlock[] }> = []
      for (let idx = 0; idx < allBlocks.length; idx++) {
        const block = allBlocks[idx] as Record<string, unknown>
        if (block._overflow) {
          overflowMap.push({ index: idx, blocks: block._overflow as NotionBlock[] })
          delete block._overflow
        }
      }

      // Create new page with first 100 blocks
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

      // Append remaining top-level blocks
      if (remaining.length > 0) {
        await this.appendBlocksBatched(pageId, remaining)
      }

      // Append overflow children to toggle blocks
      if (overflowMap.length > 0) {
        await this.appendToggleOverflow(pageId, overflowMap)
      }

      return { pageId, url: data.url }
    }
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
