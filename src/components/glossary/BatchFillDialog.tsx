import { useState, useRef, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useGlossaryStore } from '@/stores/glossaryStore'
import { useAIFunctionsStore } from '@/stores/aiFunctionsStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { trackedCallFunction } from '@/services/ai/trackedCall'
import { buildGlossaryFillMessages } from '@/services/ai/promptBuilder'
import { toast } from 'sonner'

interface BatchFillDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const BATCH_SIZE = 50

interface BatchProgress {
  totalTerms: number
  totalBatches: number
  completedBatches: number
  successCount: number
  failCount: number
  status: 'idle' | 'running' | 'done' | 'cancelled'
}

export function BatchFillDialog({ open, onOpenChange }: BatchFillDialogProps) {
  const glossary = useGlossaryStore((s) => s.glossary)
  const updateTermsBatch = useGlossaryStore((s) => s.updateTermsBatch)
  const syncToGithub = useGlossaryStore((s) => s.syncToGithub)
  const cancelledRef = useRef(false)

  const [progress, setProgress] = useState<BatchProgress>({
    totalTerms: 0,
    totalBatches: 0,
    completedBatches: 0,
    successCount: 0,
    failCount: 0,
    status: 'idle',
  })

  const emptyTerms = (glossary?.terms ?? []).filter((t) => !t.translation.trim())
  const emptyCount = emptyTerms.length

  const handleStart = useCallback(async () => {
    if (emptyTerms.length === 0) return

    cancelledRef.current = false
    const totalBatches = Math.ceil(emptyTerms.length / BATCH_SIZE)

    setProgress({
      totalTerms: emptyTerms.length,
      totalBatches,
      completedBatches: 0,
      successCount: 0,
      failCount: 0,
      status: 'running',
    })

    const fnConfig = useAIFunctionsStore.getState().getFunctionConfig('glossary_fill')
    const apiKeys = useSettingsStore.getState().apiKeys

    let totalSuccess = 0
    let totalFail = 0

    for (let i = 0; i < totalBatches; i++) {
      if (cancelledRef.current) {
        setProgress((p) => ({ ...p, status: 'cancelled' }))
        break
      }

      const batch = emptyTerms.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE)
      const originals = batch.map((t) => t.original)

      try {
        const messages = buildGlossaryFillMessages(fnConfig.prompt, originals)
        const response = await trackedCallFunction(fnConfig, apiKeys, messages, undefined, 'glossary_fill')

        // Parse JSON from response (handle markdown code blocks)
        let jsonStr = response.content.trim()
        const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
        if (codeBlockMatch) jsonStr = codeBlockMatch[1].trim()

        const results = JSON.parse(jsonStr) as { original: string; translation: string }[]

        // Match results back to terms by original text
        const resultMap = new Map(results.map((r) => [r.original.toLowerCase(), r.translation]))

        const updates: { id: string; updates: { translation: string; notes: string } }[] = []
        for (const term of batch) {
          const translation = resultMap.get(term.original.toLowerCase())
          if (translation) {
            const existingNotes = term.notes ? term.notes + ' ' : ''
            updates.push({ id: term.id, updates: { translation, notes: existingNotes + '[AI翻譯]' } })
          }
        }

        if (updates.length > 0) {
          await updateTermsBatch(updates, true)
        }

        totalSuccess += updates.length
        totalFail += batch.length - updates.length
      } catch (err) {
        console.error('Batch fill error:', err)
        totalFail += batch.length
      }

      setProgress((p) => ({
        ...p,
        completedBatches: i + 1,
        successCount: totalSuccess,
        failCount: totalFail,
      }))
    }

    // Sync to GitHub once at the end (avoid repeated writes causing SHA conflicts)
    if (totalSuccess > 0) {
      await syncToGithub()
    }

    if (!cancelledRef.current) {
      setProgress((p) => ({ ...p, status: 'done' }))
      toast.success(`AI 補齊完成：成功 ${totalSuccess} 筆，失敗 ${totalFail} 筆`)
    }
  }, [emptyTerms, updateTermsBatch, syncToGithub])

  const handleCancel = () => {
    cancelledRef.current = true
  }

  const handleClose = () => {
    if (progress.status === 'running') return
    setProgress((p) => ({ ...p, status: 'idle', completedBatches: 0, successCount: 0, failCount: 0 }))
    onOpenChange(false)
  }

  const pct = progress.totalBatches > 0
    ? Math.round((progress.completedBatches / progress.totalBatches) * 100)
    : 0

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>AI 批次補齊翻譯</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            術語表中有 <span className="font-semibold text-foreground">{emptyCount}</span> 筆缺少中文翻譯，
            將分 {Math.ceil(emptyCount / BATCH_SIZE)} 批送 AI 翻譯（每批 {BATCH_SIZE} 筆）。
          </p>

          {progress.status !== 'idle' && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>進度：{progress.completedBatches} / {progress.totalBatches} 批</span>
                <span>{pct}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span>成功：{progress.successCount}</span>
                <span>失敗：{progress.failCount}</span>
              </div>
              {progress.status === 'done' && (
                <p className="text-sm font-medium text-green-600">補齊完成！</p>
              )}
              {progress.status === 'cancelled' && (
                <p className="text-sm font-medium text-yellow-600">已取消（已完成的批次結果已儲存）</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {progress.status === 'idle' && (
            <>
              <Button variant="outline" onClick={handleClose}>取消</Button>
              <Button onClick={handleStart} disabled={emptyCount === 0}>
                開始補齊
              </Button>
            </>
          )}
          {progress.status === 'running' && (
            <Button variant="outline" onClick={handleCancel}>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              取消補齊
            </Button>
          )}
          {(progress.status === 'done' || progress.status === 'cancelled') && (
            <Button onClick={handleClose}>關閉</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
