const DEFAULT_PROXY = 'https://api.allorigins.win/get?url='

/**
 * Fetch a web page via CORS proxy.
 */
export async function fetchWebPage(
  url: string,
  proxyUrl: string = DEFAULT_PROXY
): Promise<string> {
  const proxyTarget = `${proxyUrl}${encodeURIComponent(url)}`
  const res = await fetch(proxyTarget)
  if (!res.ok) {
    throw new Error(`Fetch failed: ${res.status}`)
  }
  const data = await res.json()
  // allorigins returns { contents: string, status: { ... } }
  if (data.contents) return data.contents
  throw new Error('No contents in proxy response')
}

/**
 * Parse raw HTML and extract main text content + metadata using DOMParser.
 */
export function parseHtmlContent(html: string): {
  title?: string
  text: string
  metadata: Record<string, string>
} {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const metadata: Record<string, string> = {}

  // Read metadata BEFORE stripping page chrome: JSON-LD lives in <script> and
  // article bylines usually sit in a <header>, both of which get removed below.
  const ld = readJsonLd(doc)

  const title = firstNonEmpty(
    attr(doc, 'meta[property="og:title"]'),
    ld.headline,
    textOf(doc.querySelector('article h1, main h1')),
    textOf(doc.querySelector('title')),
    textOf(doc.querySelector('h1')),
  )
  if (title) metadata.title = title

  // Two meta tags covered only a minority of sites; most carry the author in
  // JSON-LD, schema.org microdata or a byline element instead.
  const author = firstNonEmpty(
    cleanAuthor(attr(doc, 'meta[name="author"]')),
    cleanAuthor(attr(doc, 'meta[property="article:author"]')),
    cleanAuthor(ld.author),
    cleanAuthor(textOf(doc.querySelector('[itemprop="author"] [itemprop="name"]'))),
    cleanAuthor(textOf(doc.querySelector('[itemprop="author"]'))),
    cleanAuthor(textOf(doc.querySelector('[rel="author"]'))),
    cleanAuthor(textOf(doc.querySelector(
      '.author-name, .byline-name, .post-author, .entry-author, .article-author, .author, .byline'
    ))),
  )
  if (author) metadata.author = author

  const date = firstNonEmpty(
    attr(doc, 'meta[property="article:published_time"]'),
    ld.datePublished,
    doc.querySelector('time')?.getAttribute('datetime') ?? undefined,
  )
  if (date) metadata.date = date.split('T')[0]

  // Extract language
  const lang = doc.documentElement.getAttribute('lang')
  if (lang) metadata.language = lang.split('-')[0]

  // Remove non-content elements
  const selectorsToRemove = [
    'nav', 'footer', 'aside', 'script', 'style', 'noscript',
    '.sidebar', '.navigation', '.menu', '.ad', '.advertisement',
    '.cookie-banner', '.popup', '#cookie', '#nav', '#header', '#footer',
  ]
  for (const sel of selectorsToRemove) {
    doc.querySelectorAll(sel).forEach((el) => el.remove())
  }
  // Page-level headers are site chrome; an <article>'s own header holds its
  // title and byline, so keep that one in the extracted text.
  doc.querySelectorAll('header').forEach((el) => {
    if (!el.parentElement?.closest('article, main')) el.remove()
  })

  // Try to find main content
  const mainContent =
    doc.querySelector('article') ??
    doc.querySelector('main') ??
    doc.querySelector('[role="main"]') ??
    doc.querySelector('.post-content') ??
    doc.querySelector('.entry-content') ??
    doc.querySelector('.content') ??
    doc.body

  // Extract text with basic structure preservation
  const text = extractText(mainContent)

  return { title, text, metadata }
}

// ── metadata helpers ──

function attr(doc: Document, selector: string): string | undefined {
  return doc.querySelector(selector)?.getAttribute('content') ?? undefined
}

function textOf(el: Element | null): string | undefined {
  return el?.textContent?.replace(/\s+/g, ' ').trim() || undefined
}

function firstNonEmpty(...values: (string | undefined)[]): string | undefined {
  return values.find((v) => v && v.trim())?.trim()
}

/**
 * Normalise a candidate author string, or reject it. Byline elements carry
 * prefixes ("By", "Автор:"), article:author is often a profile URL, and a
 * loose class match can grab a whole paragraph — none of those are a name.
 */
function cleanAuthor(value: string | undefined): string | undefined {
  if (!value) return undefined
  const v = value
    .replace(/\s+/g, ' ')
    .replace(/^(by|author|автор|作者|文)\s*[:：]?\s*/i, '')
    .trim()
  if (!v || /^https?:\/\//i.test(v) || v.length > 80) return undefined
  return v
}

interface JsonLdMeta {
  headline?: string
  author?: string
  datePublished?: string
}

/** Pull headline/author/date out of any schema.org JSON-LD blocks on the page. */
function readJsonLd(doc: Document): JsonLdMeta {
  const result: JsonLdMeta = {}
  const nameOf = (a: unknown): string | undefined => {
    if (typeof a === 'string') return a
    if (Array.isArray(a)) return a.map(nameOf).filter(Boolean).join(', ') || undefined
    if (a && typeof a === 'object' && 'name' in a) return nameOf((a as { name: unknown }).name)
    return undefined
  }
  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(visit)
    const o = node as Record<string, unknown>
    if (Array.isArray(o['@graph'])) (o['@graph'] as unknown[]).forEach(visit)
    if (!result.headline && typeof o.headline === 'string') result.headline = o.headline
    if (!result.author && o.author) result.author = nameOf(o.author)
    if (!result.datePublished && typeof o.datePublished === 'string') result.datePublished = o.datePublished
  }
  doc.querySelectorAll('script[type="application/ld+json"]').forEach((el) => {
    try {
      visit(JSON.parse(el.textContent ?? ''))
    } catch {
      // Malformed JSON-LD is common in the wild; skip that block.
    }
  })
  return result
}

function extractText(el: Element): string {
  const blocks: string[] = []
  const blockTags = new Set([
    'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'LI', 'BLOCKQUOTE', 'PRE', 'BR',
  ])

  function walk(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent?.trim()
      if (t) blocks.push(t)
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as Element
    const tag = el.tagName

    if (blockTags.has(tag) && blocks.length > 0) {
      blocks.push('\n')
    }

    for (const child of Array.from(el.childNodes)) {
      walk(child)
    }

    if (blockTags.has(tag)) {
      blocks.push('\n')
    }
  }

  walk(el)

  return blocks
    .join(' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
