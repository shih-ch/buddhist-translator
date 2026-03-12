import { useState, useRef, useCallback } from 'react'
import { BookOpen, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { githubService } from '@/services/github'
import { notionService } from '@/services/notion'

interface LogEntry {
  title: string
  status: 'success' | 'skipped' | 'error'
  error?: string
}

/** Yield to the browser event loop so UI stays responsive */
const yieldToMain = () => new Promise<void>((r) => setTimeout(r, 0))

export function NotionBatchExport() {
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'loading' | 'exporting' | 'done'>('idle')
  const [totalArticles, setTotalArticles] = useState(0)
  const [current, setCurrent] = useState(0)
  const [currentTitle, setCurrentTitle] = useState('')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [summary, setSummary] = useState({ success: 0, skipped: 0, failed: 0 })
  const abortRef = useRef<AbortController | null>(null)

  const handleStart = useCallback(async () => {
    setPhase('loading')
    setLogs([])
    setCurrent(0)
    setCurrentTitle('')

    try {
      const articleSummaries = await githubService.listTranslations()
      setTotalArticles(articleSummaries.length)

      if (articleSummaries.length === 0) {
        setPhase('done')
        setSummary({ success: 0, skipped: 0, failed: 0 })
        return
      }

      setPhase('exporting')
      const abortController = new AbortController()
      abortRef.current = abortController

      let success = 0
      let skipped = 0
      let failed = 0

      // Process one article at a time: load from GitHub → push to Notion → yield
      for (let i = 0; i < articleSummaries.length; i++) {
        if (abortController.signal.aborted) break

        const { title, path } = articleSummaries[i]
        setCurrent(i + 1)
        setCurrentTitle(title)

        await yieldToMain()

        try {
          // Check if already in Notion (skip if exists)
          const existingId = await notionService.findPageByGitHubPath(path)
          if (existingId) {
            skipped++
            setLogs((prev) => [...prev, { title, status: 'skipped' }])
            continue
          }

          // Load full article from GitHub
          const article = await githubService.loadTranslation(path)

          await yieldToMain()

          // Push to Notion
          await notionService.saveTranslation({
            path: article.path,
            frontmatter: article.frontmatter,
            content: article.content,
            originalText: article.originalText,
          })

          success++
          setLogs((prev) => [...prev, { title, status: 'success' }])
        } catch (err) {
          failed++
          const error = err instanceof Error ? err.message : 'Unknown error'
          setLogs((prev) => [...prev, { title, status: 'error', error }])
        }

        await yieldToMain()
      }

      setSummary({ success, skipped, failed })
      setPhase('done')
    } catch (err) {
      console.error('[NotionBatchExport]', err)
      setPhase('done')
    }
  }, [])

  const handleCancel = () => {
    abortRef.current?.abort()
    setPhase('done')
  }

  const handleClose = (isOpen: boolean) => {
    if (!isOpen && phase === 'exporting') return
    setOpen(isOpen)
    if (!isOpen) {
      setPhase('idle')
      setLogs([])
      setCurrent(0)
      setSummary({ success: 0, skipped: 0, failed: 0 })
    }
  }

  const progressPercent = totalArticles > 0 ? Math.round((current / totalArticles) * 100) : 0

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <BookOpen className="mr-1 h-4 w-4" />
          批次匯出到 Notion
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>批次匯出到 Notion</DialogTitle>
        </DialogHeader>

        {phase === 'idle' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              將 GitHub 上所有翻譯文章匯出到 Notion Database。已存在的文章（以 GitHub Path 判斷）會自動跳過。
            </p>
            <Button onClick={handleStart}>開始匯出</Button>
          </div>
        )}

        {phase === 'loading' && (
          <div className="flex items-center gap-2 py-4">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">正在從 GitHub 載入文章列表...</span>
          </div>
        )}

        {phase === 'exporting' && (
          <div className="space-y-3">
            <div className="text-sm">
              [{current}/{totalArticles}] {currentTitle}
            </div>
            <div className="h-2 w-full rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <Button variant="destructive" size="sm" onClick={handleCancel}>
              <X className="mr-1 h-3 w-3" />
              取消
            </Button>
            {logs.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded border bg-muted/50 p-2 space-y-0.5">
                {logs.map((log, i) => (
                  <div key={i} className="text-xs font-mono">
                    {log.status === 'success' && <span className="text-green-600">✓ {log.title}</span>}
                    {log.status === 'skipped' && <span className="text-yellow-600">⊘ {log.title}（已存在）</span>}
                    {log.status === 'error' && (
                      <span className="text-red-600">✗ {log.title}：{log.error}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {phase === 'done' && (
          <div className="space-y-3">
            <div className="rounded border p-3 space-y-1">
              <div className="text-sm font-medium">匯出完成</div>
              <div className="text-sm text-green-600">{summary.success} 成功</div>
              {summary.skipped > 0 && (
                <div className="text-sm text-yellow-600">{summary.skipped} 跳過（已存在）</div>
              )}
              {summary.failed > 0 && (
                <div className="text-sm text-red-600">{summary.failed} 失敗</div>
              )}
            </div>
            {logs.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded border bg-muted/50 p-2 space-y-0.5">
                {logs.map((log, i) => (
                  <div key={i} className="text-xs font-mono">
                    {log.status === 'success' && <span className="text-green-600">✓ {log.title}</span>}
                    {log.status === 'skipped' && <span className="text-yellow-600">⊘ {log.title}（已存在）</span>}
                    {log.status === 'error' && (
                      <span className="text-red-600">✗ {log.title}：{log.error}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
            <Button variant="outline" onClick={() => handleClose(false)}>
              關閉
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
