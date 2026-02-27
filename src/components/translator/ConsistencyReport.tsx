import { useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { useTranslatorStore } from '@/stores/translatorStore'
import { useGlossaryStore } from '@/stores/glossaryStore'
import { checkConsistency } from '@/services/terminologyChecker'

interface ConsistencyReportProps {
  open: boolean
  onClose: () => void
}

export function ConsistencyReport({ open, onClose }: ConsistencyReportProps) {
  const originalText = useTranslatorStore((s) => s.originalText)
  const previewContent = useTranslatorStore((s) => s.previewContent)
  const glossary = useGlossaryStore((s) => s.glossary)

  const issues = useMemo(() => {
    if (!open || !glossary) return []
    return checkConsistency(originalText, previewContent, glossary.terms)
  }, [open, originalText, previewContent, glossary])

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>術語一致性檢查</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          {!glossary || glossary.terms.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              尚未載入詞彙表。請先在詞彙表頁面載入。
            </p>
          ) : issues.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              所有術語翻譯一致，未發現問題。
            </p>
          ) : (
            <div className="space-y-3 pr-4">
              <p className="text-xs text-muted-foreground">
                發現 {issues.length} 個可能不一致的術語
              </p>
              {issues.map((issue, i) => (
                <div key={i} className="rounded-lg border p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{issue.term}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      期望：{issue.expected}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    位置：{issue.found.join('、')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
