import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Loader2 } from 'lucide-react'
import { useTranslatorStore } from '@/stores/translatorStore'
import { githubService } from '@/services/github'
import { computeDiff, type DiffLine } from '@/utils/simpleDiff'
import { toast } from 'sonner'

interface VersionCompareProps {
  open: boolean
  onClose: () => void
}

export function VersionCompare({ open, onClose }: VersionCompareProps) {
  const editingArticle = useTranslatorStore((s) => s.editingArticle)
  const previewContent = useTranslatorStore((s) => s.previewContent)
  const [loading, setLoading] = useState(false)
  const [diff, setDiff] = useState<DiffLine[] | null>(null)
  const [, setSavedContent] = useState('')

  const handleFetch = async () => {
    if (!editingArticle?.path) return
    setLoading(true)
    try {
      const { content } = await githubService.getFile(editingArticle.path)
      setSavedContent(content)
      setDiff(computeDiff(content, previewContent))
    } catch (err) {
      toast.error(`載入失敗：${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const stats = diff
    ? {
        added: diff.filter((d) => d.type === 'add').length,
        removed: diff.filter((d) => d.type === 'remove').length,
      }
    : null

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          onClose()
          setDiff(null)
          setSavedContent('')
        }
      }}
    >
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>版本比較</DialogTitle>
        </DialogHeader>

        {!diff ? (
          <div className="flex flex-col items-center py-8 gap-3">
            <p className="text-sm text-muted-foreground">
              比較目前內容與 GitHub 上的已儲存版本
            </p>
            <Button onClick={handleFetch} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {loading ? '載入中...' : '載入已儲存版本'}
            </Button>
          </div>
        ) : (
          <>
            {stats && (
              <div className="flex gap-3 text-xs text-muted-foreground pb-2">
                <span className="text-green-600">+{stats.added} 行新增</span>
                <span className="text-red-600">-{stats.removed} 行刪除</span>
              </div>
            )}
            <ScrollArea className="max-h-[60vh]">
              <div className="font-mono text-xs space-y-0">
                {diff.map((line, i) => (
                  <div
                    key={i}
                    className={
                      line.type === 'add'
                        ? 'bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-300'
                        : line.type === 'remove'
                        ? 'bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300'
                        : 'text-muted-foreground'
                    }
                  >
                    <span className="inline-block w-5 text-right mr-2 select-none opacity-50">
                      {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
                    </span>
                    {line.content}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
