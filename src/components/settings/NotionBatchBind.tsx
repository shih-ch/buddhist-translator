import { useState, useMemo } from 'react'
import { Link2, Loader2, CheckCircle, XCircle, AlertTriangle, Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useArticlesStore } from '@/stores/articlesStore'
import { notionService, type BindResult } from '@/services/notion'
import { toast } from 'sonner'

const STATUS_LABEL: Record<BindResult['status'], string> = {
  bound: '已綁定',
  already_set: '已有正確綁定',
  mismatch: 'GitHub Path 不一致（未動）',
  no_match: 'Notion 中找不到相同標題',
  error: '失敗',
}

function StatusIcon({ status }: { status: BindResult['status'] }) {
  if (status === 'bound') return <CheckCircle className="h-3.5 w-3.5 text-green-600" />
  if (status === 'already_set') return <Minus className="h-3.5 w-3.5 text-muted-foreground" />
  if (status === 'mismatch') return <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
  if (status === 'no_match') return <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
  return <XCircle className="h-3.5 w-3.5 text-destructive" />
}

export function NotionBatchBind() {
  const articles = useArticlesStore((s) => s.articles)
  const fetchArticles = useArticlesStore((s) => s.fetchArticles)

  const [open, setOpen] = useState(false)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)
  const [results, setResults] = useState<BindResult[]>([])

  const summary = useMemo(() => {
    const counts = { bound: 0, already_set: 0, mismatch: 0, no_match: 0, error: 0 }
    for (const r of results) counts[r.status]++
    return counts
  }, [results])

  const handleRun = async () => {
    setRunning(true)
    setResults([])
    setProgress({ current: 0, total: 0 })

    try {
      // Make sure article list is fresh
      if (articles.length === 0) await fetchArticles()
      const list = useArticlesStore.getState().articles

      await notionService.batchBindPages(
        list.map((a) => ({ title: a.title, path: a.path })),
        (current, total) => setProgress({ current, total }),
        (result) => setResults((prev) => [...prev, result])
      )

      toast.success('批次綁定完成')
    } catch (err) {
      toast.error(`綁定中斷：${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setRunning(false)
      setProgress(null)
    }
  }

  return (
    <>
      <div className="space-y-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setOpen(true)
            setResults([])
          }}
        >
          <Link2 className="mr-1 h-3 w-3" />
          批次綁定 Notion 頁面
        </Button>
        <p className="text-xs text-muted-foreground">
          掃描 Notion DB 內所有頁面，依標題對應到 GitHub article，把缺少的「GitHub Path」屬性補上。已正確綁定的不動。
        </p>
      </div>

      <Dialog open={open} onOpenChange={(v) => !running && setOpen(v)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>批次綁定 Notion 頁面</DialogTitle>
            <DialogDescription>
              對應規則：以「文章標題」嚴格相等比對。Notion 頁面的「GitHub Path」屬性為空 → 補上目前 GitHub 路徑。已有不同 path 的不會覆蓋（避免破壞既有對應）。
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between gap-2 shrink-0">
            <div className="text-sm text-muted-foreground">
              GitHub 文章數：{articles.length}
            </div>
            <Button size="sm" onClick={handleRun} disabled={running || articles.length === 0}>
              {running ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Link2 className="mr-1 h-3 w-3" />}
              {running ? '處理中...' : '開始'}
            </Button>
          </div>

          {progress && (
            <div className="shrink-0 space-y-1">
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{
                    width: progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : '0%',
                  }}
                />
              </div>
              <p className="text-xs text-center text-muted-foreground">
                {progress.current} / {progress.total}
              </p>
            </div>
          )}

          {results.length > 0 && (
            <div className="shrink-0 grid grid-cols-5 gap-1 text-xs text-center border rounded p-2 bg-muted/30">
              <div>
                <div className="font-semibold text-green-600">{summary.bound}</div>
                <div className="text-muted-foreground">已綁定</div>
              </div>
              <div>
                <div className="font-semibold text-muted-foreground">{summary.already_set}</div>
                <div className="text-muted-foreground">已有</div>
              </div>
              <div>
                <div className="font-semibold text-amber-600">{summary.mismatch}</div>
                <div className="text-muted-foreground">不一致</div>
              </div>
              <div>
                <div className="font-semibold text-muted-foreground">{summary.no_match}</div>
                <div className="text-muted-foreground">未找到</div>
              </div>
              <div>
                <div className="font-semibold text-destructive">{summary.error}</div>
                <div className="text-muted-foreground">錯誤</div>
              </div>
            </div>
          )}

          <div className="flex-1 min-h-0 overflow-y-auto pr-1 -mr-1 border rounded">
            {results.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                尚未開始。點上方「開始」執行。
              </div>
            ) : (
              <table className="text-xs w-full">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="text-left p-2 w-8"></th>
                    <th className="text-left p-2">文章標題</th>
                    <th className="text-left p-2 w-40">結果</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2 align-top">
                        <StatusIcon status={r.status} />
                      </td>
                      <td className="p-2 align-top">
                        {r.status === 'bound' || r.status === 'already_set' || r.status === 'mismatch' ? (
                          <a
                            href={r.pageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline"
                          >
                            {r.articleTitle}
                          </a>
                        ) : (
                          <span>{r.articleTitle}</span>
                        )}
                        <div className="text-muted-foreground font-mono text-[10px] break-all mt-0.5">
                          {r.articlePath}
                        </div>
                        {r.status === 'mismatch' && (
                          <div className="text-amber-600 text-[10px] mt-0.5 font-mono break-all">
                            Notion path: {r.notionPath}
                          </div>
                        )}
                        {r.status === 'error' && (
                          <div className="text-destructive text-[10px] mt-0.5">{r.error}</div>
                        )}
                      </td>
                      <td className="p-2 align-top text-muted-foreground">
                        {STATUS_LABEL[r.status]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="flex justify-end shrink-0">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={running}>
              關閉
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
