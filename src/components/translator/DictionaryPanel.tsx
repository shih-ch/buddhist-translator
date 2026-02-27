import { useState } from 'react'
import { Search, Loader2, BookOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { lookupTerm, type DictionaryResult } from '@/services/dictionaryLookup'
import { toast } from 'sonner'

export function DictionaryPanel() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DictionaryResult | null>(null)
  const [history, setHistory] = useState<DictionaryResult[]>([])

  const handleLookup = async () => {
    const term = query.trim()
    if (!term) return
    setLoading(true)
    try {
      const res = await lookupTerm(term)
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

  return (
    <div className="flex flex-col h-full">
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

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {result ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-sm">{result.term}</h3>
                {result.chinese && (
                  <Badge variant="secondary" className="text-xs">
                    {result.chinese}
                  </Badge>
                )}
              </div>

              {result.etymology && (
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase">詞源</p>
                  <p className="text-xs leading-relaxed">{result.etymology}</p>
                </div>
              )}

              {result.definition && (
                <div>
                  <p className="text-[10px] font-medium text-muted-foreground uppercase">定義</p>
                  <p className="text-xs leading-relaxed whitespace-pre-wrap">{result.definition}</p>
                </div>
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
            </div>
          )}

          {history.length > 1 && (
            <div className="border-t pt-2 mt-3">
              <p className="text-[10px] font-medium text-muted-foreground mb-1">查詢記錄</p>
              <div className="flex flex-wrap gap-1">
                {history.map((h, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="text-[10px] cursor-pointer hover:bg-accent"
                    onClick={() => {
                      setQuery(h.term)
                      setResult(h)
                    }}
                  >
                    {h.term}
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
