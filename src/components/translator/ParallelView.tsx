import { useRef, useCallback } from 'react'

interface ParallelViewProps {
  originalText: string
  translatedContent: string
}

/**
 * Split content into paragraphs, stripping frontmatter from translated content.
 */
function toParagraphs(text: string, stripFrontmatter = false): string[] {
  let content = text
  if (stripFrontmatter) {
    // Remove YAML frontmatter
    const fmMatch = content.match(/^---\n[\s\S]*?\n---\n/)
    if (fmMatch) content = content.slice(fmMatch[0].length)
    // Remove <details> block (original text embed)
    content = content.replace(/<details>[\s\S]*?<\/details>/g, '')
  }
  return content
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
}

export function ParallelView({ originalText, translatedContent }: ParallelViewProps) {
  const leftRef = useRef<HTMLDivElement>(null)
  const rightRef = useRef<HTMLDivElement>(null)
  const syncing = useRef(false)

  const handleScroll = useCallback((source: 'left' | 'right') => {
    if (syncing.current) return
    syncing.current = true

    const srcEl = source === 'left' ? leftRef.current : rightRef.current
    const tgtEl = source === 'left' ? rightRef.current : leftRef.current

    if (srcEl && tgtEl) {
      const ratio = srcEl.scrollTop / (srcEl.scrollHeight - srcEl.clientHeight || 1)
      tgtEl.scrollTop = ratio * (tgtEl.scrollHeight - tgtEl.clientHeight || 1)
    }

    requestAnimationFrame(() => { syncing.current = false })
  }, [])

  const origParas = toParagraphs(originalText)
  const transParas = toParagraphs(translatedContent, true)
  const maxLen = Math.max(origParas.length, transParas.length)

  return (
    <div className="grid grid-cols-2 h-full divide-x">
      <div className="flex flex-col min-h-0">
        <div className="px-3 py-1 border-b text-xs font-medium text-muted-foreground bg-muted/30 shrink-0">
          原文
        </div>
        <div
          ref={leftRef}
          className="flex-1 overflow-y-auto p-3 space-y-3"
          onScroll={() => handleScroll('left')}
        >
          {origParas.map((p, i) => (
            <div key={i} className="text-sm leading-relaxed whitespace-pre-wrap">
              {p}
            </div>
          ))}
          {origParas.length < maxLen &&
            Array.from({ length: maxLen - origParas.length }).map((_, i) => (
              <div key={`pad-${i}`} className="text-sm text-muted-foreground/30">—</div>
            ))}
        </div>
      </div>

      <div className="flex flex-col min-h-0">
        <div className="px-3 py-1 border-b text-xs font-medium text-muted-foreground bg-muted/30 shrink-0">
          譯文
        </div>
        <div
          ref={rightRef}
          className="flex-1 overflow-y-auto p-3 space-y-3"
          onScroll={() => handleScroll('right')}
        >
          {transParas.map((p, i) => (
            <div key={i} className="text-sm leading-relaxed whitespace-pre-wrap">
              {p}
            </div>
          ))}
          {transParas.length < maxLen &&
            Array.from({ length: maxLen - transParas.length }).map((_, i) => (
              <div key={`pad-${i}`} className="text-sm text-muted-foreground/30">—</div>
            ))}
        </div>
      </div>
    </div>
  )
}
