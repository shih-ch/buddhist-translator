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

  // Extract title
  const title =
    doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ??
    doc.querySelector('title')?.textContent ??
    undefined
  if (title) metadata.title = title

  // Extract author
  const author =
    doc.querySelector('meta[name="author"]')?.getAttribute('content') ??
    doc.querySelector('meta[property="article:author"]')?.getAttribute('content')
  if (author) metadata.author = author

  // Extract date
  const date =
    doc.querySelector('meta[property="article:published_time"]')?.getAttribute('content') ??
    doc.querySelector('time')?.getAttribute('datetime')
  if (date) metadata.date = date.split('T')[0]

  // Extract language
  const lang = doc.documentElement.getAttribute('lang')
  if (lang) metadata.language = lang.split('-')[0]

  // Remove non-content elements
  const selectorsToRemove = [
    'nav', 'header', 'footer', 'aside', 'script', 'style', 'noscript',
    '.sidebar', '.navigation', '.menu', '.ad', '.advertisement',
    '.cookie-banner', '.popup', '#cookie', '#nav', '#header', '#footer',
  ]
  for (const sel of selectorsToRemove) {
    doc.querySelectorAll(sel).forEach((el) => el.remove())
  }

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
