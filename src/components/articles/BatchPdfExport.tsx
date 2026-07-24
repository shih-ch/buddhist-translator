import { useState, useRef, useCallback, useMemo } from 'react'
import { FileDown, X, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { githubService } from '@/services/github'
import { renderMarkdownToHtml } from '@/services/markdownRender'
import { buildBookletHtml, buildPreviewHtml, printBookletHtml, type BookletArticle } from '@/services/pdfBooklet'
import { usePdfExportStore, PDF_PRESETS } from '@/stores/pdfExportStore'
import type { ArticleSummary } from '@/types/article'
import { toast } from 'sonner'

interface LogEntry {
  title: string
  status: 'success' | 'error'
  error?: string
}

/** Yield to the browser event loop so UI stays responsive during the loop. */
const yieldToMain = () => new Promise<void>((r) => setTimeout(r, 0))

/** Remove <img> tags (void element) when the user opts out of images. */
const stripImages = (html: string) => html.replace(/<img\b[^>]*>/gi, '')

/** Generate an inline SVG QR code for a source URL, or undefined if not a URL. */
async function makeQrSvg(source: string | undefined): Promise<string | undefined> {
  const url = source?.trim()
  if (!url || !/^https?:\/\//i.test(url)) return undefined
  try {
    const QRCode = (await import('qrcode')).default
    return await QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' })
  } catch {
    return undefined
  }
}

interface SliderRowProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  onChange: (v: number) => void
}

function SliderRow({ label, value, min, max, step, unit, onChange }: SliderRowProps) {
  return (
    <label className="flex items-center gap-3 text-sm">
      <span className="w-16 shrink-0 text-muted-foreground">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 cursor-pointer"
      />
      <span className="w-14 shrink-0 text-right tabular-nums">
        {value}
        {unit}
      </span>
    </label>
  )
}

interface BatchPdfExportProps {
  selected: ArticleSummary[]
}

export function BatchPdfExport({ selected }: BatchPdfExportProps) {
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'loading' | 'done'>('idle')
  const [current, setCurrent] = useState(0)
  const [currentTitle, setCurrentTitle] = useState('')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const abortRef = useRef<AbortController | null>(null)

  const fontSizePt = usePdfExportStore((s) => s.fontSizePt)
  const lineHeight = usePdfExportStore((s) => s.lineHeight)
  const marginMm = usePdfExportStore((s) => s.marginMm)
  const titleSizePt = usePdfExportStore((s) => s.titleSizePt)
  const h1SizePt = usePdfExportStore((s) => s.h1SizePt)
  const h2SizePt = usePdfExportStore((s) => s.h2SizePt)
  const h3SizePt = usePdfExportStore((s) => s.h3SizePt)
  const includeOriginal = usePdfExportStore((s) => s.includeOriginal)
  const includeToc = usePdfExportStore((s) => s.includeToc)
  const includeImages = usePdfExportStore((s) => s.includeImages)
  const includeQr = usePdfExportStore((s) => s.includeQr)
  const embedFont = usePdfExportStore((s) => s.embedFont)
  const update = usePdfExportStore((s) => s.update)
  const applyPreset = usePdfExportStore((s) => s.applyPreset)
  const reset = usePdfExportStore((s) => s.reset)

  const total = selected.length

  const previewHtml = useMemo(
    () => buildPreviewHtml({ fontSizePt, lineHeight, marginMm, titleSizePt, h1SizePt, h2SizePt, h3SizePt }, embedFont, includeQr),
    [fontSizePt, lineHeight, marginMm, titleSizePt, h1SizePt, h2SizePt, h3SizePt, embedFont, includeQr]
  )

  const handleStart = useCallback(async () => {
    setPhase('loading')
    setLogs([])
    setCurrent(0)
    setCurrentTitle('')

    const abortController = new AbortController()
    abortRef.current = abortController

    const booklet: BookletArticle[] = []
    let failed = 0

    for (let i = 0; i < selected.length; i++) {
      if (abortController.signal.aborted) break
      const { title, path } = selected[i]
      setCurrent(i + 1)
      setCurrentTitle(title)
      await yieldToMain()

      try {
        const article = await githubService.loadTranslation(path)
        let contentHtml = await renderMarkdownToHtml(article.content)
        let originalHtml =
          includeOriginal && article.originalText?.trim()
            ? await renderMarkdownToHtml(article.originalText)
            : undefined
        if (!includeImages) {
          contentHtml = stripImages(contentHtml)
          if (originalHtml) originalHtml = stripImages(originalHtml)
        }
        const qrSvg = includeQr ? await makeQrSvg(article.frontmatter.source) : undefined
        booklet.push({ frontmatter: article.frontmatter, contentHtml, originalHtml, qrSvg })
        setLogs((prev) => [...prev, { title, status: 'success' }])
      } catch (err) {
        failed++
        const raw = err instanceof Error ? err.message : 'Unknown error'
        const error = /failed to fetch|network/i.test(raw)
          ? '網路載入失敗（已自動重試），請稍後再試一次'
          : raw
        setLogs((prev) => [...prev, { title, status: 'error', error }])
      }
      await yieldToMain()
    }

    if (abortController.signal.aborted) {
      setPhase('idle')
      return
    }

    if (booklet.length === 0) {
      toast.error('沒有可匯出的文章（全部載入失敗）')
      setPhase('done')
      return
    }

    try {
      const html = buildBookletHtml(booklet, {
        includeOriginal,
        includeToc,
        embedFont,
        layout: { fontSizePt, lineHeight, marginMm, titleSizePt, h1SizePt, h2SizePt, h3SizePt },
      })
      await printBookletHtml(html)
      toast.success(`已開啟列印：${booklet.length} 篇${failed ? `（${failed} 篇失敗）` : ''}。請在對話框選「另存為 PDF」`)
    } catch (err) {
      toast.error(`列印失敗：${err instanceof Error ? err.message : 'Unknown error'}`)
    }
    setPhase('done')
  }, [selected, includeOriginal, includeToc, includeImages, includeQr, embedFont, fontSizePt, lineHeight, marginMm, titleSizePt, h1SizePt, h2SizePt, h3SizePt])

  const handleCancel = () => {
    abortRef.current?.abort()
  }

  const handleClose = (isOpen: boolean) => {
    if (!isOpen && phase === 'loading') return // block close mid-run
    setOpen(isOpen)
    if (!isOpen) {
      setPhase('idle')
      setLogs([])
      setCurrent(0)
    }
  }

  const progressPercent = total > 0 ? Math.round((current / total) * 100) : 0

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <Button
        variant="outline"
        size="sm"
        disabled={total === 0}
        onClick={() => setOpen(true)}
        title={total === 0 ? '先勾選要匯出的文章' : `匯出所選 ${total} 篇為 B5 PDF`}
      >
        <FileDown className="mr-1 h-4 w-4" />
        匯出 B5 PDF{total > 0 ? `（${total}）` : ''}
      </Button>

      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>匯出 B5 PDF</DialogTitle>
        </DialogHeader>

        {phase === 'idle' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              將所選 {total} 篇排版成單一 B5 PDF（向量文字、可選取）。產生後會開啟列印對話框，
              請選「另存為 PDF」，紙張維持 B5。
            </p>

            {/* Live preview — same stylesheet as the printed output */}
            <div className="flex justify-center">
              <div
                className="overflow-hidden rounded border bg-muted"
                style={{ width: 300, height: 235 }}
                title="即時版面預覽（B5，僅示意上半頁）"
              >
                <iframe
                  title="版面預覽"
                  srcDoc={previewHtml}
                  tabIndex={-1}
                  style={{
                    width: 666,
                    height: 945,
                    border: 0,
                    transform: 'scale(0.45)',
                    transformOrigin: 'top left',
                    pointerEvents: 'none',
                  }}
                />
              </div>
            </div>

            {/* Presets */}
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">預設樣式</div>
              <div className="flex flex-wrap gap-1.5">
                {PDF_PRESETS.map((p) => {
                  const active =
                    fontSizePt === p.layout.fontSizePt &&
                    lineHeight === p.layout.lineHeight &&
                    marginMm === p.layout.marginMm &&
                    titleSizePt === p.layout.titleSizePt &&
                    h1SizePt === p.layout.h1SizePt &&
                    h2SizePt === p.layout.h2SizePt &&
                    h3SizePt === p.layout.h3SizePt
                  return (
                    <Button
                      key={p.key}
                      variant={active ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => applyPreset(p.key)}
                    >
                      {p.label}
                    </Button>
                  )
                })}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={reset}
                  title="恢復預設值"
                >
                  <RotateCcw className="mr-1 h-3.5 w-3.5" />
                  恢復預設
                </Button>
              </div>
            </div>

            {/* Fine-tune sliders */}
            <div className="space-y-2 rounded border p-3">
              <SliderRow
                label="字級"
                value={fontSizePt}
                min={9}
                max={18}
                step={0.5}
                unit="pt"
                onChange={(v) => update({ fontSizePt: v })}
              />
              <SliderRow
                label="行距"
                value={lineHeight}
                min={1.3}
                max={2.2}
                step={0.05}
                onChange={(v) => update({ lineHeight: v })}
              />
              <SliderRow
                label="邊界"
                value={marginMm}
                min={6}
                max={22}
                step={1}
                unit="mm"
                onChange={(v) => update({ marginMm: v })}
              />
            </div>

            {/* Per-level heading sizes (collapsed by default) */}
            <details className="rounded border p-3">
              <summary className="cursor-pointer text-sm text-muted-foreground">
                各級標題字級
              </summary>
              <div className="mt-2 space-y-2">
                <SliderRow
                  label="文章標題"
                  value={titleSizePt}
                  min={12}
                  max={28}
                  step={0.5}
                  unit="pt"
                  onChange={(v) => update({ titleSizePt: v })}
                />
                <SliderRow
                  label="標題 1"
                  value={h1SizePt}
                  min={12}
                  max={24}
                  step={0.5}
                  unit="pt"
                  onChange={(v) => update({ h1SizePt: v })}
                />
                <SliderRow
                  label="標題 2"
                  value={h2SizePt}
                  min={11}
                  max={22}
                  step={0.5}
                  unit="pt"
                  onChange={(v) => update({ h2SizePt: v })}
                />
                <SliderRow
                  label="標題 3"
                  value={h3SizePt}
                  min={10}
                  max={20}
                  step={0.5}
                  unit="pt"
                  onChange={(v) => update({ h3SizePt: v })}
                />
              </div>
            </details>

            {/* Content options */}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeImages}
                onChange={(e) => update({ includeImages: e.target.checked })}
              />
              包含圖片
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={includeQr}
                onChange={(e) => update({ includeQr: e.target.checked })}
              />
              <span>
                每篇標題加原文 QR Code
                <span className="block text-xs text-muted-foreground">
                  掃描開啟原文網頁；僅在該篇來源為網址時顯示
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={embedFont}
                onChange={(e) => update({ embedFont: e.target.checked })}
              />
              <span>
                內嵌字型（跨電腦顯示一致）
                <span className="block text-xs text-muted-foreground">
                  產生時需連網下載 Noto 字型並嵌入 PDF；離線則退回系統字型
                </span>
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeOriginal}
                onChange={(e) => update({ includeOriginal: e.target.checked })}
              />
              包含原文對照（附在每篇譯文後）
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeToc}
                onChange={(e) => update({ includeToc: e.target.checked })}
                disabled={total < 2}
              />
              加入目錄{total < 2 ? '（單篇不需要）' : ''}
            </label>

            <Button onClick={handleStart} disabled={total === 0}>
              產生 PDF
            </Button>
          </div>
        )}

        {phase === 'loading' && (
          <div className="space-y-3">
            <div className="text-sm">
              [{current}/{total}] 載入中：{currentTitle}
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
                    {log.status === 'success' ? (
                      <span className="text-green-600">✓ {log.title}</span>
                    ) : (
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
            <div className="rounded border p-3 text-sm">
              已送出列印。若沒看到對話框，請檢查瀏覽器是否封鎖了列印視窗。
            </div>
            {logs.some((l) => l.status === 'error') && (
              <div className="max-h-40 overflow-y-auto rounded border bg-muted/50 p-2 space-y-0.5">
                {logs
                  .filter((l) => l.status === 'error')
                  .map((log, i) => (
                    <div key={i} className="text-xs font-mono text-red-600">
                      ✗ {log.title}：{log.error}
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
