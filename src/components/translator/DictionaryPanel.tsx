import { useState, useMemo } from 'react'
import { Search, Loader2, BookOpen, Sparkles, Globe, Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  lookupOnlineFirst,
  lookupTerm,
  lookupOnlineOnly,
  type DictionaryResult,
} from '@/services/dictionaryLookup'
import { toSlp1, SCRIPT_LABELS } from '@/services/csaltDictionary'
import { toast } from 'sonner'

type LookupMode = 'online-first' | 'online-only' | 'ai-only'

function SourceBadge({ source }: { source?: string }) {
  if (!source) return null
  const colors: Record<string, string> = {
    MW: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    BHS: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    AI: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
    'online+AI': 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  }
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${colors[source] || ''}`}>
      {source}
    </span>
  )
}

export function DictionaryPanel() {
  const [query, setQuery] = useState('')
  const [mode, setMode] = useState<LookupMode>('online-first')
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [result, setResult] = useState<DictionaryResult | null>(null)
  const [history, setHistory] = useState<DictionaryResult[]>([])

  const handleLookup = async () => {
    const term = query.trim()
    if (!term) return
    setLoading(true)
    try {
      let res: DictionaryResult
      switch (mode) {
        case 'ai-only':
          res = await lookupTerm(term)
          break
        case 'online-only':
          res = await lookupOnlineOnly(term)
          break
        case 'online-first':
        default:
          res = await lookupOnlineFirst(term)
          break
      }
      setResult(res)
      setHistory((prev) => {
        const filtered = prev.filter((h) => h.term !== res.term)
        return [res, ...filtered].slice(0, 10)
      })
    } catch (err) {
      toast.error(`查詢失敗：${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleAISupplement = async () => {
    if (!result) return
    setAiLoading(true)
    try {
      const aiResult = await lookupTerm(result.term)
      const merged: DictionaryResult = {
        ...result,
        etymology: aiResult.etymology || result.etymology,
        definition: aiResult.definition || result.definition,
        chinese: aiResult.chinese || result.chinese,
        related: aiResult.related.length > 0 ? aiResult.related : result.related,
        source: 'online+AI',
      }
      setResult(merged)
      setHistory((prev) =>
        prev.map((h) => (h.term === merged.term ? merged : h)),
      )
    } catch (err) {
      toast.error(`AI 補充失敗：${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setAiLoading(false)
    }
  }

  const canSupplement = result?.source === 'MW' || result?.source === 'BHS'

  // Live conversion preview
  const conversion = useMemo(() => {
    const trimmed = query.trim()
    if (!trimmed || mode === 'ai-only') return null
    return toSlp1(trimmed)
  }, [query, mode])

  return (
    <div className="flex flex-col h-full">
      {/* Mode selector */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-muted/30">
        <Select value={mode} onValueChange={(v) => setMode(v as LookupMode)}>
          <SelectTrigger className="h-6 text-[11px] w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="online-first">
              <span className="flex items-center gap-1"><Globe className="h-3 w-3" /> 線上優先</span>
            </SelectItem>
            <SelectItem value="online-only">
              <span className="flex items-center gap-1"><Globe className="h-3 w-3" /> 僅線上辭典</span>
            </SelectItem>
            <SelectItem value="ai-only">
              <span className="flex items-center gap-1"><Bot className="h-3 w-3" /> 僅 AI</span>
            </SelectItem>
          </SelectContent>
        </Select>
        <span className="text-[10px] text-muted-foreground">
          {mode === 'online-first' && '先查 MW/BHS，無結果再用 AI'}
          {mode === 'online-only' && '只查 C-SALT 線上辭典（不用 AI）'}
          {mode === 'ai-only' && '只用 AI 查詢（需 API Key）'}
        </span>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b">
        <BookOpen className="size-4 text-muted-foreground shrink-0" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
          placeholder="輸入梵/藏/巴利術語..."
          className="h-7 text-sm"
        />
        <Button
          size="sm"
          className="h-7 px-2"
          onClick={handleLookup}
          disabled={loading || !query.trim()}
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
        </Button>
      </div>

      {/* Conversion preview */}
      {conversion && conversion.slp1 !== query.trim() && (
        <div className="flex items-center gap-1.5 px-3 py-1 border-b bg-muted/20 text-[10px] text-muted-foreground">
          <Badge variant="outline" className="text-[9px] px-1 py-0">
            {SCRIPT_LABELS[conversion.detectedScript]}
          </Badge>
          <span>→ SLP1:</span>
          <code className="font-mono text-foreground">{conversion.slp1}</code>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {result ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-sm">{result.term}</h3>
                <SourceBadge source={result.source} />
                {result.chinese && (
                  <Badge variant="secondary" className="text-xs">
                    {result.chinese}
                  </Badge>
                )}
              </div>

              {/* Online dictionary results */}
              {result.onlineResults && result.onlineResults.length > 0 && (
                <div className="space-y-2">
                  {result.onlineResults.map((r, i) => (
                    <div key={i} className="rounded border p-2 text-xs">
                      <div className="flex items-center gap-1.5 mb-1">
                        <SourceBadge source={r.source} />
                        <span className="font-medium">{r.headword}</span>
                      </div>
                      <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                        {r.definitions.map((def, j) => (
                          <li key={j} className="leading-relaxed">{def}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              {/* Plain definition text (AI results or online-only with no structured results) */}
              {!result.onlineResults && result.definition && (
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase">定義</p>
                  <p className="text-xs leading-relaxed whitespace-pre-wrap">{result.definition}</p>
                </div>
              )}

              {result.etymology && (
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase">詞源</p>
                  <p className="text-xs leading-relaxed">{result.etymology}</p>
                </div>
              )}

              {/* AI supplement button — only when showing online results without AI yet */}
              {canSupplement && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={handleAISupplement}
                  disabled={aiLoading}
                >
                  {aiLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Sparkles className="h-3 w-3" />
                  )}
                  AI 補充
                </Button>
              )}

              {result.related.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase">相關術語</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {result.related.map((r, i) => (
                      <Badge
                        key={i}
                        variant="outline"
                        className="text-[10px] cursor-pointer hover:bg-accent"
                        onClick={() => {
                          setQuery(r)
                        }}
                      >
                        {r}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center py-6 text-muted-foreground">
              <BookOpen className="h-6 w-6 mb-2" />
              <p className="text-xs">輸入術語查詢佛學辭典</p>
              <p className="text-[10px] mt-1">
                {mode !== 'ai-only'
                  ? '支援天城體 / IAST / 藏文 / 拉丁輸入，自動轉 SLP1 查詢'
                  : '支援梵/藏/巴利/中文術語'}
              </p>
            </div>
          )}

          {history.length > 1 && (
            <div className="border-t pt-2 mt-3">
              <p className="text-[10px] font-medium text-muted-foreground mb-1">查詢記錄</p>
              <div className="flex flex-wrap gap-1">
                {history.map((h) => (
                  <Badge
                    key={h.term}
                    variant="outline"
                    className="text-[10px] cursor-pointer hover:bg-accent"
                    onClick={() => {
                      setQuery(h.term)
                      setResult(h)
                    }}
                  >
                    {h.term}
                    {h.source && h.source !== 'AI' && (
                      <span className="ml-1 opacity-60">{h.source}</span>
                    )}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
