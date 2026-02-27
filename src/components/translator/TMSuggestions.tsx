import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useTranslationMemoryStore } from '@/stores/translationMemoryStore'
import { findSimilar } from '@/services/fuzzyMatcher'
import { toast } from 'sonner'

interface TMSuggestionsProps {
  sourceText: string
  onUse?: (target: string) => void
}

export function TMSuggestions({ sourceText, onUse }: TMSuggestionsProps) {
  const entries = useTranslationMemoryStore((s) => s.entries)
  const [collapsed, setCollapsed] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const matches = useMemo(
    () => findSimilar(sourceText, entries, 0.4),
    [sourceText, entries]
  )

  if (matches.length === 0) return null

  return (
    <div className="border rounded-lg mx-3 mb-2">
      <button
        className="flex items-center gap-2 w-full px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? <ChevronRight className="size-3" /> : <ChevronDown className="size-3" />}
        翻譯記憶
        <Badge variant="secondary" className="text-[10px] px-1 py-0">
          {matches.length}
        </Badge>
      </button>

      {!collapsed && (
        <div className="border-t px-3 py-2 space-y-2 max-h-40 overflow-auto">
          {matches.map((m) => (
            <div key={m.entry.id} className="flex items-start gap-2 text-xs">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Badge
                    variant={m.score > 0.8 ? 'default' : 'secondary'}
                    className="text-[9px] px-1 py-0"
                  >
                    {Math.round(m.score * 100)}%
                  </Badge>
                  <span className="text-muted-foreground truncate">
                    {m.entry.source.slice(0, 60)}...
                  </span>
                </div>
                <p className="text-foreground line-clamp-2">{m.entry.target.slice(0, 150)}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                onClick={() => {
                  if (onUse) {
                    onUse(m.entry.target)
                  } else {
                    navigator.clipboard.writeText(m.entry.target)
                    setCopiedId(m.entry.id)
                    toast.success('已複製翻譯')
                    setTimeout(() => setCopiedId(null), 1500)
                  }
                }}
                title="使用此翻譯"
              >
                {copiedId === m.entry.id ? (
                  <Check className="size-3" />
                ) : (
                  <Copy className="size-3" />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
